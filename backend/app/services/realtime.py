"""Telling an open browser that something changed for its user.

In-process, like `CancellationRegistry` and `live_turns`: one API worker holds
every connection, so a queue per connection is the whole mechanism. More than
one worker needs a shared channel (Postgres LISTEN/NOTIFY is the natural one);
this module is the only place that would change.

Pushes are queued on the session and sent **after it commits**. A push sent
before commit could announce a notification that a rollback then removes,
and a browser that refetched in that gap would find nothing and trust it.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_PENDING = "mentora.realtime.pending"
# Enough for a burst; a connection that falls this far behind only needs to
# know "something changed", so the oldest message is dropped, never blocked on.
QUEUE_SIZE = 32


class RealtimeHub:
    def __init__(self) -> None:
        self._queues: dict[UUID, set[asyncio.Queue[dict[str, Any]]]] = {}

    def connected(self, user_id: UUID) -> int:
        return len(self._queues.get(user_id, ()))

    async def subscribe(self, user_id: UUID) -> AsyncIterator[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._queues.setdefault(user_id, set()).add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            queues = self._queues.get(user_id)
            if queues is not None:
                queues.discard(queue)
                if not queues:
                    self._queues.pop(user_id, None)

    def publish(self, user_id: UUID, message: dict[str, Any]) -> None:
        for queue in tuple(self._queues.get(user_id, ())):
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(message)


hub = RealtimeHub()


def push_after_commit(session: AsyncSession, user_id: UUID, message: dict[str, Any]) -> None:
    """Queue `message` for `user_id`, sent only if this transaction commits."""
    pending: list[tuple[UUID, dict[str, Any]]] = session.info.setdefault(_PENDING, [])
    if (user_id, message) not in pending:
        pending.append((user_id, message))


@event.listens_for(Session, "after_commit")
def _send(sync_session: Session) -> None:
    # SQLAlchemy fires this for a savepoint too — and every event subscriber
    # runs in one. Sending then would announce a change the outer
    # transaction has not committed yet; wait for the real commit.
    if sync_session.in_nested_transaction():
        return
    for user_id, message in sync_session.info.pop(_PENDING, []):
        try:
            hub.publish(user_id, message)
        except Exception:
            # A dead connection's queue must not stop the next user's push.
            logger.exception("realtime push to %s failed", user_id)


@event.listens_for(Session, "after_rollback")
def _discard(sync_session: Session) -> None:
    # A subscriber's savepoint rolling back must not drop what the others
    # queued. Its own pushes stay too: a spare "something changed" only
    # makes a page refetch and find nothing new.
    if sync_session.in_nested_transaction():
        return
    sync_session.info.pop(_PENDING, None)
