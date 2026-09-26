"""Work made in the background: seen from anywhere, and announced when done."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.core.notifications import Kind
from app.db.models.notification import Notification
from app.events.catalog import WorkFinished
from app.events.registry import build_bus
from app.services.jobs import JobRunner
from app.services.work import KEEP_FINISHED, Ticket, WorkBoard, advance

QUIZ = Ticket(kind="quiz", title="Photosynthesis", link="/library/x", steps=4)


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 9, 26, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


def _board(clock: Clock | None = None):
    told, pushed = [], []

    async def announce(item) -> None:
        told.append(item)

    board = WorkBoard(
        announce=announce, push=lambda user, msg: pushed.append((user, msg)), clock=clock or Clock()
    )
    return board, told, pushed


def test_progress_follows_the_stages_and_never_claims_done_early() -> None:
    board, _, _ = _board()
    owner, work_id = uuid4(), uuid4()
    board.watch(work_id, owner, QUIZ)
    for key in ("check", "research", "skills", "write"):
        board.seen(work_id, {"type": "stage", "key": key, "state": "running", "label": key})
        board.seen(work_id, {"type": "stage", "key": key, "state": "done", "label": key})
    # A repeated "done" never counts twice.
    board.seen(work_id, {"type": "stage", "key": "write", "state": "done", "label": "write"})
    [item] = board.for_owner(owner)
    assert item.state == "running"
    assert item.progress == 0.95
    board.seen(work_id, {"type": "done"})
    [item] = board.for_owner(owner)
    assert (item.state, item.progress, item.label) == ("done", 1.0, "Ready")


def test_a_lesson_counts_parts_and_recordings() -> None:
    board, _, _ = _board()
    owner, plan = uuid4(), uuid4()
    board.watch(plan, owner, Ticket("live_plan", "Fractions", "/live/1", steps=3))
    board.seen(plan, {"type": "part", "part": 0})
    [written] = board.for_owner(owner)
    assert written.label == "Wrote part 1 of 3"
    assert round(written.progress, 2) == 0.33
    recording = advance(written, {"type": "recording", "done": 6, "total": 12}, Clock()())
    assert recording.progress == 0.5
    assert recording.label == "Recording Astra's voice · 6 of 12"


def test_failures_keep_their_reason() -> None:
    board, _, _ = _board()
    owner, work_id = uuid4(), uuid4()
    board.watch(work_id, owner, QUIZ)
    board.seen(work_id, {"type": "refused", "message": "That topic isn't one for school."})
    [item] = board.for_owner(owner)
    assert item.state == "failed"
    assert item.message == "That topic isn't one for school."


def test_each_change_is_pushed_to_the_owner_only() -> None:
    board, _, pushed = _board()
    owner, work_id = uuid4(), uuid4()
    board.watch(work_id, owner, QUIZ)
    board.seen(work_id, {"type": "stage", "key": "check", "state": "running", "label": "Checking"})
    board.seen(work_id, {"type": "items", "items": []})  # changes nothing: no push
    assert [user for user, _ in pushed] == [owner, owner]
    assert pushed[-1][1]["topic"] == "work"
    assert pushed[-1][1]["work"]["label"] == "Checking"


def test_finished_work_leaves_the_tray_after_a_while() -> None:
    clock = Clock()
    board, _, _ = _board(clock)
    owner, work_id = uuid4(), uuid4()
    board.watch(work_id, owner, QUIZ)
    board.seen(work_id, {"type": "done"})
    clock.now += KEEP_FINISHED - timedelta(seconds=1)
    assert len(board.for_owner(owner)) == 1
    clock.now += timedelta(seconds=2)
    assert board.for_owner(owner) == []
    assert board.for_owner(uuid4()) == []


def test_watching_running_work_again_keeps_its_progress() -> None:
    board, _, _ = _board()
    owner, work_id = uuid4(), uuid4()
    board.watch(work_id, owner, QUIZ)
    board.seen(work_id, {"type": "stage", "key": "check", "state": "done", "label": "Checked"})
    board.watch(work_id, owner, QUIZ)
    [item] = board.for_owner(owner)
    assert item.label == "Checked"


async def test_a_job_announces_how_it_ended() -> None:
    board, told, _ = _board()
    owner, work_id = uuid4(), uuid4()

    async def source():
        yield {"type": "stage", "key": "check", "state": "done", "label": "Checked"}
        yield {"type": "done"}

    job = JobRunner().start(work_id, owner, source(), watcher=board.watch(work_id, owner, QUIZ))
    await asyncio.wait_for(job.task, 1)
    assert [item.state for item in told] == ["done"]


async def test_a_job_that_stops_without_saying_is_announced_as_failed() -> None:
    board, told, _ = _board()
    owner, work_id = uuid4(), uuid4()

    async def quiet():
        yield {"type": "stage", "key": "check", "state": "running", "label": "Checking"}

    job = JobRunner().start(work_id, owner, quiet(), watcher=board.watch(work_id, owner, QUIZ))
    await asyncio.wait_for(job.task, 1)
    assert told[0].state == "failed"
    assert "stopped" in told[0].message


async def test_a_broken_watcher_never_breaks_the_job() -> None:
    class Broken:
        def seen(self, event) -> None:
            raise RuntimeError("boom")

        async def ended(self) -> None:
            raise RuntimeError("boom")

    async def source():
        yield {"n": 1}
        yield {"type": "done"}

    job = JobRunner().start(uuid4(), uuid4(), source(), watcher=Broken())
    events = [event async for event in job.follow()]
    await asyncio.wait_for(job.task, 1)
    assert events[-1] == {"type": "done"}


async def test_an_announcement_that_fails_is_only_logged() -> None:
    async def broken(item) -> None:
        raise RuntimeError("no database")

    board = WorkBoard(announce=broken, push=lambda *_: None)
    owner, work_id = uuid4(), uuid4()
    board.watch(work_id, owner, QUIZ)
    board.seen(work_id, {"type": "done"})
    await board.ended(work_id)
    assert board.for_owner(owner)[0].state == "done"


async def test_finished_work_rings_the_bell(session, teacher) -> None:
    work_id = uuid4()
    for ok in (True, False):
        await build_bus().publish(
            WorkFinished(
                owner_id=teacher.id,
                work_id=work_id,
                kind="quiz",
                title="Photosynthesis",
                link="/library/x",
                ok=ok,
                message=None if ok else "No questions passed the checks.",
            ),
            session,
        )
    notes = (
        await session.scalars(
            select(Notification)
            .where(Notification.user_id == teacher.id)
            .order_by(Notification.created_at)
        )
    ).all()
    assert [n.type for n in notes] == [Kind.WORK_DONE.value, Kind.WORK_FAILED.value]
    assert notes[0].payload["link"] == "/library/x"
    assert notes[1].payload["message"] == "No questions passed the checks."


async def test_the_tray_lists_only_my_work(client, teacher, student) -> None:
    from app.services.work import work

    mine = uuid4()
    work.watch(mine, teacher.id, QUIZ)
    work.watch(uuid4(), student.id, QUIZ)
    async with client(teacher) as c:
        got = await c.get("/api/me/work")
    assert got.status_code == 200
    items = got.json()["items"]
    assert [i["id"] for i in items] == [str(mine)]
    assert items[0]["title"] == "Photosynthesis"
