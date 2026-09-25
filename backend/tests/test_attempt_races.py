"""Two starts at once — a double tap, a retry, React's dev-mode double
effect — must end with one attempt, not two.

A test holds one connection, so it cannot race for real. It does the next
best thing: it makes the service read a stale "nothing running yet" and
checks the database refuses the twin and the service joins the attempt that
won.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.models.attempt import Attempt
from app.services.attempt_service import AttemptService
from tests.play_helpers import ready_set, shared


async def _count(session, student) -> int:
    return int(
        await session.scalar(select(func.count()).where(Attempt.student_id == student.id)) or 0
    )


def _stale(service: AttemptService, monkeypatch) -> None:
    """The service sees no attempts, as a request that read just before
    another one committed would."""

    async def nothing_yet(*_args, **_kwargs):
        return []

    monkeypatch.setattr(service, "_attempts", nothing_yet)


async def test_a_second_start_that_lost_the_race_joins_the_first(
    session, teacher, student, monkeypatch
) -> None:
    assignment = await shared(session, teacher, [student])
    first = await AttemptService(session).start(student, assignment.id)
    racing = AttemptService(session)
    _stale(racing, monkeypatch)

    second = await racing.start(student, assignment.id)

    assert second.attempt.id == first.attempt.id
    assert await _count(session, student) == 1


async def test_practice_starts_are_joined_the_same_way(session, student, monkeypatch) -> None:
    practice = await ready_set(session, student, purpose="practice")
    first = await AttemptService(session).start_practice(student, practice.id)
    racing = AttemptService(session)
    _stale(racing, monkeypatch)

    second = await racing.start_practice(student, practice.id)

    assert second.attempt.id == first.attempt.id
    assert await _count(session, student) == 1


async def test_the_database_refuses_two_attempts_running_at_once(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    view = await AttemptService(session).start(student, assignment.id)
    twin = Attempt(
        student_id=student.id,
        assignment_id=assignment.id,
        set_id=view.attempt.set_id,
        version=view.attempt.version,
        kind=view.attempt.kind,
        number=view.attempt.number + 1,
        status="in_progress",
        plan=view.attempt.plan,
    )
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(twin)
            await session.flush()
