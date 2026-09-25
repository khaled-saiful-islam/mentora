"""The moderation log and the admin's review of it."""

from __future__ import annotations

import pytest

from app.core.errors import NotFoundError, ValidationError
from app.moderation.base import Flag
from app.services.moderation_service import ModerationService, Where


def _flag(severity: str = "medium", kind: str = "held") -> Flag:
    return Flag(kind=kind, source="user_input", severity=severity, category="sexual", rule="x")


async def test_a_reviewed_event_leaves_the_open_queue(session, student, account) -> None:
    admin = await account("admin", "Admin")
    log = ModerationService(session)
    event = await log.record(_flag(), Where(user_id=student.id))

    def theirs(items):
        # The shared dev database has other people's events in it too.
        return [item.event.id for item in items if item.event.user_id == student.id]

    assert theirs(await log.queue()) == [event.id]
    assert (await log.open_counts())["medium"] >= 1

    await log.review(event.id, admin.id, status="reviewed", note="  talked to the class ")
    assert theirs(await log.queue()) == []
    assert (event.reviewed_by, event.note) == (admin.id, "talked to the class")
    assert [i.user.id for i in await log.queue(status="reviewed") if i.event.id == event.id] == [
        student.id
    ]

    await log.review(event.id, admin.id, status="open")
    assert event.reviewed_by is None and event.reviewed_at is None


async def test_the_queue_filters_by_severity_and_kind(session, student) -> None:
    log = ModerationService(session)
    high = await log.record(_flag("high", "support"), Where(user_id=student.id))
    await log.record(_flag("low", "redacted"), Where(user_id=student.id))
    assert [
        i.event.id for i in await log.queue(severity="high") if i.user and i.user.id == student.id
    ] == [high.id]
    assert all(i.event.kind == "redacted" for i in await log.queue(kind="redacted"))


async def test_a_review_needs_a_real_status_and_a_real_event(session, student, account) -> None:
    admin = await account("admin", "Admin")
    log = ModerationService(session)
    event = await log.record(_flag(), Where(user_id=student.id))
    with pytest.raises(ValidationError):
        await log.review(event.id, admin.id, status="deleted")
    with pytest.raises(NotFoundError):
        await log.review(admin.id, admin.id, status="reviewed")


async def test_recording_quietly_never_raises(session, student) -> None:
    log = ModerationService(session)
    # A severity the table refuses: the bad line is dropped, the good one kept.
    await log.record_quietly([_flag("catastrophic"), _flag("low")], Where(user_id=student.id))
    kept = [i.event.severity for i in await log.queue() if i.user and i.user.id == student.id]
    assert kept == ["low"]
