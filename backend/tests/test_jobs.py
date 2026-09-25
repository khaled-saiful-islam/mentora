"""Background jobs: they outlive the connection, and anyone can rejoin one."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from app.services.jobs import JobRunner


async def _source(events: list[dict], gate: asyncio.Event | None = None):
    for n, event in enumerate(events):
        if gate is not None and n == 1:
            await gate.wait()
        yield event


async def _collect(job) -> list[dict]:
    return [event async for event in job.follow()]


async def test_a_follower_gets_everything_from_the_start() -> None:
    runner = JobRunner()
    job = runner.start(uuid4(), uuid4(), _source([{"n": 1}, {"n": 2}, {"n": 3}]))
    assert await asyncio.wait_for(_collect(job), 1) == [{"n": 1}, {"n": 2}, {"n": 3}]


async def test_a_latecomer_is_replayed_what_they_missed_then_follows_live() -> None:
    runner = JobRunner()
    gate = asyncio.Event()
    job = runner.start(uuid4(), uuid4(), _source([{"n": 1}, {"n": 2}], gate))
    await asyncio.sleep(0.01)
    late = asyncio.create_task(_collect(job))
    await asyncio.sleep(0.01)
    gate.set()
    assert await asyncio.wait_for(late, 1) == [{"n": 1}, {"n": 2}]


async def test_a_job_keeps_going_when_its_follower_leaves() -> None:
    runner = JobRunner()
    gate = asyncio.Event()
    job = runner.start(uuid4(), uuid4(), _source([{"n": 1}, {"n": 2}], gate))
    follower = asyncio.create_task(_collect(job))
    await asyncio.sleep(0.01)
    follower.cancel()
    gate.set()
    await asyncio.wait_for(job.task, 1)
    assert job.done
    assert await _collect(job) == [{"n": 1}, {"n": 2}]


async def test_only_the_owner_finds_it() -> None:
    runner = JobRunner()
    owner, job_id = uuid4(), uuid4()
    runner.start(job_id, owner, _source([{"n": 1}]))
    assert runner.find(job_id, owner) is not None
    assert runner.find(job_id, uuid4()) is None


async def test_a_crashing_source_ends_the_job_with_a_failure_event() -> None:
    async def broken():
        yield {"n": 1}
        raise RuntimeError("boom")

    job = JobRunner().start(uuid4(), uuid4(), broken())
    events = await asyncio.wait_for(_collect(job), 1)
    assert events[0] == {"n": 1}
    assert events[-1]["type"] == "failed"
    assert "boom" not in events[-1]["message"]


async def test_starting_the_same_job_twice_returns_the_running_one() -> None:
    runner = JobRunner()
    job_id, owner = uuid4(), uuid4()
    gate = asyncio.Event()
    first = runner.start(job_id, owner, _source([{"n": 1}, {"n": 2}], gate))
    second = runner.start(job_id, owner, _source([{"n": 9}]))
    assert first is second
    gate.set()


async def test_closing_everything_cancels_running_jobs() -> None:
    runner = JobRunner()
    job = runner.start(uuid4(), uuid4(), _source([{"n": 1}, {"n": 2}], asyncio.Event()))
    await runner.close_all()
    assert job.task.done()
