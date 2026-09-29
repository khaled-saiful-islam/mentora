"""Nudges from the coverage map: a teacher's next topics, a student's
unfinished class work — on their homes, and now and then in the bell."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.core.notifications import Kind
from app.db.models.classroom import Classroom
from app.db.models.coverage import CoverageLink
from app.db.models.notification import Notification
from app.services.coverage.service import CoverageService
from app.services.coverage_nudges import CoverageNudges, CoverageWatcher
from tests.play_helpers import shared

SYLLABUS = [
    {"id": "a1", "title": "Living things", "topics": [
        {"id": "a1t1", "title": "Plants"}, {"id": "a1t2", "title": "Animals"},
    ]},
    {"id": "a2", "title": "Energy", "topics": [
        {"id": "a2t1", "title": "Light"}, {"id": "a2t2", "title": "Heat"},
    ]},
]  # fmt: skip


async def _class_with_syllabus(session, teacher, students, *, placed="a1t1"):
    assignment = await shared(session, teacher, students)
    room = await session.get(Classroom, assignment.class_id)
    await CoverageService(session).save(room, SYLLABUS)
    if placed:
        session.add(
            CoverageLink(
                class_id=room.id, kind="assignment", item_id=assignment.id, topic_id=placed
            )
        )
    await session.flush()
    return room, assignment


async def _notes(session, user_id, kind: Kind) -> list[Notification]:
    found = await session.scalars(
        select(Notification).where(Notification.user_id == user_id, Notification.type == kind.value)
    )
    return list(found.all())


async def test_a_teacher_hears_the_next_topics_in_syllabus_order(session, teacher, student) -> None:
    room, _ = await _class_with_syllabus(session, teacher, [student])
    [nudge] = [
        n for n in await CoverageNudges(session).for_teacher(teacher.id) if n.class_id == room.id
    ]
    assert [t.title for t in nudge.next] == ["Animals", "Light", "Heat"]
    assert (nudge.taught, nudge.topics) == (1, 4)


async def test_a_class_without_a_syllabus_has_no_nudge(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    ids = [n.class_id for n in await CoverageNudges(session).for_teacher(teacher.id)]
    assert assignment.class_id not in ids


async def test_a_student_sees_what_to_finish_and_the_topic_it_covers(
    session, teacher, student
) -> None:
    room, assignment = await _class_with_syllabus(session, teacher, [student])
    [keep] = [
        k for k in await CoverageNudges(session).for_student(student) if k.class_id == room.id
    ]
    [item] = keep.items
    assert (item.assignment_id, item.topic) == (assignment.id, "Plants")


async def test_the_bell_rings_once_a_week_for_a_teacher(session, teacher, student) -> None:
    await _class_with_syllabus(session, teacher, [student])
    watcher = CoverageWatcher(settings=get_settings(), session_maker=None)  # type: ignore[arg-type]
    now = datetime.now(UTC)
    await watcher.check(session, now)
    await watcher.check(session, now)
    [note] = await _notes(session, teacher.id, Kind.COVERAGE_NUDGE)
    assert note.payload["next"] == ["Animals", "Light", "Heat"]
    # A week on, it may ring again.
    note.created_at = now - timedelta(days=8)
    await session.flush()
    await watcher.check(session, now)
    assert len(await _notes(session, teacher.id, Kind.COVERAGE_NUDGE)) == 2


async def test_a_student_is_reminded_only_of_work_that_has_waited(
    session, teacher, student
) -> None:
    _, assignment = await _class_with_syllabus(session, teacher, [student])
    watcher = CoverageWatcher(settings=get_settings(), session_maker=None)  # type: ignore[arg-type]
    now = datetime.now(UTC)
    await watcher.check(session, now)
    assert await _notes(session, student.id, Kind.KEEP_UP) == []
    # Shared three days ago and still not done: a reminder, once.
    assignment.created_at = now - timedelta(days=3)
    await session.flush()
    await watcher.check(session, now)
    await watcher.check(session, now)
    [note] = await _notes(session, student.id, Kind.KEEP_UP)
    assert note.payload["assignment_id"] == str(assignment.id)
    assert note.payload["topic"] == "Plants"
