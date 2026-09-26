"""Starting work once a transaction has committed — never before.

A reaction to an event runs inside the transaction that caused it. Work that
must read what that transaction wrote, or that must not happen if it rolls
back, is queued here and started only after the real commit: the same rule
`realtime.push_after_commit` follows for pushes.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Coroutine
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_PENDING = "mentora.after_commit.pending"
Start = Callable[[], Coroutine[Any, Any, None]]
# Running tasks, held so they are not collected half-way.
_running: set[asyncio.Task[None]] = set()


def after_commit(session: AsyncSession, start: Start) -> None:
    """Run `start()` in its own task once this transaction commits."""
    session.info.setdefault(_PENDING, []).append(start)


@event.listens_for(Session, "after_commit")
def _start(sync_session: Session) -> None:
    # A subscriber's savepoint commits first; wait for the real one.
    if sync_session.in_nested_transaction():
        return
    for start in sync_session.info.pop(_PENDING, []):
        try:
            task = asyncio.get_running_loop().create_task(start())
        except RuntimeError:
            logger.warning("no running loop; after-commit work dropped")
            continue
        _running.add(task)
        task.add_done_callback(_running.discard)


@event.listens_for(Session, "after_rollback")
def _discard(sync_session: Session) -> None:
    if sync_session.in_nested_transaction():
        return
    sync_session.info.pop(_PENDING, None)
