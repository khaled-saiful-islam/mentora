"""Publish an event to whoever subscribed to its type.

Subscribers run in the publisher's transaction, so a notification is written
together with the approval that caused it — both or neither. Each one runs in
its own savepoint and its failures are logged, not raised: a reaction failing
must never undo the action it was reacting to.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.base import Event

logger = logging.getLogger(__name__)

Handler = Callable[[Any, AsyncSession], Awaitable[None]]


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[type[Event], list[Handler]] = {}

    def subscribe(self, kind: type[Event], handler: Handler) -> None:
        self._handlers.setdefault(kind, []).append(handler)

    async def publish(self, event: Event, session: AsyncSession) -> None:
        for handler in self._handlers.get(type(event), ()):
            try:
                async with session.begin_nested():
                    await handler(event, session)
            except Exception:
                # Deliberately broad: the action already happened and stands.
                # The savepoint has rolled back this subscriber's writes only.
                logger.exception("subscriber %s failed on %s", _name(handler), type(event).__name__)


def _name(handler: Handler) -> str:
    return getattr(handler, "__qualname__", repr(handler))
