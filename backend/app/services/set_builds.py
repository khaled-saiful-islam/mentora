"""Starting a learning set's build, from the Make form or from a chat.

Both go the same way: a set row that says "being made", then the build in the
background on its owner's work board, so the tray shows it coming and the
bell rings when it is ready. The form is `POST /api/learning-sets/generate`;
the chat is `tools/learning_set.py`, through `ChatSetMaker`.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import NotFoundError
from app.db.models.learning import LearningSet
from app.db.models.user import User
from app.learning.generator import GenerationRequest
from app.services.generation_service import GenerationDraft, GenerationService
from app.services.jobs import jobs
from app.services.quota import TokenQuota
from app.services.rate_limit import Limit, RateLimiter
from app.services.work import work
from app.services.work_tickets import for_set

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]


def build_in_background(
    learning_set: LearningSet,
    owner_id: UUID,
    service: GenerationService,
    request: GenerationRequest,
) -> None:
    """Start making the set in the background, on its owner's work board."""
    jobs.start(
        learning_set.id,
        owner_id,
        service.events(learning_set.id, request),
        watcher=work.watch(learning_set.id, owner_id, for_set(learning_set)),
    )


@dataclass(frozen=True, slots=True)
class Started:
    set_id: UUID
    kind: str
    title: str


class ChatSetMaker:
    """Starts a set for one person from a chat, exactly as the Make form does:
    the same limits, the same purpose (a teacher's to share, a parent's to
    send home), the same build."""

    def __init__(
        self,
        user_id: UUID,
        service: GenerationService,
        settings: Settings,
        session_maker: SessionMaker,
    ) -> None:
        self._user_id = user_id
        self._service = service
        self._settings = settings
        self._session_maker = session_maker

    async def make(self, draft: GenerationDraft) -> Started:
        async with self._session_maker() as session:
            owner = await session.get(User, self._user_id)
            if owner is None:
                raise NotFoundError("Your account could not be found.")
            await RateLimiter(session, enabled=self._settings.rate_limit_enabled).check(
                "generate", str(owner.id), Limit(self._settings.rate_limit_generate_per_minute)
            )
            await TokenQuota(session).check(owner.id, owner.daily_token_limit)
            learning_set = await self._service.begin(session, owner, draft)
            request = await self._service.request_with_materials(session, learning_set)
            # Committed before the job starts, so the job's own session finds it.
            await session.commit()
            started = Started(learning_set.id, learning_set.kind, learning_set.title)
        build_in_background(learning_set, self._user_id, self._service, request)
        return started
