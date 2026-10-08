"""A game's code (§24): kept when it is built, served to whoever may play it,
and changed when its maker asks.

Serving is where the safety of §24.4 is decided, so it is one function here,
used by both routes: the newest document that passed its tests, with the
runtime and the content policy in front of it (`learning/sim/runtime.served`),
told only what this viewer's copy needs — the missions to play, the buddy's
name, the level, calm motion.

A change (*Change it*) runs in the background like a build, on its owner's
work board: the whole game rewritten, then tested exactly as a new one is. A
change that fails its tests is not kept, and the game stays as it was.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.buddies import buddy_name
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.grades import grade_for
from app.db.models.game_document import GameDocument
from app.db.models.learning import LearningSet
from app.db.models.user import User
from app.learning.base import LearningKind
from app.learning.model import GenerationUnavailable
from app.learning.sim.builder import Progress, SimBuilder, SimBuilt
from app.learning.sim.runtime import Setup, numbered, served
from app.moderation.base import Decision
from app.moderation.rules import InputRules
from app.services.attempt_service import AttemptService
from app.services.jobs import jobs
from app.services.learning_set_service import LearningSetService
from app.services.work import Ticket, work

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]

INSTRUCTION_LIMIT = 400
# A change's job id, from its set's: one change at a time per game.
_CHANGES = uuid.UUID("6f0c2a52-6a8e-4a1f-9a0d-3c1b7e2d9f40")


@dataclass(frozen=True, slots=True)
class GameStatus:
    revision: int
    built_at: datetime
    changing: bool
    # The last thing a change said: how far along, or why it was not kept.
    change: dict[str, Any] | None = None


def change_job(set_id: UUID) -> UUID:
    return uuid.uuid5(_CHANGES, str(set_id))


class GameService:
    def __init__(
        self,
        session: AsyncSession,
        kinds: dict[str, LearningKind],
        *,
        builder: SimBuilder | None = None,
        session_maker: SessionMaker | None = None,
    ) -> None:
        self._session = session
        self._kinds = kinds
        self._builder = builder
        self._session_maker = session_maker

    # --- keeping ----------------------------------------------------------------

    async def latest(self, set_id: UUID) -> GameDocument | None:
        return (
            await self._session.execute(
                select(GameDocument)
                .where(GameDocument.set_id == set_id)
                .order_by(GameDocument.revision.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    async def keep(
        self, set_id: UUID, built: SimBuilt, *, instruction: str | None = None
    ) -> GameDocument:
        last = await self._session.scalar(
            select(func.max(GameDocument.revision)).where(GameDocument.set_id == set_id)
        )
        document = GameDocument(
            set_id=set_id,
            revision=(last or 0) + 1,
            html=built.html,
            report=built.report,
            instruction=instruction,
            model=built.model,
            prompt_tokens=built.prompt_tokens,
            completion_tokens=built.completion_tokens,
            build_ms=built.build_ms,
        )
        self._session.add(document)
        await self._session.flush()
        return document

    # --- serving ------------------------------------------------------------------

    async def for_maker(self, maker: User, set_id: UUID, *, only: set[str] | None) -> str:
        """The maker's own game, to play before sharing: nothing is recorded."""
        learning_set, items = await self._game_of(maker.id, set_id)
        document = await self._document(set_id)
        setup = Setup(
            missions=numbered(items, only),
            buddy=buddy_name(maker.buddy),
            level=learning_set.level or "beginner",
            language=learning_set.language,
        )
        return served(document.html, setup)

    async def for_attempt(self, student: User, attempt_id: UUID, *, only: set[str] | None) -> str:
        """A student's game, for their own attempt only."""
        view = await AttemptService(self._session).view(student.id, attempt_id)
        if view.kind != "game":
            raise NotFoundError("This isn't a game.")
        document = await self._document(view.attempt.set_id)
        setup = Setup(
            missions=numbered(view.items, only),
            buddy=buddy_name(student.buddy),
            level=view.level or "beginner",
            language=view.language,
        )
        return served(document.html, setup)

    async def _document(self, set_id: UUID) -> GameDocument:
        document = await self.latest(set_id)
        if document is None:
            raise NotFoundError("This game has no code yet. Try making it again.")
        return document

    async def _game_of(self, owner_id: UUID, set_id: UUID) -> tuple[LearningSet, list[dict]]:
        sets = LearningSetService(self._session, self._kinds)
        learning_set = await sets.owned(owner_id, set_id)
        if not getattr(self._kinds.get(learning_set.kind), "coded", False):
            raise NotFoundError("This isn't a game.")
        version = await sets.version(learning_set)
        if version is None or learning_set.status != "ready":
            raise ValidationError("This game is still being made.")
        return learning_set, list(version.items)

    # --- changing -------------------------------------------------------------------

    async def status(self, owner_id: UUID, set_id: UUID) -> GameStatus:
        await self._game_of(owner_id, set_id)
        document = await self._document(set_id)
        job = jobs.find(change_job(set_id), owner_id)
        return GameStatus(
            revision=document.revision,
            built_at=document.created_at,
            changing=job is not None and not job.done,
            change=job.latest if job is not None else None,
        )

    async def change(self, owner: User, set_id: UUID, instruction: str) -> GameStatus:
        """Start rewriting the game the way its maker asked, in the background."""
        if self._builder is None or self._session_maker is None:
            raise ForbiddenError("Games can't be changed here yet.")
        learning_set, _ = await self._game_of(owner.id, set_id)
        asked = _instruction(instruction)
        ticket = Ticket(
            kind="game",
            title=f"Changing {learning_set.title}",
            link=f"/library/{set_id}",
            purpose=learning_set.purpose,
        )
        job_id = change_job(set_id)
        jobs.start(
            job_id,
            owner.id,
            self._changing(set_id, asked),
            watcher=work.watch(job_id, owner.id, ticket),
        )
        return await self.status(owner.id, set_id)

    async def _changing(self, set_id: UUID, instruction: str) -> AsyncIterator[dict[str, Any]]:
        """The change's job: rewrite, test, keep — each in its own session,
        because the job outlives the request that started it."""
        builder, opened = self._builder, self._session_maker
        if builder is None or opened is None:
            yield {"type": "failed", "message": "Games can't be changed here yet."}
            return
        try:
            async with opened() as session:
                html, spec = await _current(session, self._kinds, set_id)
            async for update in builder.change(html, instruction, spec):
                if isinstance(update, Progress):
                    yield _stage(update)
                    continue
                async with opened() as session:
                    kept = await GameService(session, self._kinds).keep(
                        set_id, update, instruction=instruction
                    )
                    await session.commit()
                yield {"type": "done", "set_id": str(set_id), "revision": kept.revision}
        except GenerationUnavailable as exc:
            yield {"type": "failed", "message": f"{exc} Your game is as it was."}


async def _current(
    session: AsyncSession, kinds: dict[str, LearningKind], set_id: UUID
) -> tuple[str, Any]:
    """The game as it is now, and what it was built from."""
    learning_set = await session.get(LearningSet, set_id)
    document = await GameService(session, kinds).latest(set_id)
    if learning_set is None or document is None:
        raise GenerationUnavailable("The game was deleted while it was being changed.")
    version = await LearningSetService(session, kinds).version(learning_set)
    kind = kinds[learning_set.kind]
    spec = kind.sim_spec(  # type: ignore[attr-defined]
        title=learning_set.title,
        topic=learning_set.topic,
        grade=grade_for(learning_set.grade_level),
        language=learning_set.language,
        level=learning_set.level,
        items=list(version.items) if version else [],
        extras=dict(version.extras) if version else {},
    )
    return document.html, spec


def _instruction(text: str) -> str:
    """A change in the maker's words: tidied, of a sensible length, and kind."""
    asked = " ".join((text or "").split())
    if len(asked) < 3:
        raise ValidationError("Say what to change — for example, “make the sun slider bigger”.")
    if len(asked) > INSTRUCTION_LIMIT:
        raise ValidationError(f"Keep the change under {INSTRUCTION_LIMIT} characters.")
    if InputRules().screen(asked).decision in (Decision.BLOCK, Decision.SUPPORT):
        raise ValidationError("That change can't be made to a game for children.")
    return asked


def _stage(progress: Progress) -> dict[str, Any]:
    return {
        "type": "stage",
        "key": "build",
        "state": "running",
        "label": progress.label,
        "detail": progress.detail,
    }
