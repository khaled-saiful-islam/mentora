"""A teacher's home screen in one request: their classes, who is waiting to
join, what they shared lately and how it is going, and how many students are
working on something of theirs right now."""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.attempt import Attempt, AttemptAnswer
from app.db.models.classroom import Classroom
from app.db.models.learning import Assignment
from app.events.bus import EventBus
from app.services.assignment_service import AssignmentService
from app.services.class_service import ClassService, ClassSummary

RECENT = 6
# Answered within this long: working on it now.
LIVE_WINDOW = timedelta(minutes=5)


@dataclass(frozen=True, slots=True)
class RecentShare:
    assignment: Assignment
    class_name: str
    audience: int
    completed: int
    in_progress: int
    average: float | None


@dataclass(frozen=True, slots=True)
class TeachingHome:
    classes: list[ClassSummary]
    pending: int
    recent: list[RecentShare]
    live_now: int


class TeachingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def overview(self, teacher_id: UUID) -> TeachingHome:
        classes = await ClassService(self._session).list_for(teacher_id)
        return TeachingHome(
            classes=classes,
            pending=sum(c.pending for c in classes),
            recent=await self._recent(teacher_id),
            live_now=await self._live_now(teacher_id),
        )

    async def _recent(self, teacher_id: UUID) -> list[RecentShare]:
        rows = await self._session.execute(
            select(Assignment, Classroom.name)
            .join(Classroom, Classroom.id == Assignment.class_id)
            .where(Assignment.teacher_id == teacher_id, Classroom.archived_at.is_(None))
            .order_by(Assignment.created_at.desc())
            .limit(RECENT)
        )
        pairs = list(rows.all())
        stats = await self._stats([a.id for a, _ in pairs])
        audiences = AssignmentService(self._session, EventBus())
        shares = []
        for assignment, class_name in pairs:
            completed, running, firsts = stats.get(assignment.id, (0, 0, []))
            shares.append(
                RecentShare(
                    assignment=assignment,
                    class_name=class_name,
                    audience=len(await audiences.audience(assignment)),
                    completed=completed,
                    in_progress=running,
                    average=round(statistics.fmean(firsts), 1) if firsts else None,
                )
            )
        return shares

    async def _stats(self, ids: list[UUID]) -> dict[UUID, tuple[int, int, list[float]]]:
        """Per assignment: students finished, students still going, and the
        first-try scores."""
        if not ids:
            return {}
        rows = await self._session.execute(
            select(Attempt.assignment_id, Attempt.student_id, Attempt.status, Attempt.number,
                   Attempt.percent)
            .where(Attempt.assignment_id.in_(ids))
        )  # fmt: skip
        finished: dict[UUID, set[UUID]] = {}
        running: dict[UUID, set[UUID]] = {}
        firsts: dict[UUID, list[float]] = {}
        for assignment_id, student_id, status, number, percent in rows.all():
            if status == "completed":
                finished.setdefault(assignment_id, set()).add(student_id)
                if number == 1:
                    firsts.setdefault(assignment_id, []).append(float(percent))
            else:
                running.setdefault(assignment_id, set()).add(student_id)
        return {
            i: (
                len(finished.get(i, set())),
                len(running.get(i, set()) - finished.get(i, set())),
                firsts.get(i, []),
            )
            for i in ids
        }

    async def _live_now(self, teacher_id: UUID) -> int:
        since = datetime.now(UTC) - LIVE_WINDOW
        return int(
            await self._session.scalar(
                select(func.count(func.distinct(Attempt.student_id)))
                .join(AttemptAnswer, AttemptAnswer.attempt_id == Attempt.id)
                .join(Assignment, Assignment.id == Attempt.assignment_id)
                .where(
                    Assignment.teacher_id == teacher_id,
                    Attempt.status == "in_progress",
                    AttemptAnswer.answered_at >= since,
                )
            )
            or 0
        )
