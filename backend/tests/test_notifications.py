"""The bell: news for one person, newest first, collapsing repeats."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.errors import NotFoundError
from app.core.notifications import Kind
from app.services.notification_service import NotificationService
from app.services.realtime import _PENDING


async def test_a_notification_is_unread_until_read(session, teacher) -> None:
    bell = NotificationService(session)
    note = await bell.notify(
        user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={"class_name": "5 Bestari"}
    )
    assert await bell.unread_count(teacher.id) == 1
    await bell.mark_read(teacher.id, note.id)
    assert await bell.unread_count(teacher.id) == 0


async def test_you_cannot_read_someone_elses(session, teacher, student) -> None:
    bell = NotificationService(session)
    note = await bell.notify(user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={})
    with pytest.raises(NotFoundError):
        await bell.mark_read(student.id, note.id)


async def test_repeats_with_a_group_key_collapse_into_one(session, teacher) -> None:
    bell = NotificationService(session)
    for name in ("Adam", "Mei", "Ravi"):
        await bell.notify(
            user_id=teacher.id,
            kind=Kind.COMPLETION,
            payload={"title": "Photosynthesis", "actors": [name]},
            group_key="completion:quiz-1",
        )
    page = await bell.page(teacher.id)
    assert len(page.items) == 1
    only = page.items[0]
    assert only.count == 3
    assert only.payload["actors"] == ["Ravi", "Mei", "Adam"]
    assert await bell.unread_count(teacher.id) == 1


async def test_a_read_group_starts_a_fresh_one(session, teacher) -> None:
    """Once you have seen "3 finished", the fourth is new news, not an edit."""
    bell = NotificationService(session)
    first = await bell.notify(
        user_id=teacher.id, kind=Kind.COMPLETION, payload={"actors": ["A"]}, group_key="g"
    )
    await bell.mark_read(teacher.id, first.id)
    await bell.notify(
        user_id=teacher.id, kind=Kind.COMPLETION, payload={"actors": ["B"]}, group_key="g"
    )
    assert len((await bell.page(teacher.id)).items) == 2


async def test_pages_are_newest_first_and_continue_from_a_cursor(session, teacher) -> None:
    bell = NotificationService(session)
    for n in range(5):
        await bell.notify(user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={"n": n})
    first = await bell.page(teacher.id, limit=3)
    assert [item.payload["n"] for item in first.items] == [4, 3, 2]
    assert first.next_cursor
    second = await bell.page(teacher.id, limit=3, cursor=first.next_cursor)
    assert [item.payload["n"] for item in second.items] == [1, 0]
    assert second.next_cursor is None


async def test_a_bad_cursor_is_the_first_page_not_an_error(session, teacher) -> None:
    bell = NotificationService(session)
    await bell.notify(user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={})
    assert len((await bell.page(teacher.id, cursor="garbage")).items) == 1


async def test_mark_all_read_only_touches_your_own(session, teacher, student) -> None:
    bell = NotificationService(session)
    await bell.notify(user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={})
    await bell.notify(user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={})
    await bell.notify(user_id=student.id, kind=Kind.JOIN_APPROVED, payload={})
    assert await bell.mark_all_read(teacher.id) == 2
    assert await bell.unread_count(student.id) == 1


async def test_resolving_marks_the_matching_ones_done(session, teacher) -> None:
    bell = NotificationService(session)
    membership = str(uuid4())
    await bell.notify(
        user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={"membership_id": membership}
    )
    await bell.notify(
        user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={"membership_id": "other"}
    )
    await bell.resolve(
        user_id=teacher.id,
        kind=Kind.JOIN_REQUEST,
        match={"membership_id": membership},
        resolution="approved",
    )
    items = {item.payload["membership_id"]: item for item in (await bell.page(teacher.id)).items}
    assert items[membership].payload["resolution"] == "approved"
    assert items[membership].read_at is not None
    assert "resolution" not in items["other"].payload


async def test_a_change_queues_a_push_for_its_owner(session, teacher) -> None:
    await NotificationService(session).notify(
        user_id=teacher.id, kind=Kind.JOIN_REQUEST, payload={}
    )
    assert (teacher.id, {"topic": "notifications"}) in session.info[_PENDING]
