"""One live lesson's room: everything that happens in it, sent to everyone in it.

Events are numbered and the recent ones kept, so a browser that drops and
reconnects asks for what it missed (`since`) and carries on without a gap.
A browser arriving fresh gets a snapshot instead — where the lesson is, who
is here, and what has been said — and then follows live.

Who is here is counted by open connections, so closing the tab is leaving.
Students are shown to each other (a buddy and a first name) and nothing else:
nothing a student sends ever reaches another student through here.

In-process, like the other hubs; one worker. `RoomRegistry` is the only
place that would change for more.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

KEEP_EVENTS = 400
QUEUE_SIZE = 256


@dataclass
class Member:
    """Someone who may be in the room. Mutable: presence changes."""

    id: UUID
    name: str
    buddy: str | None
    role: str  # "student" or "teacher"
    connections: int = 0


@dataclass
class Room:
    session_id: UUID
    _events: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=KEEP_EVENTS))
    _seq: int = 0
    _queues: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)
    members: dict[UUID, Member] = field(default_factory=dict)
    # Where the lesson is, for a snapshot: the latest of each kind of news.
    state: dict[str, Any] = field(default_factory=lambda: {"phase": "lobby"})

    def publish(self, event: dict[str, Any]) -> dict[str, Any]:
        self._seq += 1
        framed = {**event, "seq": self._seq, "server_time": time.time()}
        self._events.append(framed)
        self._remember(framed)
        for queue in list(self._queues):
            if queue.full():
                # A browser this far behind reconnects and asks for a snapshot.
                queue.get_nowait()
            queue.put_nowait(framed)
        return framed

    def snapshot(self) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "seq": self._seq,
            "server_time": time.time(),
            "state": dict(self.state),
            "roster": self.roster(),
        }

    def roster(self) -> list[dict[str, Any]]:
        return [
            {"id": str(m.id), "name": m.name, "buddy": m.buddy, "here": m.connections > 0}
            for m in sorted(self.members.values(), key=lambda m: m.name.lower())
            if m.role == "student"
        ]

    def here(self) -> list[UUID]:
        return [m.id for m in self.members.values() if m.role == "student" and m.connections > 0]

    async def follow(self, member: Member, since: int | None) -> AsyncIterator[dict[str, Any]]:
        """Events for one connection: what was missed (or a snapshot), then live."""
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._queues.add(queue)
        known = self.members.setdefault(member.id, member)
        known.connections += 1
        if known.connections == 1:
            self.publish({"type": "roster", "roster": self.roster()})
        try:
            missed = [e for e in self._events if since is not None and e["seq"] > since]
            if since is not None and missed and missed[0]["seq"] == since + 1:
                for event in missed:
                    yield event
            else:
                yield self.snapshot()
            while True:
                yield await queue.get()
        finally:
            self._queues.discard(queue)
            known.connections = max(0, known.connections - 1)
            if known.connections == 0:
                self.publish({"type": "roster", "roster": self.roster()})

    def _remember(self, event: dict[str, Any]) -> None:
        kind = event.get("type")
        if kind == "phase":
            self.state["phase"] = event.get("phase")
        elif kind == "clip":
            self.state["clip"] = event
            if event.get("lane") == "lesson":
                self.state["segment"] = event.get("segment")
                self.state["show"] = event.get("show")
                self.state["image"] = event.get("image")
        elif kind in ("hands", "called", "checkin", "checkin_result", "quiz", "ended", "paused"):
            self.state[kind] = event
        if kind == "checkin_result":
            self.state.pop("checkin", None)


class RoomRegistry:
    def __init__(self) -> None:
        self._rooms: dict[UUID, Room] = {}

    def get(self, session_id: UUID) -> Room:
        room = self._rooms.get(session_id)
        if room is None:
            room = Room(session_id)
            self._rooms[session_id] = room
        return room

    def find(self, session_id: UUID) -> Room | None:
        return self._rooms.get(session_id)

    def close(self, session_id: UUID) -> None:
        self._rooms.pop(session_id, None)


rooms = RoomRegistry()
