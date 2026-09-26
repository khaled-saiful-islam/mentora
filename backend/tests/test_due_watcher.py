"""The past-due watcher: parents hear at once when their child's work goes
past due unfinished — once, and only for work that is really missed.

Times are years ahead, so nothing already in the shared dev database falls
inside the watcher's window.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models.family import FamilyShare
from app.db.models.notification import Notification
from app.events.registry import build_bus
from app.services.attempt_service import AttemptService
from app.services.due_watcher import DueWatcher
from app.services.family_service import FamilyService
from app.services.membership_service import MembershipService
from tests.play_helpers import ready_set, shared

DUE = datetime(2031, 3, 14, 9, 0, tzinfo=UTC)
AFTER = DUE + timedelta(minutes=1)


def _watcher() -> DueWatcher:
    return DueWatcher(settings=get_settings(), bus=build_bus, session_maker=None)  # type: ignore[arg-type]


async def _parent_of(session, account, child, label: str = "Mum"):
    parent = await account("parent")
    family = FamilyService(session)
    await family.connect(parent, (await family.invite_for(child)).code, label)
    return parent


async def _alerts(session, parent) -> list[Notification]:
    rows = await session.scalars(
        select(Notification).where(
            Notification.user_id == parent.id, Notification.type == "child_overdue"
        )
    )
    return list(rows.all())


async def _class_work(session, teacher, students, due=DUE):
    assignment = await shared(session, teacher, students)
    assignment.due_at = due
    await session.flush()
    return assignment


async def test_a_parent_hears_once_when_class_work_goes_past_due(session, teacher, account) -> None:
    child = await account("student", "Aina Sofea")
    parent = await _parent_of(session, account, child)
    assignment = await _class_work(session, teacher, [child])
    watcher = _watcher()
    await watcher.check(session, DUE - timedelta(minutes=1))
    assert await _alerts(session, parent) == []
    await watcher.check(session, AFTER)
    [alert] = await _alerts(session, parent)
    assert alert.payload["student_name"] == "Aina"
    assert alert.payload["title"] == assignment.title
    assert (alert.payload["source"], alert.payload["source_name"]) == ("class", "5 Bestari")
    alert.read_at = AFTER
    await watcher.check(session, AFTER + timedelta(minutes=5))
    assert len(await _alerts(session, parent)) == 1


async def test_finished_closed_left_or_parentless_work_sends_nothing(
    session, teacher, account
) -> None:
    finished, closed, left, alone = [await account("student") for _ in range(4)]
    parents = [await _parent_of(session, account, kid) for kid in (finished, closed, left)]
    done = await _class_work(session, teacher, [finished])
    attempts = AttemptService(session)
    view = await attempts.start(finished, done.id)
    await attempts.complete(finished.id, view.attempt.id)
    shut = await _class_work(session, teacher, [closed])
    shut.closed_at = DUE - timedelta(hours=1)
    gone = await _class_work(session, teacher, [left])
    await MembershipService(session, build_bus()).leave(left.id, gone.class_id)
    await _class_work(session, teacher, [alone])
    await _watcher().check(session, AFTER)
    for parent in parents:
        assert await _alerts(session, parent) == []


async def test_work_from_home_tells_every_parent(session, account) -> None:
    child = await account("student", "Aina Sofea")
    mum = await _parent_of(session, account, child, "Mum")
    dad = await _parent_of(session, account, child, "Dad")
    learning_set = await ready_set(session, mum, purpose="family")
    session.add(
        FamilyShare(
            parent_id=mum.id, student_id=child.id, set_id=learning_set.id, version=1, due_at=DUE
        )
    )
    await session.flush()
    await _watcher().check(session, AFTER)
    for parent in (mum, dad):
        [alert] = await _alerts(session, parent)
        assert (alert.payload["source"], alert.payload["source_name"]) == ("home", "Mum")


async def test_a_moved_due_date_can_be_missed_again(session, teacher, account) -> None:
    child = await account("student")
    parent = await _parent_of(session, account, child)
    assignment = await _class_work(session, teacher, [child])
    watcher = _watcher()
    await watcher.check(session, AFTER)
    later = DUE + timedelta(days=1)
    assignment.due_at = later
    await session.flush()
    await watcher.check(session, later + timedelta(minutes=1))
    assert len(await _alerts(session, parent)) == 2


async def test_work_long_past_due_is_never_announced(session, teacher, account) -> None:
    child = await account("student")
    parent = await _parent_of(session, account, child)
    await _class_work(session, teacher, [child])
    await _watcher().check(session, DUE + timedelta(days=3))
    assert await _alerts(session, parent) == []
