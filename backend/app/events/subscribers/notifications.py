"""What goes in the bell when something happens.

One function per event. The services that publish these never import this
module — that is the point.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.notifications import Kind
from app.core.roles import Role
from app.db.models.user import User
from app.events.catalog import (
    AssignmentShared,
    AttemptCompleted,
    BadgeAwarded,
    MembershipApproved,
    MembershipEnded,
    MembershipRejected,
    MembershipRequested,
    StudentNeedsSupport,
)
from app.learning.registry import build_learning_kinds
from app.services.notification_service import NotificationService


async def join_requested(event: MembershipRequested, session: AsyncSession) -> None:
    await NotificationService(session).notify(
        user_id=event.teacher_id,
        kind=Kind.JOIN_REQUEST,
        actor_id=event.student_id,
        payload={
            "membership_id": str(event.membership_id),
            "class_id": str(event.class_id),
            "class_name": event.class_name,
            "student_id": str(event.student_id),
            "student_name": event.student_name,
            "grade_label": event.grade_label,
        },
    )


async def join_approved(event: MembershipApproved, session: AsyncSession) -> None:
    bell = NotificationService(session)
    await bell.notify(
        user_id=event.student_id,
        kind=Kind.JOIN_APPROVED,
        actor_id=event.teacher_id,
        payload={
            "class_id": str(event.class_id),
            "class_name": event.class_name,
            "teacher_name": event.teacher_name,
        },
    )
    await _settle(bell, event.teacher_id, event.membership_id, "approved")


async def join_rejected(event: MembershipRejected, session: AsyncSession) -> None:
    # Deliberately no message to the student: "you were turned down" is not
    # news a child needs pushed at them. Their class list shows the status.
    await _settle(NotificationService(session), event.teacher_id, event.membership_id, "rejected")


async def membership_ended(event: MembershipEnded, session: AsyncSession) -> None:
    if event.how == "left":
        await _settle(
            NotificationService(session), event.teacher_id, event.membership_id, "withdrawn"
        )


async def _settle(bell: NotificationService, teacher_id, membership_id, resolution: str) -> None:
    await bell.resolve(
        user_id=teacher_id,
        kind=Kind.JOIN_REQUEST,
        match={"membership_id": str(membership_id)},
        resolution=resolution,
    )


def _kind_word(kind: str) -> str:
    """What the bell calls it: "quiz", "flashcards", "study guide"."""
    found = build_learning_kinds().get(kind)
    return found.label.lower() if found else "activity"


async def assignment_shared(event: AssignmentShared, session: AsyncSession) -> None:
    bell = NotificationService(session)
    payload = {
        "assignment_id": str(event.assignment_id),
        "title": event.title,
        "kind": _kind_word(event.kind),
        "class_id": str(event.class_id),
        "class_name": event.class_name,
        "teacher_name": event.teacher_name,
        "due_at": event.due_at,
    }
    for student_id in event.student_ids:
        await bell.notify(
            user_id=student_id,
            kind=Kind.ASSIGNMENT_SHARED,
            actor_id=event.teacher_id,
            payload=payload,
            # One per assignment per student, even if it is shared again.
            group_key=f"assignment:{event.assignment_id}",
        )


async def attempt_completed(event: AttemptCompleted, session: AsyncSession) -> None:
    if event.assignment_id is None or event.teacher_id is None:
        return  # practice is the student's own business
    await NotificationService(session).notify(
        user_id=event.teacher_id,
        kind=Kind.COMPLETION,
        actor_id=event.student_id,
        payload={
            "assignment_id": str(event.assignment_id),
            "title": event.title,
            "class_name": event.class_name,
            "actors": [event.student_name],
            # The latest finisher's score, for the pop-up that says so.
            "percent": round(event.percent),
            "kind": event.kind,
        },
        # Five students finishing is one line that says five.
        group_key=f"completion:{event.assignment_id}",
    )


async def badge_awarded(event: BadgeAwarded, session: AsyncSession) -> None:
    await NotificationService(session).notify(
        user_id=event.student_id,
        kind=Kind.BADGE_AWARDED,
        payload={"badge": event.badge, "badge_name": event.name, "reason": event.reason},
    )


async def student_needs_support(event: StudentNeedsSupport, session: AsyncSession) -> None:
    """Every active admin hears at once. What the student said stays in the
    moderation queue; the bell carries only that someone should look."""
    admins = (
        await session.execute(
            select(User.id).where(User.role == Role.ADMIN.value, User.is_active.is_(True))
        )
    ).scalars()
    bell = NotificationService(session)
    for admin_id in admins:
        await bell.notify(
            user_id=admin_id,
            kind=Kind.SAFETY_ALERT,
            actor_id=event.student_id,
            payload={
                "event_id": str(event.event_id),
                "student_id": str(event.student_id),
                "student_name": event.student_name,
                "category": event.category,
            },
        )
