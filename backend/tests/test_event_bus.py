"""The domain event bus: services say what happened, subscribers react.

The rule that matters: a reaction failing never undoes the action. Approving a
student must stand even if writing their notification blows up.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

from app.db.models.memory import Memory
from app.events.base import Event
from app.events.bus import EventBus


@dataclass(frozen=True, slots=True)
class Happened(Event):
    what: str


@dataclass(frozen=True, slots=True)
class Other(Event):
    pass


async def test_subscribers_hear_the_events_they_asked_for(session) -> None:
    heard: list[str] = []
    bus = EventBus()

    async def listener(event: Happened, _session) -> None:
        heard.append(event.what)

    bus.subscribe(Happened, listener)
    await bus.publish(Happened("approved"), session)
    await bus.publish(Other(), session)
    assert heard == ["approved"]


async def test_every_subscriber_runs_in_order(session) -> None:
    order: list[int] = []
    bus = EventBus()
    for n in (1, 2, 3):
        bus.subscribe(Happened, lambda _e, _s, n=n: _append(order, n))
    await bus.publish(Happened("x"), session)
    assert order == [1, 2, 3]


async def _append(order: list[int], n: int) -> None:
    order.append(n)


async def test_a_failing_subscriber_does_not_stop_the_others(session, db_user) -> None:
    bus = EventBus()

    async def broken(_event, _session) -> None:
        raise RuntimeError("the mail server is on fire")

    async def writer(_event, s) -> None:
        s.add(Memory(user_id=db_user.id, content="still written", source="user", enabled=True))
        await s.flush()

    bus.subscribe(Happened, broken)
    bus.subscribe(Happened, writer)
    await bus.publish(Happened("x"), session)

    mine = select(Memory.content).where(Memory.user_id == db_user.id)
    assert "still written" in (await session.execute(mine)).scalars().all()


async def test_a_failing_statement_does_not_poison_the_transaction(session, db_user) -> None:
    """Each subscriber gets a savepoint: a failed statement rolls back to it,
    and the surrounding transaction — the action itself — carries on."""
    bus = EventBus()

    async def bad_sql(_event, s) -> None:
        s.add(Memory(user_id=db_user.id, content=None, source="user", enabled=True))  # NOT NULL
        await s.flush()

    bus.subscribe(Happened, bad_sql)
    await bus.publish(Happened("x"), session)

    session.add(Memory(user_id=db_user.id, content="after", source="user", enabled=True))
    await session.flush()
    mine = select(Memory.content).where(Memory.user_id == db_user.id)
    assert (await session.execute(mine)).scalars().all() == ["after"]
