"""What is being made in the background, and telling its owner when it is done.

A job (`services/jobs.py`) runs on in its own task whatever the page does. The
board is what its owner sees of it from anywhere in the app: a tray of what
is being made and how far along it is, live, and a note in the bell when each
one finishes. So a teacher can start a quiz or a live lesson, go and do
something else, and be told when it is ready.

In-process, like the job runner and the realtime hub: one API worker.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta
from typing import Any, Literal
from uuid import UUID

from app.core.clock import Clock, utc_now
from app.services.realtime import hub

logger = logging.getLogger(__name__)

# A finished piece stays in the tray this long, so "ready — open it" is
# there when you look, then it lives on in the bell and the library.
KEEP_FINISHED = timedelta(minutes=15)
# More than this and the oldest finished pieces make way.
MAX_PER_OWNER = 12

State = Literal["running", "done", "failed"]
Push = Callable[[UUID, dict[str, Any]], None]


@dataclass(frozen=True, slots=True)
class Ticket:
    """What is being made, said the way its owner would say it."""

    # A learning kind ("quiz", "flashcard", "study_guide") or "live_plan" /
    # "live_recording".
    kind: str
    title: str
    # Where the finished thing opens.
    link: str
    # How many steps it goes through, when known up front.
    steps: int | None = None


@dataclass(frozen=True, slots=True)
class WorkItem:
    id: UUID
    owner_id: UUID
    ticket: Ticket
    started_at: datetime
    state: State = "running"
    progress: float = 0.0
    label: str = "Getting started"
    finished_at: datetime | None = None
    message: str | None = None
    # Stage keys already done, so a repeated event never counts twice.
    stages_done: frozenset[str] = field(default_factory=frozenset)
    parts_done: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "kind": self.ticket.kind,
            "title": self.ticket.title,
            "link": self.ticket.link,
            "state": self.state,
            "progress": round(self.progress, 3),
            "label": self.label,
            "message": self.message,
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
        }


def advance(item: WorkItem, event: dict[str, Any], now: datetime) -> WorkItem:
    """The item after one job event. Unknown events leave it as it was."""
    kind = event.get("type")
    steps = item.ticket.steps
    if kind == "stage":
        label = str(event.get("label") or item.label)
        key = event.get("key")
        if key and event.get("state") == "done":
            done = item.stages_done | {str(key)}
            progress = len(done) / steps if steps else item.progress
            return replace(item, label=label, stages_done=done, progress=min(progress, 0.95))
        return replace(item, label=label)
    if kind == "part":
        parts = item.parts_done + 1
        progress = parts / steps if steps else item.progress
        label = f"Wrote part {parts} of {steps}" if steps else f"Wrote part {parts}"
        return replace(item, parts_done=parts, progress=min(progress, 0.95), label=label)
    if kind == "recording":
        done, total = int(event.get("done") or 0), int(event.get("total") or 0)
        progress = done / total if total else item.progress
        label = f"Recording Astra's voice · {done} of {total}" if total else item.label
        return replace(item, progress=min(progress, 0.99), label=label)
    if kind == "done":
        return replace(item, state="done", progress=1.0, label="Ready", finished_at=now)
    if kind in ("failed", "refused"):
        message = str(event.get("message") or "This could not be made.")
        return replace(
            item, state="failed", label="Couldn't finish", message=message, finished_at=now
        )
    return item


Announce = Callable[[WorkItem], Awaitable[None]]


class Watcher:
    """One job's link to the board: sees each event, and says when it ended."""

    def __init__(self, board: WorkBoard, work_id: UUID) -> None:
        self._board = board
        self._id = work_id

    def seen(self, event: dict[str, Any]) -> None:
        self._board.seen(self._id, event)

    async def ended(self) -> None:
        await self._board.ended(self._id)


class WorkBoard:
    def __init__(
        self, *, announce: Announce | None = None, push: Push | None = None, clock: Clock = utc_now
    ) -> None:
        self._items: dict[UUID, WorkItem] = {}
        self._announce = announce or _announce
        self._push = push or hub.publish
        self._clock = clock

    def watch(self, work_id: UUID, owner_id: UUID, ticket: Ticket) -> Watcher:
        """Put a piece of work on its owner's board, starting now. The same
        work already running stays as it is."""
        current = self._items.get(work_id)
        if current is None or current.state != "running":
            fresh = WorkItem(id=work_id, owner_id=owner_id, ticket=ticket, started_at=self._clock())
            self._put(fresh)
        return Watcher(self, work_id)

    def seen(self, work_id: UUID, event: dict[str, Any]) -> None:
        item = self._items.get(work_id)
        if item is None or item.state != "running":
            return
        moved = advance(item, event, self._clock())
        if moved != item:
            self._put(moved)

    async def ended(self, work_id: UUID) -> None:
        """The job is over. A job that stopped without saying how it ended
        counts as failed, so the owner is never left waiting on a spinner."""
        item = self._items.get(work_id)
        if item is None:
            return
        if item.state == "running":
            stopped = {
                "type": "failed",
                "message": "It stopped before it finished. Please try again.",
            }
            item = advance(item, stopped, self._clock())
            self._put(item)
        try:
            await self._announce(item)
        except Exception:
            # Deliberately broad: the work is done and saved; only the bell
            # note is missing, and the tray still says it is ready.
            logger.exception("could not announce finished work %s", work_id)

    def for_owner(self, owner_id: UUID) -> list[WorkItem]:
        """What is being made, newest first, and what finished lately."""
        cutoff = self._clock() - KEEP_FINISHED
        mine = [
            item
            for item in self._items.values()
            if item.owner_id == owner_id
            and (item.finished_at is None or item.finished_at >= cutoff)
        ]
        return sorted(mine, key=lambda item: item.started_at, reverse=True)

    def _put(self, item: WorkItem) -> None:
        self._items[item.id] = item
        self._trim(item.owner_id)
        try:
            self._push(item.owner_id, {"topic": "work", "work": item.as_dict()})
        except Exception:
            # A dead connection must not stop the work it reports on.
            logger.exception("work push to %s failed", item.owner_id)

    def _trim(self, owner_id: UUID) -> None:
        cutoff = self._clock() - KEEP_FINISHED
        for item in list(self._items.values()):
            if item.finished_at is not None and item.finished_at < cutoff:
                self._items.pop(item.id, None)
        mine = sorted(
            (i for i in self._items.values() if i.owner_id == owner_id and i.state != "running"),
            key=lambda i: i.started_at,
        )
        for old in mine[: max(0, len(mine) - MAX_PER_OWNER)]:
            self._items.pop(old.id, None)


async def _announce(item: WorkItem) -> None:
    """The bell note for a finished piece, written like any other: an event,
    and the notification subscriber reacts to it."""
    from app.db.session import session_scope
    from app.events.catalog import WorkFinished
    from app.events.registry import build_bus

    async with session_scope() as session:
        await build_bus().publish(
            WorkFinished(
                owner_id=item.owner_id,
                work_id=item.id,
                kind=item.ticket.kind,
                title=item.ticket.title,
                link=item.ticket.link,
                ok=item.state == "done",
                message=item.message,
            ),
            session,
        )


work = WorkBoard()
