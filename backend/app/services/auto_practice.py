"""Practice made for a student from what they found hard.

When a student finishes a quiz or deck their teacher shared, the skills they
got mostly wrong are practised in a small set made just for them: grounded in
the same sources, tagged by the same skills, so their results land where the
weakness showed. Their buddy tells them it is ready, and it waits on their
home page under "Made for you".

Kept small and polite:
- One per student per assignment, so a retake never makes another.
- At most `PER_DAY` a day.
- Never counted against the practice students make themselves.
- Built after the attempt has committed, in its own task, so finishing a
  quiz is never slowed by it and a failure is only logged.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.core.config import get_settings
from app.db.models.attempt import Attempt, AttemptAnswer
from app.db.models.learning import Assignment, AutoPractice, LearningSet, LearningSetVersion
from app.db.models.user import User
from app.db.session import session_scope
from app.events.catalog import AttemptCompleted, PracticeMade
from app.learning.factory import build_generator
from app.learning.generator import GenerationRequest
from app.learning.registry import build_learning_kinds
from app.learning.research import Source
from app.policies.capabilities import capabilities_for
from app.services.generation_service import GenerationDraft, GenerationService

logger = logging.getLogger(__name__)

# Under this share right, a skill is a weak spot worth practising.
WEAK_BELOW = 0.6
# Weak spots practised in one set, the weakest first.
MOST_SKILLS = 3
PER_DAY = 3
COUNT = 5
DAY = timedelta(hours=24)
# What each shared kind is practised with.
PRACTISED_AS = {"quiz": "quiz", "flashcard": "flashcard"}
MOST_SOURCES = 8


@dataclass(frozen=True, slots=True)
class PracticePlan:
    student_id: UUID
    assignment_id: UUID
    kind: str
    # The shared set it grew from, by name.
    from_title: str
    topic: str
    subject: str | None
    grade_level: str | None
    language: str
    skills: tuple[tuple[str, str], ...]
    sources: tuple[Source, ...]


@dataclass(frozen=True, slots=True)
class MadeForYou:
    set_id: UUID
    kind: str
    title: str
    skills: tuple[str, ...]
    from_title: str
    done: bool
    created_at: datetime


def weak_skills(
    answers: Iterable[tuple[str, bool]], labels: dict[str, str]
) -> tuple[tuple[str, str], ...]:
    """The skills answered mostly wrong, weakest first, as (slug, label)."""
    tally: dict[str, list[int]] = {}
    for skill, correct in answers:
        counts = tally.setdefault(skill, [0, 0])
        counts[0] += 1 if correct else 0
        counts[1] += 1
    weak = [
        (right / total, slug)
        for slug, (right, total) in tally.items()
        if total and right / total < WEAK_BELOW
    ]
    weak.sort()
    return tuple((slug, labels.get(slug, slug.replace("-", " "))) for _, slug in weak[:MOST_SKILLS])


def practice_topic(skills: tuple[tuple[str, str], ...], topic: str) -> str:
    """ "Evaporation and condensation, from The Water Cycle" """
    labels = [label for _, label in skills]
    named = labels[0] if len(labels) == 1 else ", ".join(labels[:-1]) + " and " + labels[-1]
    return f"{named}, from {topic}"[:200]


class AutoPracticeService:
    def __init__(self, session: AsyncSession, *, clock: Clock = utc_now) -> None:
        self._session = session
        self._clock = clock

    async def plan(self, event: AttemptCompleted) -> PracticePlan | None:
        """What to practise after this attempt — or None: not a shared set,
        not a student, nothing weak, already made, or enough for today."""
        if event.assignment_id is None or event.kind not in PRACTISED_AS:
            return None
        student = await self._session.get(User, event.student_id)
        if student is None or not capabilities_for(student.role).make_practice_sets:
            return None
        if await self._already(event.student_id, event.assignment_id):
            return None
        assignment = await self._session.get(Assignment, event.assignment_id)
        learning_set = await self._session.get(LearningSet, event.set_id)
        if assignment is None or learning_set is None:
            return None
        version = await self._version(assignment)
        labels = {s["slug"]: s["label"] for s in (version.skills if version else [])}
        skills = weak_skills(await self._answers(event.attempt_id), labels)
        if not skills:
            return None
        return PracticePlan(
            student_id=student.id,
            assignment_id=assignment.id,
            kind=PRACTISED_AS[event.kind],
            from_title=assignment.title,
            topic=practice_topic(skills, learning_set.topic),
            subject=learning_set.subject,
            grade_level=student.grade_level or learning_set.grade_level,
            language=learning_set.language,
            skills=skills,
            sources=_sources(version.sources if version else []),
        )

    async def made_for(self, student_id: UUID, *, limit: int = 6) -> list[MadeForYou]:
        """Ready practice made for this student, newest first."""
        rows = await self._session.execute(
            select(AutoPractice, LearningSet, Assignment.title)
            .join(LearningSet, LearningSet.id == AutoPractice.set_id)
            .join(Assignment, Assignment.id == AutoPractice.assignment_id)
            .where(
                AutoPractice.student_id == student_id,
                AutoPractice.status == "ready",
                LearningSet.archived_at.is_(None),
            )
            .order_by(AutoPractice.created_at.desc())
            .limit(limit)
        )
        found = list(rows.all())
        done = await self._done(student_id, [s.id for _, s, _ in found])
        return [
            MadeForYou(
                set_id=learning_set.id,
                kind=learning_set.kind,
                title=learning_set.title,
                skills=tuple(s["label"] for s in row.skills),
                from_title=from_title,
                done=learning_set.id in done,
                created_at=row.created_at,
            )
            for row, learning_set, from_title in found
        ]

    # --- lookups --------------------------------------------------------------

    async def _already(self, student_id: UUID, assignment_id: UUID) -> bool:
        mine = AutoPractice.student_id == student_id
        exists_for = await self._session.scalar(
            select(func.count()).where(mine, AutoPractice.assignment_id == assignment_id)
        )
        if exists_for:
            return True
        today = await self._session.scalar(
            select(func.count()).where(mine, AutoPractice.created_at >= self._clock() - DAY)
        )
        return int(today or 0) >= PER_DAY

    async def _version(self, assignment: Assignment) -> LearningSetVersion | None:
        return await self._session.scalar(
            select(LearningSetVersion).where(
                LearningSetVersion.set_id == assignment.set_id,
                LearningSetVersion.version == assignment.version,
            )
        )

    async def _answers(self, attempt_id: UUID) -> list[tuple[str, bool]]:
        rows = await self._session.execute(
            select(AttemptAnswer.skill, AttemptAnswer.correct).where(
                AttemptAnswer.attempt_id == attempt_id
            )
        )
        return [(skill, bool(correct)) for skill, correct in rows.all()]

    async def _done(self, student_id: UUID, set_ids: list[UUID]) -> set[UUID]:
        if not set_ids:
            return set()
        rows = await self._session.scalars(
            select(Attempt.set_id).where(
                Attempt.student_id == student_id,
                Attempt.set_id.in_(set_ids),
                Attempt.status == "completed",
            )
        )
        return set(rows.all())


def _sources(raw: list[dict[str, Any]]) -> tuple[Source, ...]:
    return tuple(
        Source(
            id=str(s.get("id", "")),
            title=str(s.get("title", "")),
            url=str(s.get("url", "")),
            host=str(s.get("host", "")),
            excerpt=str(s.get("excerpt", "")),
            published=str(s.get("published", "")),
        )
        for s in raw[:MOST_SOURCES]
        if s.get("id") and s.get("excerpt")
    )


# --- making it ------------------------------------------------------------------


async def make_practice(plan: PracticePlan, generation: GenerationService) -> None:
    """Make the set and tell the student. Runs in its own task, after the
    attempt committed; it never raises — a practice set that could not be
    made is logged, and nobody is told about something they did not ask for."""
    try:
        made = await _begin(plan, generation)
        if made is None:
            return
        row_id, set_id = made
        request = GenerationRequest(
            kind=plan.kind,
            topic=plan.topic,
            subject=plan.subject,
            grade_level=plan.grade_level,
            count=COUNT,
            language=plan.language,
            sources=plan.sources,
            skills=plan.skills,
        )
        outcome: dict[str, Any] = {}
        async for event in generation.events(set_id, request):
            if event.get("type") in ("done", "failed", "refused"):
                outcome = event
        await _finish(plan, row_id, set_id, outcome)
    except Exception:
        logger.exception("auto-practice for %s failed", plan.student_id)


async def _begin(plan: PracticePlan, generation: GenerationService) -> tuple[UUID, UUID] | None:
    async with session_scope() as db:
        student = await db.get(User, plan.student_id)
        if student is None:
            return None
        row = AutoPractice(
            student_id=plan.student_id,
            assignment_id=plan.assignment_id,
            skills=[{"slug": slug, "label": label} for slug, label in plan.skills],
        )
        db.add(row)
        try:
            await db.flush()
        except IntegrityError:
            # Another finish of the same assignment got here first.
            await db.rollback()
            return None
        draft = GenerationDraft(
            kind=plan.kind,
            topic=plan.topic,
            subject=plan.subject,
            grade_level=plan.grade_level,
            count=COUNT,
            language=plan.language,
        )
        learning_set = await generation.begin(db, student, draft, made_for=True)
        row.set_id = learning_set.id
        return row.id, learning_set.id


async def _finish(plan: PracticePlan, row_id: UUID, set_id: UUID, outcome: dict[str, Any]) -> None:
    # Late: the bus's registry imports the subscriber that imports this.
    from app.events.registry import build_bus

    ready = outcome.get("type") == "done"
    async with session_scope() as db:
        row = await db.get(AutoPractice, row_id)
        if row is None:
            return
        row.status = "ready" if ready else "failed"
        if not ready:
            logger.info("auto-practice set %s not made: %s", set_id, outcome.get("message"))
            return
        student = await db.get(User, plan.student_id)
        await build_bus().publish(
            PracticeMade(
                student_id=plan.student_id,
                set_id=set_id,
                kind=plan.kind,
                title=str(outcome.get("title") or plan.topic),
                skills=tuple(label for _, label in plan.skills),
                count=int(outcome.get("count") or COUNT),
                from_title=plan.from_title,
                buddy=(student.buddy if student else None) or "",
            ),
            db,
        )


def build_generation() -> GenerationService:
    """The same generation service a request gets, for work outside one."""
    settings = get_settings()
    return GenerationService(
        kinds=build_learning_kinds(),
        settings=settings,
        session_maker=session_scope,
        generator_factory=lambda kind, meter: build_generator(settings, kind, meter),
    )
