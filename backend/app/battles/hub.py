"""Every battle running in this process (§28.3.6), and the clock that moves
each one on.

One per process, like the live lessons' runtime: a battle is short-lived, so
it is never written down, and a restart ends the battles in it. A finished
battle stays a few minutes for its last screen, then goes.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any
from uuid import UUID

from app.battles.room import BattleRoom

logger = logging.getLogger(__name__)

TICK_SECONDS = 0.25
# How long a finished battle stays for its last screen.
KEEP_SECONDS = 600


class BattleHub:
    def __init__(self) -> None:
        self._rooms: dict[UUID, BattleRoom] = {}
        self._clocks: dict[UUID, asyncio.Task[None]] = {}

    def add(self, room: BattleRoom) -> BattleRoom:
        self._rooms[room.id] = room
        self._clocks[room.id] = asyncio.create_task(self._run(room))
        return room

    def get(self, battle_id: UUID) -> BattleRoom | None:
        return self._rooms.get(battle_id)

    def for_classes(self, class_ids: set[UUID]) -> list[BattleRoom]:
        """Battles still to play or being played, in these classes."""
        return [r for r in self._rooms.values() if r.class_id in class_ids and r.phase != "done"]

    def of_class(self, class_id: UUID) -> BattleRoom | None:
        """The one battle going on in a class, if any: a class plays one at a time."""
        return next(iter(self.for_classes({class_id})), None)

    async def follow(self, room: BattleRoom, viewer: UUID) -> AsyncIterator[dict[str, Any]]:
        """The room as `viewer` sees it, now and after every change."""
        while True:
            seen = room.version
            yield room.view(viewer)
            if room.phase == "done":
                return
            await room.changed(seen)

    async def _run(self, room: BattleRoom) -> None:
        try:
            while room.phase != "done":
                await asyncio.sleep(TICK_SECONDS)
                room.tick()
            await asyncio.sleep(KEEP_SECONDS)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — a broken battle ends; the server goes on
            logger.exception("battle %s stopped", room.id)
            room.finish()
        finally:
            self._rooms.pop(room.id, None)
            self._clocks.pop(room.id, None)

    async def close(self) -> None:
        for task in list(self._clocks.values()):
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


@lru_cache
def battle_hub() -> BattleHub:
    return BattleHub()
