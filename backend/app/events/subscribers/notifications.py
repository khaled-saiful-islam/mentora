"""What goes in the bell when something happens.

One function per event. The services that publish these never import this
module — that is the point.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.notifications import Kind
from app.events.catalog import (
    MembershipApproved,
    MembershipEnded,
    MembershipRejected,
    MembershipRequested,
)
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
