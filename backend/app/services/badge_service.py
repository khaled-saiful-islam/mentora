"""Awarding badges: after each attempt, and once when a podium is final.

A badge is unique per student, badge and scope, so evaluating twice is safe —
the second time finds it already earned and awards nothing.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.badges.base import Award, Context, SkillTally
from app.badges.catalog import CATALOG, PODIUM, RULES
from app.db.models.attempt import Attempt, AttemptAnswer, StudentBadge
from app.db.models.learning import Assignment
from app.events.bus import EventBus
from app.events.catalog import BadgeAwarded
from app.services.attempt_service import Loaded

PODIUM_PLACES = 3


@dataclass(frozen=True, slots=True)
class Earned:
    badge: str
    name: str
    description: str
    reason: str
    scope: str


class BadgeService:
    def __init__(self, session: AsyncSession, bus: EventBus) -> None:
        self._session = session
        self._bus = bus

    async def after_attempt(self, loaded: Loaded, practice_completed: int) -> list[Earned]:
        ctx = await self._context(loaded, practice_completed)
        awards = [award for rule in RULES if (award := rule.evaluate(ctx)) is not None]
        return await self._grant(loaded.attempt.student_id, awards, loaded.attempt.assignment_id)

    async def finalize_podium(self, assignment: Assignment, podium: list[tuple[UUID, int]]) -> None:
        """Gold, silver and bronze to whoever holds places 1-3 (ties share),
        exactly once per assignment."""
        if assignment.ranks_awarded_at is not None or not assignment.leaderboard_enabled:
            return
        assignment.ranks_awarded_at = datetime.now(UTC)
        await self._session.flush()
        for student_id, rank in podium:
            if 1 <= rank <= PODIUM_PLACES:
                info = PODIUM[rank - 1]
                award = Award(info.key, str(assignment.id), f"Place {rank} on {assignment.title}")
                await self._grant(student_id, [award], assignment.id)

    async def earned(self, student_id: UUID) -> list[StudentBadge]:
        return list(
            (
                await self._session.execute(
                    select(StudentBadge)
                    .where(StudentBadge.student_id == student_id)
                    .order_by(StudentBadge.awarded_at.desc())
                )
            )
            .scalars()
            .all()
        )

    async def _grant(
        self, student_id: UUID, awards: list[Award], assignment_id: UUID | None
    ) -> list[Earned]:
        granted: list[Earned] = []
        for award in awards:
            if await self._has(student_id, award):
                continue
            self._session.add(
                StudentBadge(
                    student_id=student_id,
                    badge=award.badge,
                    scope=award.scope,
                    assignment_id=assignment_id,
                    detail={"reason": award.reason},
                )
            )
            await self._session.flush()
            info = CATALOG[award.badge]
            earned = Earned(award.badge, info.name, info.description, award.reason, award.scope)
            granted.append(earned)
            await self._bus.publish(
                BadgeAwarded(
                    student_id=student_id, badge=award.badge, name=info.name, reason=award.reason
                ),
                self._session,
            )
        return granted

    async def _has(self, student_id: UUID, award: Award) -> bool:
        return (
            await self._session.scalar(
                select(func.count()).where(
                    StudentBadge.student_id == student_id,
                    StudentBadge.badge == award.badge,
                    StudentBadge.scope == award.scope,
                )
            )
            or 0
        ) > 0

    async def _context(self, loaded: Loaded, practice_completed: int) -> Context:
        attempt = loaded.attempt
        first = None
        if attempt.number > 1:
            first = await self._session.scalar(
                select(Attempt.percent).where(
                    Attempt.student_id == attempt.student_id,
                    Attempt.set_id == attempt.set_id,
                    Attempt.assignment_id == attempt.assignment_id
                    if attempt.assignment_id
                    else Attempt.assignment_id.is_(None),
                    Attempt.number == 1,
                )
            )
        return Context(
            kind=attempt.kind,
            purpose=loaded.learning_set.purpose,
            percent=float(attempt.percent),
            best_streak=attempt.best_streak,
            number=attempt.number,
            first_percent=float(first) if first is not None else None,
            completed_at=attempt.completed_at or datetime.now(UTC),
            due_at=loaded.assignment.due_at if loaded.assignment else None,
            scope=str(attempt.assignment_id or attempt.set_id),
            practice_completed=practice_completed,
            skills=await self._skills(attempt.student_id),
            assignment_id=attempt.assignment_id,
        )

    async def _skills(self, student_id: UUID) -> tuple[SkillTally, ...]:
        rows = await self._session.execute(
            select(
                AttemptAnswer.skill,
                func.count().filter(AttemptAnswer.correct.is_(True)),
                func.count(),
                func.count(func.distinct(Attempt.set_id)),
            )
            .join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
            .where(Attempt.student_id == student_id, Attempt.status == "completed")
            .group_by(AttemptAnswer.skill)
        )
        return tuple(SkillTally(skill, int(c), int(t), int(s)) for skill, c, t, s in rows.all())
