"""Pushes reach the right user, and only once the change is real."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from app.services.realtime import RealtimeHub, hub, push_after_commit


async def _first(stream, wait: float = 1.0):
    return await asyncio.wait_for(anext(stream), wait)


async def test_a_published_message_reaches_every_connection_of_that_user() -> None:
    hub_ = RealtimeHub()
    user = uuid4()
    one, two = hub_.subscribe(user), hub_.subscribe(user)
    first = asyncio.create_task(_first(one))
    second = asyncio.create_task(_first(two))
    await asyncio.sleep(0)
    hub_.publish(user, {"topic": "notifications"})
    assert await first == {"topic": "notifications"}
    assert await second == {"topic": "notifications"}
    await one.aclose()
    await two.aclose()


async def test_other_users_hear_nothing() -> None:
    hub_ = RealtimeHub()
    listener = hub_.subscribe(uuid4())
    waiting = asyncio.create_task(_first(listener, wait=0.1))
    await asyncio.sleep(0)
    hub_.publish(uuid4(), {"topic": "notifications"})
    try:
        await waiting
        raise AssertionError("heard someone else's push")
    except TimeoutError:
        pass
    await listener.aclose()


async def test_a_closed_connection_is_forgotten() -> None:
    hub_ = RealtimeHub()
    user = uuid4()
    stream = hub_.subscribe(user)
    task = asyncio.create_task(_first(stream, wait=0.2))
    await asyncio.sleep(0)
    assert hub_.connected(user) == 1
    hub_.publish(user, {"n": 1})
    await task
    await stream.aclose()
    assert hub_.connected(user) == 0


async def test_a_slow_connection_drops_the_oldest_rather_than_blocking() -> None:
    hub_ = RealtimeHub()
    user = uuid4()
    stream = hub_.subscribe(user)
    starter = asyncio.create_task(_first(stream))
    await asyncio.sleep(0)
    hub_.publish(user, {"n": 0})
    await starter
    for n in range(100):
        hub_.publish(user, {"n": n})  # never raises, never blocks
    assert (await _first(stream))["n"] > 0
    await stream.aclose()


async def test_nothing_is_sent_before_the_transaction_commits(session) -> None:
    """The rollback fixture never commits for real, so a push here must not
    arrive — which is exactly what a rolled-back change must look like."""
    user = uuid4()
    stream = hub.subscribe(user)
    waiting = asyncio.create_task(_first(stream, wait=0.1))
    await asyncio.sleep(0)
    push_after_commit(session, user, {"topic": "notifications"})
    await session.rollback()
    try:
        await waiting
        raise AssertionError("pushed before commit")
    except TimeoutError:
        pass
    await stream.aclose()


async def test_a_commit_sends_what_was_queued_once(session) -> None:
    user = uuid4()
    stream = hub.subscribe(user)
    waiting = asyncio.create_task(_first(stream))
    await asyncio.sleep(0)
    push_after_commit(session, user, {"topic": "notifications"})
    push_after_commit(session, user, {"topic": "notifications"})  # same news, once
    await session.commit()
    assert await waiting == {"topic": "notifications"}
    follow_up = asyncio.create_task(_first(stream, wait=0.1))
    try:
        await follow_up
        raise AssertionError("sent twice")
    except TimeoutError:
        pass
    await stream.aclose()


class _Session:
    """Just enough of a Session for the commit hooks."""

    def __init__(self, *, nested: bool) -> None:
        self.info: dict = {}
        self._nested = nested

    def in_nested_transaction(self) -> bool:
        return self._nested


def test_a_savepoint_commit_does_not_send_what_the_outer_transaction_queued() -> None:
    from app.services import realtime

    user = uuid4()
    session = _Session(nested=True)
    session.info[realtime._PENDING] = [(user, {"topic": "members"})]
    realtime._send(session)  # a subscriber's savepoint releasing
    assert session.info[realtime._PENDING] == [(user, {"topic": "members"})]
    realtime._discard(session)  # another subscriber's savepoint failing
    assert session.info[realtime._PENDING] == [(user, {"topic": "members"})]


async def test_the_real_commit_sends_and_a_real_rollback_discards() -> None:
    from app.services import realtime

    user = uuid4()
    stream = hub.subscribe(user)
    heard = asyncio.create_task(_first(stream))
    await asyncio.sleep(0)
    session = _Session(nested=False)
    session.info[realtime._PENDING] = [(user, {"topic": "members"})]
    realtime._send(session)
    assert await heard == {"topic": "members"}
    await stream.aclose()

    session.info[realtime._PENDING] = [(user, {"topic": "classes"})]
    realtime._discard(session)
    assert realtime._PENDING not in session.info
