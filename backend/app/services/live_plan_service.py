"""The long work of a live session, run as jobs: writing the lesson, and
recording its voice.

Both outlive the request that started them (`services/jobs.py`) and are
followed on one stream per session, so the teacher's preview fills in part by
part and a reload rejoins it. Each part is saved the moment it is written.

Recording says every sentence of the lesson once, plus what the tutor says to
each student by name, into the clip cache — so the live lesson never waits
for a voice, and the preview plays exactly what the group will hear.
"""

from __future__ import annotations

import asyncio
import logging
import random
import zlib
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import replace
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ValidationError
from app.db.models.live import LiveSession
from app.db.models.user import User
from app.learning.model import GenerationUnavailable, Meter
from app.live.audio import Narrator
from app.live.beats import Beat, beats_from
from app.live.planner import (
    Document,
    LessonPlanner,
    PartWritten,
    PlanInput,
    PlannedSegment,
    PlanRefused,
    PlanUnavailable,
    Stage,
)
from app.live.settings import SessionSettings
from app.live.voice_lab import Lines, lines_for
from app.services.live_session_service import LiveSessionService

logger = logging.getLogger(__name__)

PlannerFactory = Callable[[Meter], LessonPlanner]
SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]
# Clips recorded at once.
RECORDING_CONCURRENCY = 4


def first_name(user: User) -> str:
    raw = (user.display_name or user.username or "friend").split()
    return raw[0][:40] if raw else "friend"


def student_lines(session_id: UUID, name: str) -> Lines:
    """The same lines for a student every time, so what was recorded is what plays."""
    seed = zlib.crc32(f"{session_id}:{name}".encode())
    return lines_for(name, rng=random.Random(seed))  # noqa: S311 — a greeting, not a secret


class LivePlanService:
    def __init__(
        self,
        *,
        settings: Settings,
        session_maker: SessionMaker,
        planner_factory: PlannerFactory,
        narrator: Narrator,
    ) -> None:
        self._settings = settings
        self._session_maker = session_maker
        self._planner = planner_factory
        self._narrator = narrator

    # --- writing ------------------------------------------------------------

    async def plan_events(self, session_id: UUID) -> AsyncIterator[dict[str, Any]]:
        request = await self._input(session_id)
        planner = self._planner(Meter())
        position = 0
        try:
            async with self._session_maker() as db:
                await LiveSessionService(db).replace_segments(session_id, [])
                await db.commit()
            async for event in planner.plan(request):
                if isinstance(event, Stage):
                    yield {"type": "stage", "label": event.label}
                elif isinstance(event, PartWritten):
                    saved = await self._save_part(session_id, event, start=position)
                    position += len(saved)
                    yield {"type": "part", "part": event.part, "segments": saved}
            await self._mark(session_id, "planned", None)
            yield {"type": "done", "segments": position}
        except PlanRefused as exc:
            await self._mark(session_id, "failed", str(exc))
            yield {"type": "failed", "message": str(exc)}
        except (PlanUnavailable, GenerationUnavailable) as exc:
            message = f"{exc} Try writing it again."
            await self._mark(session_id, "failed", message)
            yield {"type": "failed", "message": message}
        except Exception:
            logger.exception("planning live session %s failed", session_id)
            message = "Something went wrong while writing the lesson. Please try again."
            await self._mark(session_id, "failed", message)
            yield {"type": "failed", "message": message}

    async def breakdown(
        self, *, subject: str, topic: str, grade_level: str, difficulty: str, notes: str
    ) -> list[str]:
        try:
            return await self._planner(Meter()).breakdown(
                subject=subject,
                topic=topic,
                grade_level=grade_level,
                difficulty=difficulty,
                notes=notes,
            )
        except GenerationUnavailable as exc:
            raise ValidationError("Parts could not be suggested just now. Try again.") from exc

    async def rewrite(
        self, teacher_id: UUID, session_id: UUID, segment_id: UUID, instruction: str
    ) -> dict[str, Any]:
        request = await self._input(session_id)
        async with self._session_maker() as db:
            service = LiveSessionService(db)
            row = await service.segment(await service.owned(teacher_id, session_id), segment_id)
            current = PlannedSegment(
                part=0,
                subtopic=row.subtopic,
                skill=row.skill,
                title=row.title,
                beats=tuple(beats_from(row.beats)),
                key_points=tuple(row.key_points),
                checkin=row.checkin,
                target_seconds=row.target_seconds,
            )
        try:
            made = await self._planner(Meter()).rewrite(request, current, instruction)
        except (PlanUnavailable, GenerationUnavailable) as exc:
            raise ValidationError(str(exc)) from exc
        async with self._session_maker() as db:
            service = LiveSessionService(db)
            live = await service.owned(teacher_id, session_id)
            row = await service.segment(live, segment_id)
            fresh = _prefixed(made, row.position).as_dict()
            row.title, row.beats = fresh["title"], fresh["beats"]
            row.key_points, row.checkin = fresh["key_points"], fresh["checkin"]
            service.reopen(live)
            await db.commit()
            return {"id": str(row.id), "position": row.position, **fresh}

    # --- recording ----------------------------------------------------------

    async def record_events(self, session_id: UUID) -> AsyncIterator[dict[str, Any]]:
        texts = await self._everything_said(session_id)
        voice, speed = await self._voice(session_id)
        model = self._settings.speech_model
        total = len(texts)
        failed = 0
        gate = asyncio.Semaphore(RECORDING_CONCURRENCY)
        yield {"type": "recording", "done": 0, "total": total}

        async def one(text: str) -> bool:
            async with gate:
                try:
                    await self._narrator.speak(text, model=model, voice=voice, speed=speed)
                    return True
                except Exception:  # noqa: BLE001 — counted and reported, never fatal alone
                    logger.warning("live.record: a clip could not be recorded", exc_info=True)
                    return False

        for done, finished in enumerate(asyncio.as_completed([one(t) for t in texts]), start=1):
            ok = await finished
            failed += 0 if ok else 1
            if done % 5 == 0 or done == total:
                yield {"type": "recording", "done": done, "total": total}
        if failed:
            message = f"{failed} of {total} sentences could not be voiced. Try recording again."
            await self._mark(session_id, "planned", message)
            yield {"type": "failed", "message": message}
            return
        await self._mark(session_id, "approved", None)
        yield {"type": "done", "recorded": total}

    async def voice_of(self, session_id: UUID) -> tuple[str, float]:
        return await self._voice(session_id)

    # --- internals ------------------------------------------------------------

    async def _input(self, session_id: UUID) -> PlanInput:
        async with self._session_maker() as db:
            service = LiveSessionService(db)
            live = await db.get(LiveSession, session_id)
            if live is None:
                raise ValidationError("No such live session.")
            settings = SessionSettings.model_validate(live.settings)
            documents = tuple(
                Document(d.filename, d.text) for d in await service.documents(live.id)
            )
            students = await self._names(db, await service.audience(live))
        return PlanInput(settings=settings, documents=documents, students=tuple(students))

    async def _names(self, db: AsyncSession, student_ids: list[UUID]) -> list[str]:
        if not student_ids:
            return []
        users = (await db.execute(select(User).where(User.id.in_(student_ids)))).scalars().all()
        return sorted({first_name(u) for u in users})[:30]

    async def _save_part(
        self, session_id: UUID, event: PartWritten, *, start: int
    ) -> list[dict[str, Any]]:
        planned = [_prefixed(s, start + i).as_dict() for i, s in enumerate(event.segments)]
        async with self._session_maker() as db:
            rows = await LiveSessionService(db).append_segments(session_id, planned, start=start)
            await db.commit()
            return [
                {"id": str(r.id), "position": r.position, **p}
                for r, p in zip(rows, planned, strict=True)
            ]

    async def _everything_said(self, session_id: UUID) -> list[str]:
        async with self._session_maker() as db:
            service = LiveSessionService(db)
            live = await db.get(LiveSession, session_id)
            if live is None:
                return []
            said: list[str] = []
            for segment in await service.segments(session_id):
                for beat in segment.beats:
                    said += beat.get("sentences") or [beat.get("say", "")]
            for name in await self._names(db, await service.audience(live)):
                lines = student_lines(session_id, name)
                said += [lines.call, lines.thanks, lines.redirect]
        return list(dict.fromkeys(t for t in said if t and t.strip()))

    async def _voice(self, session_id: UUID) -> tuple[str, float]:
        async with self._session_maker() as db:
            live = await db.get(LiveSession, session_id)
            chosen = (live.settings.get("voice") or {}) if live else {}
        voice = chosen.get("voice") or self._settings.speech_voice
        if voice not in self._settings.speech_voice_list:
            voice = self._settings.speech_voice
        return voice, float(chosen.get("speed") or self._settings.speech_speed)

    async def _mark(self, session_id: UUID, status: str, failure: str | None) -> None:
        try:
            async with self._session_maker() as db:
                live = await db.get(LiveSession, session_id)
                if live is not None and live.status not in ("cancelled",):
                    live.status, live.failure = status, failure
                    await db.commit()
        except Exception:
            logger.exception("could not mark live session %s %s", session_id, status)


def _prefixed(segment: PlannedSegment, position: int) -> PlannedSegment:
    """Beat ids unique across the whole lesson: `s<position>b<n>`."""
    beats = tuple(
        Beat(id=f"s{position}b{n}", say=b.say, show=b.show, pause=b.pause)
        for n, b in enumerate(segment.beats, start=1)
    )
    return replace(segment, beats=beats)
