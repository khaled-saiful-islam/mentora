"""Pictures for a set's questions or cards: what is known, and finding the rest.

A player in the Year 1–3 look asks for its attempt's pictures (or, in a
preview, the set's) and gets whatever has been found so far. Anything not yet
looked at is looked for in the background, once per set however many
children ask, and each answer is kept — a picture, or that none fits — so
every later child gets it at once.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.grades import grade_for
from app.db.models.item_picture import ItemPicture
from app.db.models.learning import LearningSet
from app.db.session import session_scope
from app.learning.base import Item
from app.learning.item_pictures import KINDS, ItemPictureFinder, item_key
from app.services.attempt_service import AttemptService
from app.services.learning_set_service import LearningSetService

logger = logging.getLogger(__name__)

# Items looked for at once, per set: early ones first, so the first question
# is usually ready before the child gets to it.
AT_ONCE = 3
# A set whose searches could not be written is left alone this long, so a
# player asking every few seconds does not ask the model every few seconds.
RETRY_AFTER_SECONDS = 600


@dataclass(frozen=True, slots=True)
class Wanted:
    set_id: UUID
    topic: str
    grade_level: str | None
    items: tuple[Item, ...]


@dataclass(frozen=True, slots=True)
class Found:
    # By item id: only the items that have a picture.
    pictures: dict[str, dict[str, Any]] = field(default_factory=dict)
    # Every item has been looked at (or no more will be for now).
    done: bool = True


class Filler(Protocol):
    def start(self, wanted: Wanted) -> None: ...

    def resting(self, set_id: UUID) -> bool: ...


class ItemPictureService:
    def __init__(self, session: AsyncSession, filler: Filler | None) -> None:
        self._session = session
        self._filler = filler

    async def for_attempt(self, student_id: UUID, attempt_id: UUID) -> Found:
        loaded = await AttemptService(self._session).loaded(student_id, attempt_id)
        return await self._for(loaded.learning_set, list(loaded.version.items))

    async def for_set(self, owner_id: UUID, set_id: UUID) -> Found:
        sets = LearningSetService(self._session)
        learning_set = await sets.owned(owner_id, set_id)
        version = await sets.version(learning_set)
        return await self._for(learning_set, list(version.items) if version else [])

    async def _for(self, learning_set: LearningSet, items: list[Item]) -> Found:
        if learning_set.kind not in KINDS or self._filler is None or not items:
            return Found()
        keys = {item["id"]: item_key(item) for item in items}
        rows = (
            await self._session.scalars(
                select(ItemPicture).where(
                    ItemPicture.set_id == learning_set.id,
                    ItemPicture.item_key.in_(set(keys.values())),
                )
            )
        ).all()
        by_key = {row.item_key: row for row in rows}
        pictures = {
            item_id: by_key[key].picture
            for item_id, key in keys.items()
            if key in by_key and by_key[key].picture
        }
        missing = tuple(item for item in items if keys[item["id"]] not in by_key)
        if not missing or self._filler.resting(learning_set.id):
            return Found(pictures=pictures, done=True)
        self._filler.start(
            Wanted(learning_set.id, learning_set.topic, learning_set.grade_level, missing)
        )
        return Found(pictures=pictures, done=False)


Keep = Callable[[UUID, str, str, dict[str, Any] | None], Awaitable[None]]


async def keep(set_id: UUID, key: str, query: str, picture: dict[str, Any] | None) -> None:
    """One item's answer, in its own transaction; a twin that got there first wins."""
    async with session_scope() as db:
        await db.execute(
            insert(ItemPicture)
            .values(set_id=set_id, item_key=key, query=query or None, picture=picture)
            .on_conflict_do_nothing(constraint="uq_item_pictures_item")
        )


class PictureFiller:
    """Looks for a set's missing pictures in the background, one run per set."""

    def __init__(
        self, finder: Callable[[str, str | None], ItemPictureFinder], save: Keep = keep
    ) -> None:
        self._finder = finder
        self._save = save
        self._running: dict[UUID, asyncio.Task[None]] = {}
        self._failed: dict[UUID, float] = {}

    def resting(self, set_id: UUID) -> bool:
        failed = self._failed.get(set_id)
        return failed is not None and time.monotonic() - failed < RETRY_AFTER_SECONDS

    def start(self, wanted: Wanted) -> None:
        if wanted.set_id in self._running:
            return
        task = asyncio.create_task(self.fill(wanted))
        self._running[wanted.set_id] = task
        task.add_done_callback(lambda _: self._running.pop(wanted.set_id, None))

    async def fill(self, wanted: Wanted) -> None:
        """Never raises: a set without pictures is still a set."""
        finder = self._finder(wanted.topic, wanted.grade_level)
        try:
            searches = await finder.searches(
                list(wanted.items), topic=wanted.topic, grade=grade_for(wanted.grade_level)
            )
        except Exception:  # noqa: BLE001 — no searches, no pictures; try again later
            logger.warning("picture searches failed for set %s", wanted.set_id, exc_info=True)
            self._failed[wanted.set_id] = time.monotonic()
            return
        gate = asyncio.Semaphore(AT_ONCE)

        async def one(item: Item) -> None:
            search = searches.get(item["id"], "")
            async with gate:
                try:
                    picture = await finder.picture(search, item)
                    await self._save(wanted.set_id, item_key(item), search, picture)
                except Exception:  # noqa: BLE001 — this one goes without, the rest go on
                    logger.warning("picture for %s failed", item["id"], exc_info=True)
                    self._failed[wanted.set_id] = time.monotonic()

        await asyncio.gather(*(one(item) for item in wanted.items), return_exceptions=True)
