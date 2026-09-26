"""Live pushes that are not notifications: "something you have open just
changed". Each carries a topic and just enough to know whether the open page
cares; the page then refetches, so the database stays the only truth and a
missed push costs nothing but a moment's staleness.

    classes       a student's class list and class pages
    members       a teacher's class: students and requests
    assignments   what is shared in a class, and its status
    progress      a teacher watching results: a student started, answered, finished
    leaderboard   a quiz's board
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.catalog import (
    AssignmentChanged,
    AssignmentShared,
    AttemptCompleted,
    AttemptProgressed,
    LiveSessionCancelled,
    LiveSessionScheduled,
    MembershipApproved,
    MembershipEnded,
    MembershipRejected,
    MembershipRequested,
)
from app.services.realtime import push_after_commit


def _push(session: AsyncSession, users: Iterable[UUID | None], message: dict[str, Any]) -> None:
    for user_id in {u for u in users if u is not None}:
        push_after_commit(session, user_id, message)


async def leaderboard_changed(event: AttemptCompleted, session: AsyncSession) -> None:
    if not event.leaderboard or event.assignment_id is None:
        return
    message = {"topic": "leaderboard", "assignment_id": str(event.assignment_id)}
    _push(session, [*event.audience, event.teacher_id], message)


async def join_requested(event: MembershipRequested, session: AsyncSession) -> None:
    _push(session, [event.teacher_id], {"topic": "members", "class_id": str(event.class_id)})


async def membership_decided(
    event: MembershipApproved | MembershipRejected | MembershipEnded, session: AsyncSession
) -> None:
    class_id = str(event.class_id)
    _push(session, [event.teacher_id], {"topic": "members", "class_id": class_id})
    _push(session, [event.student_id], {"topic": "classes", "class_id": class_id})


async def assignment_shared(event: AssignmentShared, session: AsyncSession) -> None:
    message = {
        "topic": "assignments",
        "class_id": str(event.class_id),
        "assignment_id": str(event.assignment_id),
    }
    _push(session, [*event.student_ids, event.teacher_id], message)


async def assignment_changed(event: AssignmentChanged, session: AsyncSession) -> None:
    message = {
        "topic": "assignments",
        "class_id": str(event.class_id),
        "assignment_id": str(event.assignment_id),
        "closed": event.closed,
    }
    _push(session, [*event.audience, event.teacher_id], message)


async def attempt_progressed(event: AttemptProgressed, session: AsyncSession) -> None:
    message = {
        "topic": "progress",
        "assignment_id": str(event.assignment_id),
        "student_id": str(event.student_id),
        "answered": event.answered,
        "total": event.total,
    }
    _push(session, [event.teacher_id], message)


async def attempt_finished(event: AttemptCompleted, session: AsyncSession) -> None:
    if event.assignment_id is None:
        return
    assignment_id = str(event.assignment_id)
    _push(
        session,
        [event.teacher_id],
        {
            "topic": "progress",
            "assignment_id": assignment_id,
            "student_id": str(event.student_id),
            "done": True,
            "percent": round(event.percent),
        },
    )
    # The student's other tabs: their home shows it done.
    _push(session, [event.student_id], {"topic": "assignments", "assignment_id": assignment_id})


async def live_changed(
    event: LiveSessionScheduled | LiveSessionCancelled, session: AsyncSession
) -> None:
    """A schedule someone has open just changed."""
    message = {"topic": "live", "session_id": str(event.session_id)}
    _push(session, [*event.student_ids, event.teacher_id], message)
