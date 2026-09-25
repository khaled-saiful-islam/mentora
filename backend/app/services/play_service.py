"""Finishing an attempt, and everything that follows from it.

One call, one transaction: the attempt is marked, badges are awarded, the
leaderboard place is worked out, and the teacher and the class are told —
so the celebration screen gets everything it shows in one reply.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.classroom import Classroom
from app.db.models.user import User
from app.events.bus import EventBus
from app.events.catalog import AttemptCompleted
from app.services.assignment_service import AssignmentService
from app.services.attempt_service import AttemptService, AttemptView, Loaded
from app.services.badge_service import BadgeService, Earned
from app.services.leaderboard_service import Entry, LeaderboardService


@dataclass(frozen=True, slots=True)
class SkillScore:
    slug: str
    label: str
    correct: int
    total: int


@dataclass(frozen=True, slots=True)
class Finished:
    view: AttemptView
    stars: int
    skills: list[SkillScore]
    badges: list[Earned]
    rank: Entry | None
    ranked: int


def stars_for(percent: float) -> int:
    if percent >= 90:
        return 3
    if percent >= 70:
        return 2
    return 1 if percent >= 40 else 0


class PlayService:
    def __init__(self, session: AsyncSession, bus: EventBus) -> None:
        self._session = session
        self._bus = bus
        self._attempts = AttemptService(session)

    async def finish(self, student: User, attempt_id: UUID) -> Finished:
        already = (await self._attempts.view(student.id, attempt_id)).attempt.status == "completed"
        loaded = await self._attempts.complete(student.id, attempt_id)
        badges: list[Earned] = []
        if not already:
            practice = await self._attempts.completed_count(student.id, "practice")
            badges = await BadgeService(self._session, self._bus).after_attempt(loaded, practice)
        rank, ranked = await self._place(loaded, student.id)
        if not already:
            await self._announce(student, loaded)
        view = await self._attempts.view(student.id, attempt_id)
        return Finished(
            view=view,
            stars=stars_for(float(loaded.attempt.percent)),
            skills=_skills(view),
            badges=badges,
            rank=rank,
            ranked=ranked,
        )

    async def _place(self, loaded: Loaded, student_id: UUID) -> tuple[Entry | None, int]:
        assignment = loaded.assignment
        if assignment is None or not assignment.leaderboard_enabled or loaded.kind.name != "quiz":
            return None, 0
        board = LeaderboardService(self._session, self._bus)
        ranked = await board.ranked(assignment, student_id)
        await board.settle(assignment, ranked)
        return next((e for e in ranked if e.you), None), len(ranked)

    async def _announce(self, student: User, loaded: Loaded) -> None:
        assignment = loaded.assignment
        audience: tuple[UUID, ...] = ()
        class_name = None
        if assignment is not None:
            audience = tuple(await AssignmentService(self._session, self._bus).audience(assignment))
            classroom = await self._session.get(Classroom, assignment.class_id)
            class_name = classroom.name if classroom else None
        await self._bus.publish(
            AttemptCompleted(
                attempt_id=loaded.attempt.id,
                student_id=student.id,
                student_name=student.display_name or student.sign_in_name,
                set_id=loaded.learning_set.id,
                title=loaded.learning_set.title,
                kind=loaded.kind.name,
                percent=float(loaded.attempt.percent),
                assignment_id=assignment.id if assignment else None,
                teacher_id=assignment.teacher_id if assignment else None,
                class_name=class_name,
                audience=audience,
                leaderboard=bool(
                    assignment and assignment.leaderboard_enabled and loaded.kind.name == "quiz"
                ),
            ),
            self._session,
        )


def _skills(view: AttemptView) -> list[SkillScore]:
    labels = {s["slug"]: s["label"] for s in view.skills}
    by_item = {item["id"]: item.get("skill", "general") for item in view.items}
    tally: dict[str, list[int]] = {}
    for played in view.answered:
        slug = by_item.get(played.item_id, "general")
        counts = tally.setdefault(slug, [0, 0])
        counts[1] += 1
        if played.correct:
            counts[0] += 1
    return [SkillScore(slug, labels.get(slug, slug), c, t) for slug, (c, t) in tally.items()]
