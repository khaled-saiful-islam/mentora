"""A teacher's home: who is waiting, who is working, how recent shares went."""

from __future__ import annotations

from app.events.registry import build_bus
from app.services.attempt_service import AttemptService
from app.services.membership_service import MembershipService
from app.services.play_service import PlayService
from app.services.teaching_service import TeachingService
from tests.play_helpers import right_choice, shared


async def test_the_home_counts_the_class_the_work_and_who_is_on_it(
    session, teacher, account
) -> None:
    done = await account("student")
    going = await account("student")
    idle = await account("student")
    assignment = await shared(session, teacher, [done, going, idle])

    attempts = AttemptService(session)
    finished = await attempts.start(done, assignment.id)
    for item in finished.items:
        await attempts.answer(
            done.id,
            finished.attempt.id,
            item["id"],
            {"choice": right_choice(finished, item["id"])},
            800,
        )
    await PlayService(session, build_bus()).finish(done, finished.attempt.id)
    started = await attempts.start(going, assignment.id)
    first = started.items[0]["id"]
    await attempts.answer(going.id, started.attempt.id, first, {"choice": 0}, 800)

    home = await TeachingService(session).overview(teacher.id)
    [recent] = [a for a in home.recent if a.assignment.id == assignment.id]
    assert (recent.audience, recent.completed, recent.in_progress) == (3, 1, 1)
    assert recent.average == 100.0
    assert home.live_now >= 1
    assert home.classes and home.classes[0].students == 3


async def test_waiting_requests_are_counted_across_classes(session, teacher, account) -> None:
    from app.services.class_service import ClassService
    from app.services.invite_service import InviteService

    room = await ClassService(session).create(teacher, name="4 Ceria")
    code = (await InviteService(session).for_class(teacher.id, room.id)).code
    for _ in range(2):
        await MembershipService(session, build_bus()).request(await account("student"), code)
    home = await TeachingService(session).overview(teacher.id)
    assert home.pending >= 2


async def test_a_teacher_sees_only_their_own(session, teacher, student, account) -> None:
    await shared(session, teacher, [student])
    other = await account("teacher", "Cikgu Lain")
    home = await TeachingService(session).overview(other.id)
    assert home.recent == [] and home.classes == [] and home.pending == 0
