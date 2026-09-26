"""What a live lesson leaves behind.

For the teacher, a summary: who came (and when, and for how long), every
question asked and by whom, how the group did on each quick check, and how
the quiz is going. For a student, notes: the key points of each part, and
everything that was said — Astra's words and the group's questions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.attempt import Attempt
from app.db.models.live import (
    LiveCheckinAnswer,
    LiveHand,
    LiveParticipant,
    LiveSession,
    LiveTranscriptLine,
)
from app.db.models.user import User
from app.services.live_plan_service import first_name
from app.services.live_session_service import LiveSessionService


@dataclass(frozen=True, slots=True)
class Names:
    by_id: dict[UUID, str]

    def of(self, user_id: UUID | None) -> str | None:
        return self.by_id.get(user_id) if user_id else None


class LiveSummaryService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def summary(self, live: LiveSession) -> dict[str, Any]:
        names = await self._names(live)
        return {
            "attendance": await self._attendance(live, names),
            "questions": await self._questions(live, names),
            "checkins": await self._checkins(live),
            "quiz": await self._quiz(live),
            "transcript": await self.transcript(live, names),
        }

    async def notes(self, live: LiveSession) -> dict[str, Any]:
        names = await self._names(live)
        segments = await LiveSessionService(self._db).segments(live.id)
        return {
            "title": live.title,
            "parts": [
                {"title": s.title, "subtopic": s.subtopic, "key_points": s.key_points}
                for s in segments
            ],
            "transcript": await self.transcript(live, names),
            "quiz_assignment_id": str(live.assignment_id) if live.assignment_id else None,
        }

    async def transcript(
        self, live: LiveSession, names: Names | None = None
    ) -> list[dict[str, Any]]:
        names = names or await self._names(live)
        rows = (
            (
                await self._db.execute(
                    select(LiveTranscriptLine)
                    .where(LiveTranscriptLine.session_id == live.id)
                    .order_by(LiveTranscriptLine.seq)
                )
            )
            .scalars()
            .all()
        )
        return [
            {
                "speaker": r.speaker,
                "name": names.of(r.student_id),
                "text": r.text,
                "at": r.at.isoformat(),
            }
            for r in rows
        ]

    async def _names(self, live: LiveSession) -> Names:
        ids = await LiveSessionService(self._db).audience(live)
        extra = (
            (
                await self._db.execute(
                    select(LiveParticipant.student_id).where(LiveParticipant.session_id == live.id)
                )
            )
            .scalars()
            .all()
        )
        everyone = set(ids) | set(extra)
        users = (
            (await self._db.execute(select(User).where(User.id.in_(everyone)))).scalars().all()
            if everyone
            else []
        )
        return Names({u.id: first_name(u) for u in users})

    async def _attendance(self, live: LiveSession, names: Names) -> list[dict[str, Any]]:
        audience = await LiveSessionService(self._db).audience(live)
        came = {
            p.student_id: p
            for p in (
                await self._db.execute(
                    select(LiveParticipant).where(LiveParticipant.session_id == live.id)
                )
            ).scalars()
        }
        rows = []
        for student_id in sorted(
            set(audience) | set(came), key=lambda s: (names.of(s) or "").lower()
        ):
            p = came.get(student_id)
            rows.append(
                {
                    "student_id": str(student_id),
                    "name": names.of(student_id) or "A student",
                    "came": p is not None,
                    "joined_at": p.first_joined_at.isoformat() if p else None,
                    "minutes": _minutes(p) if p else 0,
                    "removed": bool(p and p.removed_at),
                }
            )
        return rows

    async def _questions(self, live: LiveSession, names: Names) -> list[dict[str, Any]]:
        hands = (
            (
                await self._db.execute(
                    select(LiveHand)
                    .where(LiveHand.session_id == live.id)
                    .order_by(LiveHand.raised_at)
                )
            )
            .scalars()
            .all()
        )
        return [
            {
                "name": names.of(h.student_id) or "A student",
                "status": h.status,
                "question": h.question,
                "answer": h.answer,
                "raised_at": h.raised_at.isoformat(),
            }
            for h in hands
            if h.status not in ("lowered",)
        ]

    async def _checkins(self, live: LiveSession) -> list[dict[str, Any]]:
        segments = [s for s in await LiveSessionService(self._db).segments(live.id) if s.checkin]
        out = []
        for segment in segments:
            answers = (
                (
                    await self._db.execute(
                        select(LiveCheckinAnswer).where(LiveCheckinAnswer.segment_id == segment.id)
                    )
                )
                .scalars()
                .all()
            )
            options = segment.checkin.get("options") or []
            counts = [sum(1 for a in answers if a.choice == i) for i in range(len(options))]
            out.append(
                {
                    "question": segment.checkin.get("question"),
                    "options": options,
                    "answer": segment.checkin.get("answer"),
                    "counts": counts,
                    "answered": len(answers),
                    "right": sum(1 for a in answers if a.correct),
                }
            )
        return out

    async def _quiz(self, live: LiveSession) -> dict[str, Any] | None:
        if live.assignment_id is None:
            return None
        done, average = (
            await self._db.execute(
                select(func.count(), func.avg(Attempt.percent)).where(
                    Attempt.assignment_id == live.assignment_id, Attempt.status == "completed"
                )
            )
        ).one()
        return {
            "assignment_id": str(live.assignment_id),
            "completed": int(done or 0),
            "average": round(float(average), 1) if average is not None else None,
        }


def _minutes(participant: LiveParticipant) -> float:
    """Time in the room. Counted when a connection closes, which a server
    restart can skip — so never less than the span from first to last seen."""
    span = (participant.last_seen_at - participant.first_joined_at).total_seconds()
    return round(max(participant.seconds_present, span) / 60, 1)
