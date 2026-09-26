"""A class card at a glance: what is shared, how it is going, what is next."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.db.models.live import LiveSession
from app.events.registry import build_bus
from app.services.attempt_service import AttemptService
from app.services.class_pulse import ClassPulseService
from app.services.play_service import PlayService
from tests.play_helpers import right_choice, shared


async def _finish(session, student, assignment) -> None:
    attempts = AttemptService(session)
    started = await attempts.start(student, assignment.id)
    for item in started.items:
        choice = {"choice": right_choice(started, item["id"])}
        await attempts.answer(student.id, started.attempt.id, item["id"], choice, 800)
    await PlayService(session, build_bus()).finish(student, started.attempt.id)


async def _live(session, assignment, group_id, *, status: str, hours: float) -> LiveSession:
    live = LiveSession(
        teacher_id=assignment.teacher_id,
        class_id=assignment.class_id,
        group_id=group_id,
        title=f"Lesson in {hours}h",
        settings={},
        status=status,
        scheduled_at=datetime.now(UTC) + timedelta(hours=hours),
    )
    session.add(live)
    await session.flush()
    return live


async def _group(session, teacher, assignment, students) -> object:
    from app.services.group_service import GroupService

    groups = GroupService(session)
    group = await groups.create(teacher.id, assignment.class_id, name="Stars")
    await groups.set_members(teacher.id, assignment.class_id, group.id, [s.id for s in students])
    return group


async def test_a_teacher_card_counts_what_is_shared_and_how_it_went(
    session, teacher, account
) -> None:
    done = await account("student", "Aina")
    idle = await account("student", "Hafiz")
    assignment = await shared(session, teacher, [done, idle])
    await _finish(session, done, assignment)

    pulses = await ClassPulseService(session).for_teacher([assignment.class_id])
    pulse = pulses[assignment.class_id]
    assert pulse.shared == 1
    assert pulse.average == 100.0
    assert pulse.finished_week == 1
    assert set(pulse.faces) == {"Aina", "Hafiz"}
    assert pulse.next_live is None


async def test_the_next_live_lesson_is_the_soonest_one_coming(session, teacher, account) -> None:
    student = await account("student")
    assignment = await shared(session, teacher, [student])
    group = await _group(session, teacher, assignment, [student])
    await _live(session, assignment, group.id, status="scheduled", hours=48)
    soon = await _live(session, assignment, group.id, status="scheduled", hours=2)
    await _live(session, assignment, group.id, status="draft", hours=1)

    pulse = (await ClassPulseService(session).for_teacher([assignment.class_id]))[
        assignment.class_id
    ]
    assert pulse.next_live is not None and pulse.next_live.id == soon.id


async def test_a_student_card_says_what_is_left_and_what_is_next(session, teacher, account) -> None:
    student = await account("student")
    first = await shared(session, teacher, [student])
    await _finish(session, student, first)
    group = await _group(session, teacher, first, [student])
    soon = await _live(session, first, group.id, status="scheduled", hours=3)

    pulses = await ClassPulseService(session).for_student(student)
    pulse = pulses[first.class_id]
    assert (pulse.to_do, pulse.done) == (0, 1)
    assert pulse.next_live is not None and pulse.next_live.id == soon.id


async def test_no_classes_costs_nothing(session) -> None:
    assert await ClassPulseService(session).for_teacher([]) == {}


async def test_the_class_list_carries_the_pulse(client, session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(teacher) as c:
        mine = (await c.get("/api/classes")).json()["items"]
    [card] = [c for c in mine if c["id"] == str(assignment.class_id)]
    assert card["pulse"]["shared"] == 1
    async with client(student) as c:
        theirs = (await c.get("/api/me/classes")).json()["items"]
    [tile] = [c for c in theirs if c["class_id"] == str(assignment.class_id)]
    assert tile["pulse"]["to_do"] == 1
