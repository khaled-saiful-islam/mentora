"""What a change pushes live, and to whom. Pushes wait on the session until it
commits; a test's session never commits, so these read the queue itself."""

from __future__ import annotations

from sqlalchemy import select

from app.db.models.classroom import ClassMembership
from app.events.registry import build_bus
from app.moderation.base import Flag
from app.services.assignment_service import AssignmentService
from app.services.attempt_service import AttemptService
from app.services.membership_service import MembershipService
from app.services.moderation_service import ModerationService, Where
from app.services.results_service import ResultsService
from tests.play_helpers import class_with, right_choice, shared

PENDING = "mentora.realtime.pending"


def pushed(session, topic: str) -> list[tuple]:
    queued = session.sync_session.info.get(PENDING, [])
    return [(user_id, message) for user_id, message in queued if message.get("topic") == topic]


async def test_a_teacher_watches_a_student_start_and_answer(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    service = AttemptService(session, bus=build_bus())
    view = await service.start(student, assignment.id)
    first = view.items[0]["id"]
    await service.answer(
        student.id, view.attempt.id, first, {"choice": right_choice(view, first)}, 900
    )

    steps = [m for u, m in pushed(session, "progress") if u == teacher.id]
    assert [m["answered"] for m in steps] == [0, 1]
    assert steps[-1]["student_id"] == str(student.id) and steps[-1]["total"] == 5

    results = await ResultsService(session, build_bus()).for_assignment(teacher.id, assignment.id)
    [row] = [r for r in results.students if r.student_id == student.id]
    assert (row.status, row.answered, row.total) == ("in_progress", 1, 5)
    assert row.active_at is not None


async def test_practice_is_nobody_else_s_business(session, student) -> None:
    from tests.play_helpers import ready_set

    practice = await ready_set(session, student, purpose="practice")
    await AttemptService(session, bus=build_bus()).start_practice(student, practice.id)
    assert pushed(session, "progress") == []


async def test_sharing_and_closing_reach_the_class_at_once(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    assert student.id in [u for u, _ in pushed(session, "assignments")]
    await AssignmentService(session, build_bus()).update(teacher.id, assignment.id, closed=True)
    closing = [m for u, m in pushed(session, "assignments") if u == student.id and m.get("closed")]
    assert closing and closing[0]["assignment_id"] == str(assignment.id)


async def test_joining_updates_the_teacher_and_approval_updates_the_student(
    session, teacher, student
) -> None:
    class_id = await class_with(session, teacher, [student])
    assert (teacher.id, {"topic": "members", "class_id": str(class_id)}) in pushed(
        session, "members"
    )
    assert (student.id, {"topic": "classes", "class_id": str(class_id)}) in pushed(
        session, "classes"
    )
    membership = (
        await session.execute(
            select(ClassMembership).where(ClassMembership.student_id == student.id)
        )
    ).scalar_one()
    await MembershipService(session, build_bus()).revoke(teacher.id, class_id, membership.id)
    assert len([u for u, _ in pushed(session, "classes") if u == student.id]) >= 1


async def test_a_new_safety_item_refreshes_every_admin_s_queue(session, student, account) -> None:
    admin = await account("admin", "Admin")
    await ModerationService(session).record(
        Flag(kind="held", source="user_input", severity="medium"), Where(user_id=student.id)
    )
    assert (admin.id, {"topic": "moderation", "severity": "medium"}) in pushed(
        session, "moderation"
    )
