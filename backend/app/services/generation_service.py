"""Starting a build, running it as a job, and keeping what it made.

`begin` validates the request and writes the set as *generating* — so it is in
the library at once and survives a reload — then the route starts the job
after that row is committed. The job translates the generator's updates into
plain JSON events for the panel, and saves the result (or the reason it could
not be made) with its own session.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ForbiddenError, RateLimitError, ValidationError
from app.core.grades import is_grade
from app.db.models.learning import LearningSet
from app.db.models.user import User
from app.learning.base import LearningKind, Skill
from app.learning.generator import (
    Built,
    GenerationRequest,
    ItemsReady,
    LearningGenerator,
    Refused,
    SkillsMapped,
    SourcesFound,
    Stage,
    Update,
)
from app.learning.model import GenerationUnavailable, Meter
from app.learning.research import Source
from app.policies.capabilities import capabilities_for
from app.services.learning_set_service import LearningSetService

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], Any]
GeneratorFactory = Callable[[LearningKind, Meter], LearningGenerator]


@dataclass(frozen=True, slots=True)
class GenerationDraft:
    kind: str
    topic: str
    subject: str | None = None
    grade_level: str | None = None
    count: int | None = None
    language: str = "en"


class GenerationService:
    def __init__(
        self,
        *,
        kinds: dict[str, LearningKind],
        settings: Settings,
        session_maker: SessionMaker,
        generator_factory: GeneratorFactory,
    ) -> None:
        self._kinds = kinds
        self._settings = settings
        self._session_maker = session_maker
        self._make_generator = generator_factory

    async def begin(
        self, session: AsyncSession, owner: User, draft: GenerationDraft
    ) -> LearningSet:
        kind = self._kind(draft.kind)
        purpose = await self._purpose(session, owner)
        request = self._request(kind, draft)
        learning_set = LearningSet(
            owner_id=owner.id,
            purpose=purpose,
            kind=kind.name,
            title=request.topic[:200],
            subject=request.subject,
            topic=request.topic,
            grade_level=request.grade_level,
            language=request.language,
            status="generating",
            requested_count=request.count,
        )
        session.add(learning_set)
        await session.flush()
        return learning_set

    def request_for(self, learning_set: LearningSet) -> GenerationRequest:
        return GenerationRequest(
            kind=learning_set.kind,
            topic=learning_set.topic,
            subject=learning_set.subject,
            grade_level=learning_set.grade_level,
            count=learning_set.requested_count,
            language=learning_set.language,
        )

    async def events(
        self, set_id: UUID, request: GenerationRequest
    ) -> AsyncIterator[dict[str, Any]]:
        """The job's body: run the generator, keep the outcome, say what happened."""
        meter = Meter()
        generator = self._make_generator(self._kinds[request.kind], meter)
        try:
            async for update in generator.run(request):
                event = await self._handle(set_id, update)
                if event is not None:
                    yield event
        except GenerationUnavailable as exc:
            await self._keep_status(set_id, "failed", str(exc))
            yield {"type": "failed", "message": str(exc)}
        except Exception:
            logger.exception("building set %s failed", set_id)
            message = "Something went wrong while making this set. Please try again."
            await self._keep_status(set_id, "failed", message)
            yield {"type": "failed", "message": message}

    async def _handle(self, set_id: UUID, update: Update) -> dict[str, Any] | None:
        if isinstance(update, Built):
            async with self._session_maker() as session:
                saved = await LearningSetService(session, self._kinds).save_build(
                    set_id, update.result
                )
                title = saved.title
            return {
                "type": "done",
                "set_id": str(set_id),
                "title": title,
                "count": len(update.result.items),
                "requested": update.result.requested,
                "grounded": update.result.grounded,
            }
        if isinstance(update, Refused):
            await self._keep_status(set_id, "refused", update.message)
            return {"type": "refused", "message": update.message}
        return _event(update)

    async def _keep_status(self, set_id: UUID, status: str, failure: str) -> None:
        try:
            async with self._session_maker() as session:
                await LearningSetService(session, self._kinds).mark(set_id, status, failure)
        except Exception:
            # The followers still hear why; the row is fixed by the next look.
            logger.exception("could not record %s for set %s", status, set_id)

    async def rewrite(
        self, session: AsyncSession, owner_id: UUID, set_id: UUID, item_id: str, instruction: str
    ) -> dict[str, Any]:
        """A fresh version of one item, for the editor to put in place. Not
        saved: the teacher sees it first, and saving is the editor's job."""
        sets = LearningSetService(session, self._kinds)
        learning_set = await sets.owned(owner_id, set_id)
        version = await sets.version(learning_set)
        item = next((i for i in (version.items if version else []) if i.get("id") == item_id), None)
        if version is None or item is None:
            raise ValidationError("That item isn't in this set any more — save your changes first.")
        meter = Meter()
        generator = self._make_generator(self._kinds[learning_set.kind], meter)
        fresh = await generator.rewrite(
            item=item,
            skills=tuple(Skill(s["slug"], s["label"]) for s in version.skills),
            sources=tuple(Source(**s) for s in version.sources),
            grade_level=learning_set.grade_level,
            language=learning_set.language,
            instruction=instruction,
        )
        # Spent on this set, so it counts toward the quota with the build.
        version.prompt_tokens += meter.prompt_tokens
        version.completion_tokens += meter.completion_tokens
        await session.flush()
        if fresh is None:
            raise GenerationUnavailable("Couldn't write a replacement just now. Try again?")
        return {**fresh, "id": item_id}

    # --- validation -------------------------------------------------------

    def _kind(self, name: str) -> LearningKind:
        kind = self._kinds.get(name)
        if kind is None:
            raise ValidationError(f"Pick one of: {', '.join(self._kinds)}.")
        return kind

    async def _purpose(self, session: AsyncSession, owner: User) -> str:
        caps = capabilities_for(owner.role)
        if caps.share_learning_sets:
            return "assign"
        if not caps.make_practice_sets:
            raise ForbiddenError("Your account cannot make quizzes or flashcards.")
        made = await LearningSetService(session, self._kinds).practice_made_today(owner.id)
        if made >= self._settings.student_practice_per_day:
            raise RateLimitError(
                f"You've made {made} practice sets today — that's the daily limit. "
                "Come back tomorrow!",
                retry_after=3600,
            )
        return "practice"

    def _request(self, kind: LearningKind, draft: GenerationDraft) -> GenerationRequest:
        topic = " ".join(draft.topic.split())
        if not 2 <= len(topic) <= 200:
            raise ValidationError("Tell us the topic in 2-200 characters.")
        if draft.grade_level and not is_grade(draft.grade_level):
            raise ValidationError("Pick a grade from the list.")
        count = draft.count or kind.default_count
        if not 1 <= count <= kind.max_count:
            raise ValidationError(f"Choose between 1 and {kind.max_count} {kind.item_noun_plural}.")
        languages = self._settings.supported_language_list
        language = (
            draft.language if draft.language in languages else self._settings.default_language
        )
        subject = " ".join((draft.subject or "").split())[:80] or None
        return GenerationRequest(
            kind=kind.name,
            topic=topic,
            subject=subject,
            grade_level=draft.grade_level or None,
            count=count,
            language=language,
        )


def _event(update: Update) -> dict[str, Any] | None:
    if isinstance(update, Stage):
        return {
            "type": "stage",
            "key": update.key,
            "state": update.state,
            "label": update.label,
            "detail": update.detail,
        }
    if isinstance(update, SourcesFound):
        return {
            "type": "sources",
            "sources": [
                {"id": s.id, "title": s.title, "host": s.host, "url": s.url} for s in update.sources
            ],
        }
    if isinstance(update, SkillsMapped):
        return {"type": "skills", "skills": [s.as_dict() for s in update.skills]}
    if isinstance(update, ItemsReady):
        return {"type": "items", "items": list(update.items)}
    return None
