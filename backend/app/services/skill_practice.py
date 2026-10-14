"""Practice on one skill, made on a grown-up's word (§28.3.3).

- **A parent's challenge**: the skill they tapped on their child's page, at
  the child's year, grounded in the child's own latest work on it, sent home
  the moment it is ready ("Mum sent you a challenge!").
- **A teacher's practice for these students**: the skill the class heatmap
  shows red, grounded in the assignment's own sources, shared with just the
  students who found it hard, as a group.

Both are begun inside the request, so a limit or a refusal is said at once;
the build runs after it commits, in its own task, and what follows a build
(sending home, sharing) runs only if it was made. Like "Made for you"
(`auto_practice.py`), a set that could not be made is logged, never raised.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models.attempt import Attempt, AttemptAnswer
from app.db.models.learning import LearningSet, LearningSetVersion
from app.db.models.user import User
from app.db.session import session_scope
from app.learning.generator import GenerationRequest
from app.learning.research import Source
from app.services.auto_practice import COUNT, MOST_SOURCES, practice_topic
from app.services.generation_service import GenerationDraft, GenerationService

logger = logging.getLogger(__name__)

# Given a fresh session and the build's last event; runs only when it was made.
Deliver = Callable[[AsyncSession, UUID, dict[str, Any]], Awaitable[None]]


@dataclass(frozen=True, slots=True)
class SkillPractice:
    topic: str
    subject: str | None
    grade_level: str | None
    language: str
    skills: tuple[tuple[str, str], ...]
    sources: tuple[Source, ...]

    def draft(self) -> GenerationDraft:
        return GenerationDraft(
            kind="quiz",
            topic=self.topic,
            subject=self.subject,
            grade_level=self.grade_level,
            count=COUNT,
            language=self.language,
        )

    def request(self) -> GenerationRequest:
        return GenerationRequest(
            kind="quiz",
            topic=self.topic,
            subject=self.subject,
            grade_level=self.grade_level,
            count=COUNT,
            language=self.language,
            sources=self.sources,
            skills=self.skills,
        )


async def from_child_work(session: AsyncSession, child: User, slug: str) -> SkillPractice:
    """The skill as the child last met it: that set's topic and sources."""
    found = (
        await session.execute(
            select(Attempt.set_id, Attempt.version)
            .join(AttemptAnswer, AttemptAnswer.attempt_id == Attempt.id)
            .where(
                Attempt.student_id == child.id,
                Attempt.status == "completed",
                AttemptAnswer.skill == slug,
            )
            .order_by(Attempt.completed_at.desc())
            .limit(1)
        )
    ).first()
    if found is None:
        raise NotFoundError("That skill isn't in your child's work yet.")
    learning_set, version = await _set(session, found.set_id, found.version)
    return _plan(learning_set, version, slug, grade=child.grade_level)


async def from_set(session: AsyncSession, set_id: UUID, version: int, slug: str) -> SkillPractice:
    """The skill as an assignment taught it: its set's topic and sources."""
    learning_set, found = await _set(session, set_id, version)
    return _plan(learning_set, found, slug, grade=learning_set.grade_level)


async def begin(
    session: AsyncSession, owner: User, plan: SkillPractice, generation: GenerationService
) -> LearningSet:
    """The set's row, inside the request: limits and refusals are said now."""
    return await generation.begin(session, owner, plan.draft())


async def build_then(
    set_id: UUID, plan: SkillPractice, generation: GenerationService, deliver: Deliver
) -> None:
    """Make the set, then deliver it if it was made. Never raises."""
    try:
        outcome: dict[str, Any] = {}
        async for event in generation.events(set_id, plan.request()):
            if event.get("type") in ("done", "failed", "refused"):
                outcome = event
        if outcome.get("type") != "done":
            logger.info("skill practice %s not made: %s", set_id, outcome.get("message"))
            return
        async with session_scope() as db:
            await deliver(db, set_id, outcome)
    except Exception:
        logger.exception("skill practice %s failed", set_id)


async def _set(
    session: AsyncSession, set_id: UUID, version: int
) -> tuple[LearningSet, LearningSetVersion | None]:
    learning_set = await session.get(LearningSet, set_id)
    if learning_set is None:
        raise NotFoundError("That work is no longer there.")
    found = await session.scalar(
        select(LearningSetVersion).where(
            LearningSetVersion.set_id == set_id, LearningSetVersion.version == version
        )
    )
    return learning_set, found


def _plan(
    learning_set: LearningSet, version: LearningSetVersion | None, slug: str, *, grade: str | None
) -> SkillPractice:
    labels = {s["slug"]: s["label"] for s in (version.skills if version else [])}
    label = labels.get(slug) or slug.replace("-", " ")
    skills = ((slug, label),)
    return SkillPractice(
        topic=practice_topic(skills, learning_set.topic),
        subject=learning_set.subject,
        grade_level=grade or learning_set.grade_level,
        language=learning_set.language,
        skills=skills,
        sources=_sources(version.sources if version else []),
    )


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
    )
