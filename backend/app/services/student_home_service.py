"""A student's own view: what is waiting, what is done, and how they are going.

The home screen is one request — to-do cards, recent results, badge count,
a streak of days, and the skills worth a buddy's tip — because a child's
first screen should not be a waterfall of spinners.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.attempt import Attempt, StudentBadge
from app.db.models.classroom import Classroom
from app.db.models.learning import Assignment, LearningSetVersion
from app.db.models.user import User
from app.policies.access import visible_to


@dataclass(frozen=True, slots=True)
class TodoCard:
    assignment: Assignment
    class_name: str
    class_theme: str
    item_count: int
    status: str  # todo | in_progress | done | closed
    best: float | None
    attempts: int


class StudentHomeService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def assignments(self, student: User) -> list[TodoCard]:
        rows = await self._session.execute(
            select(Assignment, Classroom)
            .join(Classroom, Classroom.id == Assignment.class_id)
            .where(visible_to(student.id), Classroom.archived_at.is_(None))
            .order_by(Assignment.created_at.desc())
        )
        pairs = list(rows.all())
        mine = await self._attempts(student.id, [a.id for a, _ in pairs])
        counts = await self._item_counts([(a.set_id, a.version) for a, _ in pairs])
        return [
            _card(
                assignment,
                room,
                mine.get(assignment.id, []),
                counts.get((assignment.set_id, assignment.version), 0),
            )
            for assignment, room in pairs
        ]

    async def home(self, student: User) -> dict[str, Any]:
        cards = await self.assignments(student)
        todo = [c for c in cards if c.status in ("todo", "in_progress")]
        todo.sort(
            key=lambda c: (
                c.status != "in_progress",
                c.assignment.due_at or datetime.max.replace(tzinfo=UTC),
            )
        )
        badges = int(
            await self._session.scalar(
                select(func.count()).where(StudentBadge.student_id == student.id)
            )
            or 0
        )
        return {
            "todo": todo,
            "done": [c for c in cards if c.status == "done"][:4],
            "badges": badges,
            "streak": await self._streak(student.id),
        }

    async def _attempts(
        self, student_id: UUID, assignment_ids: list[UUID]
    ) -> dict[UUID, list[Attempt]]:
        if not assignment_ids:
            return {}
        found = (
            (
                await self._session.execute(
                    select(Attempt)
                    .where(
                        Attempt.student_id == student_id, Attempt.assignment_id.in_(assignment_ids)
                    )
                    .order_by(Attempt.number)
                )
            )
            .scalars()
            .all()
        )
        grouped: dict[UUID, list[Attempt]] = {}
        for attempt in found:
            grouped.setdefault(attempt.assignment_id, []).append(attempt)
        return grouped

    async def _item_counts(self, keys: list[tuple[UUID, int]]) -> dict[tuple[UUID, int], int]:
        if not keys:
            return {}
        set_ids = {k[0] for k in keys}
        rows = await self._session.execute(
            select(
                LearningSetVersion.set_id,
                LearningSetVersion.version,
                func.jsonb_array_length(LearningSetVersion.items),
            ).where(LearningSetVersion.set_id.in_(set_ids))
        )
        return {(s, v): int(n) for s, v, n in rows.all()}

    async def _streak(self, student_id: UUID) -> int:
        """Days in a row, up to today or yesterday, with something finished."""
        days = (
            (
                await self._session.execute(
                    select(func.date(Attempt.completed_at))
                    .where(Attempt.student_id == student_id, Attempt.status == "completed")
                    .distinct()
                    .order_by(func.date(Attempt.completed_at).desc())
                    .limit(60)
                )
            )
            .scalars()
            .all()
        )
        today = datetime.now(UTC).date()
        expected = today if days and days[0] == today else today - timedelta(days=1)
        streak = 0
        for day in days:
            if day != expected:
                break
            streak += 1
            expected -= timedelta(days=1)
        return streak


def _card(assignment: Assignment, room: Classroom, attempts: list[Attempt], items: int) -> TodoCard:
    completed = [a for a in attempts if a.status == "completed"]
    if completed:
        status = "done"
    elif attempts:
        status = "in_progress"
    elif assignment.closed_at is not None:
        status = "closed"
    else:
        status = "todo"
    return TodoCard(
        assignment=assignment,
        class_name=room.name,
        class_theme=room.theme,
        item_count=items,
        status=status,
        best=max(float(a.percent) for a in completed) if completed else None,
        attempts=len(completed),
    )
