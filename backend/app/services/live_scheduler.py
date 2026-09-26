"""The clock that runs live lessons: reminders, the room opening, the start.

Every few seconds it looks at the lessons due in the next day:
- sends each reminder once, in its window (`live/timeline.py`), recording
  it on the session so a restart never repeats it;
- opens the room ten minutes before the start (the lobby);
- starts the lesson at its time once someone is there to hear it, and a
  lesson that was running when the server restarted carries on where it was.

A loop in the app's lifespan; one worker, like the rest of the live hubs.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.live import LiveSession
from app.events.bus import EventBus
from app.events.catalog import LiveSessionReminder
from app.live.timeline import due_reminders, lobby_open
from app.services.live_runtime import LiveRuntime
from app.services.live_session_service import LiveSessionService
from app.services.realtime import push_after_commit

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]
TICK_SECONDS = 10.0
LOOK_AHEAD = timedelta(hours=25)


class LiveScheduler:
    def __init__(
        self, *, runtime: LiveRuntime, session_maker: SessionMaker, bus: Callable[[], EventBus]
    ) -> None:
        self._runtime = runtime
        self._db = session_maker
        self._bus = bus

    async def run(self) -> None:
        while True:
            try:
                await self.tick(datetime.now(UTC))
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("the live-lesson clock failed a tick")
            await asyncio.sleep(TICK_SECONDS)

    async def tick(self, now: datetime) -> None:
        async with self._db() as db:
            due = (
                (
                    await db.execute(
                        select(LiveSession).where(
                            or_(
                                LiveSession.status == "live",
                                (LiveSession.status.in_(("scheduled", "lobby")))
                                & (LiveSession.scheduled_at <= now + LOOK_AHEAD),
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )
            to_start = []
            for live in due:
                if live.status == "live":
                    to_start.append(live.id)
                    continue
                await self._remind(db, live, now)
                if (
                    live.status == "scheduled"
                    and live.scheduled_at
                    and lobby_open(live.scheduled_at, now)
                ):
                    live.status = "lobby"
                    await self._announce_lobby(db, live)
                if live.status == "lobby" and live.scheduled_at and now >= live.scheduled_at:
                    room = await self._runtime.room(live.id)
                    if room.here():
                        to_start.append(live.id)
            await db.commit()
        for session_id in to_start:
            if self._runtime.conductor(session_id) is None:
                logger.info("starting live session %s", session_id)
                await self._runtime.start(session_id)

    async def _remind(self, db: AsyncSession, live: LiveSession, now: datetime) -> None:
        if live.scheduled_at is None:
            return
        due = due_reminders(live.scheduled_at, now, list(live.reminders_sent or []))
        if not due:
            return
        audience = await LiveSessionService(db).audience(live)
        here = set((await self._runtime.room(live.id)).here())
        for name in due:
            students = [s for s in audience if not (name == "now" and s in here)]
            if students:
                await self._bus().publish(
                    LiveSessionReminder(
                        session_id=live.id,
                        title=live.title,
                        teacher_id=live.teacher_id,
                        student_ids=tuple(students),
                        scheduled_at=live.scheduled_at.isoformat(),
                        when=name,
                    ),
                    db,
                )
        live.reminders_sent = [*(live.reminders_sent or []), *due]

    async def _announce_lobby(self, db: AsyncSession, live: LiveSession) -> None:
        room = await self._runtime.room(live.id)
        room.publish({"type": "phase", "phase": "lobby"})
        for user_id in [*await LiveSessionService(db).audience(live), live.teacher_id]:
            push_after_commit(db, user_id, {"topic": "live", "session_id": str(live.id)})
