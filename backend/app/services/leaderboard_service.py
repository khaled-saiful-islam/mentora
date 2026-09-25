"""A quiz's leaderboard: first tries only, ties share a place.

The first completed attempt is what counts, so retakes can improve a score
but not a place. A student sees the top ten and their own row — never the
bottom of the list; the teacher sees everyone. When the quiz is closed or
past due, the podium is final and its medals are awarded, once.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models.attempt import Attempt
from app.db.models.learning import Assignment
from app.db.models.user import User
from app.events.bus import EventBus
from app.policies.access import assignment_for_student
from app.services.badge_service import BadgeService

TOP = 10


@dataclass(frozen=True, slots=True)
class Entry:
    rank: int
    student_id: UUID
    name: str
    buddy: str | None
    percent: float
    duration_ms: int
    you: bool


@dataclass(frozen=True, slots=True)
class Board:
    enabled: bool
    final: bool
    entries: list[Entry]
    you: Entry | None
    total: int


class LeaderboardService:
    def __init__(self, session: AsyncSession, bus: EventBus) -> None:
        self._session = session
        self._bus = bus

    async def for_viewer(self, viewer: User, assignment_id: UUID) -> Board:
        assignment = await self._reachable(viewer, assignment_id)
        if not assignment.leaderboard_enabled:
            return Board(enabled=False, final=False, entries=[], you=None, total=0)
        ranked = await self.ranked(assignment, viewer.id)
        final = await self.settle(assignment, ranked)
        you = next((e for e in ranked if e.you), None)
        shown = ranked if assignment.teacher_id == viewer.id or viewer.is_admin else ranked[:TOP]
        return Board(enabled=True, final=final, entries=shown, you=you, total=len(ranked))

    async def ranked(self, assignment: Assignment, viewer_id: UUID | None = None) -> list[Entry]:
        rows = await self._session.execute(
            select(Attempt, User)
            .join(User, User.id == Attempt.student_id)
            .where(
                Attempt.assignment_id == assignment.id,
                Attempt.number == 1,
                Attempt.status == "completed",
            )
            .order_by(Attempt.percent.desc(), Attempt.completed_at)
        )
        entries: list[Entry] = []
        previous: float | None = None
        rank = 0
        for position, (attempt, user) in enumerate(rows.all(), start=1):
            percent = float(attempt.percent)
            if percent != previous:
                rank, previous = position, percent  # ties share a place: 1, 1, 3
            entries.append(
                Entry(
                    rank=rank,
                    student_id=user.id,
                    name=(user.display_name or user.sign_in_name).split()[0],
                    buddy=user.buddy,
                    percent=percent,
                    duration_ms=attempt.duration_ms,
                    you=user.id == viewer_id,
                )
            )
        return entries

    async def settle(self, assignment: Assignment, ranked: list[Entry]) -> bool:
        """Award the podium if the quiz is over. True once it is final."""
        over = assignment.closed_at is not None or (
            assignment.due_at is not None and assignment.due_at <= datetime.now(UTC)
        )
        if over and ranked:
            await BadgeService(self._session, self._bus).finalize_podium(
                assignment, [(e.student_id, e.rank) for e in ranked]
            )
        return over

    async def _reachable(self, viewer: User, assignment_id: UUID) -> Assignment:
        if viewer.is_student:
            found = await assignment_for_student(self._session, viewer.id, assignment_id)
        else:
            found = await self._session.get(Assignment, assignment_id)
            if found is not None and found.teacher_id != viewer.id and not viewer.is_admin:
                found = None
        if found is None:
            raise NotFoundError("No such quiz.")
        return found
