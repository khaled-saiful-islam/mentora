"""Which live lessons are running, and the way in to each: its room, its
conductor, and who may be there.

Built once, in the app's lifespan, with everything a conductor needs; routes
and the scheduler reach lessons only through here.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.live import LiveParticipant, LiveSession
from app.db.models.user import User
from app.events.bus import EventBus
from app.live.answering import Answerer
from app.live.audio import Narrator
from app.services.live_conductor import Conductor, QuizMaker, Timing, Voice
from app.services.live_plan_service import first_name
from app.services.live_room import Member, Room, RoomRegistry
from app.services.live_session_service import LiveSessionService

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]
AnswererFactory = Callable[[str | None], Answerer]


class LiveRuntime:
    def __init__(
        self,
        *,
        settings: Settings,
        session_maker: SessionMaker,
        narrator: Narrator,
        answerer: AnswererFactory,
        make_quiz: QuizMaker,
        bus: Callable[[], EventBus],
        rooms: RoomRegistry,
        timing: Timing = Timing(),
    ) -> None:
        self._settings = settings
        self._db = session_maker
        self._narrator = narrator
        self._answerer = answerer
        self._make_quiz = make_quiz
        self._bus = bus
        self._rooms = rooms
        self._timing = timing
        self._running: dict[UUID, tuple[Conductor, asyncio.Task[None]]] = {}

    def conductor(self, session_id: UUID) -> Conductor | None:
        found = self._running.get(session_id)
        return found[0] if found and not found[1].done() else None

    async def room(self, session_id: UUID) -> Room:
        """The room, with everyone who may be in it known by name and buddy."""
        room = self._rooms.get(session_id)
        if not room.members:
            await self._fill(room)
        return room

    async def start(self, session_id: UUID) -> Conductor:
        running = self.conductor(session_id)
        if running is not None:
            return running
        room = await self.room(session_id)
        async with self._db() as db:
            live = await db.get(LiveSession, session_id)
            if live is None:
                raise ValueError("no such session")
            chosen = live.settings.get("voice") or {}
            grade = live.settings.get("grade_level")
        voice_name = chosen.get("voice") or self._settings.speech_voice
        if voice_name not in self._settings.speech_voice_list:
            voice_name = self._settings.speech_voice
        voice = Voice(
            self._narrator,
            model=self._settings.speech_model,
            voice=voice_name,
            speed=float(chosen.get("speed") or self._settings.speech_speed),
        )
        conductor = Conductor(
            session_id,
            room=room,
            voice=voice,
            answerer=self._answerer(grade),
            session_maker=self._db,
            bus=self._bus,
            make_quiz=self._make_quiz,
            timing=self._timing,
        )
        task = asyncio.create_task(conductor.run(), name=f"live-{session_id}")
        self._running[session_id] = (conductor, task)
        return conductor

    def voice_of(self, session_id: UUID) -> Voice | None:
        found = self.conductor(session_id)
        return found._voice if found else None  # noqa: SLF001 — the runtime owns its conductors

    async def close_all(self) -> None:
        tasks = [task for _, task in self._running.values() if not task.done()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self._running.clear()

    async def _fill(self, room: Room) -> None:
        async with self._db() as db:
            live = await db.get(LiveSession, room.session_id)
            if live is None:
                return
            ids = await LiveSessionService(db).audience(live)
            removed = set(
                (
                    await db.execute(
                        select(LiveParticipant.student_id).where(
                            LiveParticipant.session_id == live.id,
                            LiveParticipant.removed_at.is_not(None),
                        )
                    )
                ).scalars()
            )
            users = (
                (await db.execute(select(User).where(User.id.in_([*ids, live.teacher_id]))))
                .scalars()
                .all()
            )
            for user in users:
                if user.id in removed:
                    continue
                role = "teacher" if user.id == live.teacher_id else "student"
                room.members.setdefault(
                    user.id, Member(user.id, first_name(user), user.buddy, role)
                )
