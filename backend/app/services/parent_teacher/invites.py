"""The students whose family has not connected yet, for their teacher — and
a way to ask.

A teacher can only write to a family that is linked to the child, and only
the child can start that link (`042-parents.md`). So instead of a dead end,
the teacher sees who is missing and can ask: the student hears, in the bell,
that their teacher would like to talk with their family, and where their
invitation is. Asking again the same day says so and rings nothing.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.notifications import Kind
from app.db.models.classroom import ClassMembership, Classroom
from app.db.models.family import FamilyLink
from app.db.models.notification import Notification
from app.db.models.user import User
from app.services.notification_service import NotificationService
from app.services.parent_teacher.contacts import Side, name_of, side_of

ASK_EVERY = timedelta(days=1)
NOT_WAITING = "That student isn't in your classes, or their family is already connected."


@dataclass(frozen=True, slots=True)
class Unconnected:
    student_id: UUID
    student_name: str
    class_ids: tuple[UUID, ...]
    class_names: tuple[str, ...]


async def unconnected(session: AsyncSession, user: User) -> list[Unconnected]:
    """A teacher's students with no family linked yet; nothing for a parent."""
    if side_of(user) is not Side.TEACHER:
        return []
    rows = await session.execute(
        select(User, Classroom)
        .join(ClassMembership, ClassMembership.student_id == User.id)
        .join(Classroom, Classroom.id == ClassMembership.class_id)
        .where(
            Classroom.teacher_id == user.id,
            Classroom.archived_at.is_(None),
            ClassMembership.status == "approved",
            User.id.not_in(select(FamilyLink.student_id)),
        )
        .order_by(User.display_name, Classroom.created_at)
    )
    found: dict[UUID, Unconnected] = {}
    for student, room in rows.all():
        known = found.get(student.id)
        if known is None:
            found[student.id] = Unconnected(student.id, name_of(student), (room.id,), (room.name,))
        elif room.id not in known.class_ids:
            found[student.id] = replace(
                known,
                class_ids=(*known.class_ids, room.id),
                class_names=(*known.class_names, room.name),
            )
    return list(found.values())


async def ask_family(
    session: AsyncSession, teacher: User, student_id: UUID, *, now: datetime | None = None
) -> bool:
    """Ask a student to connect a parent. False when already asked today."""
    waiting = {u.student_id: u for u in await unconnected(session, teacher)}
    student = waiting.get(student_id)
    if student is None:
        raise NotFoundError(NOT_WAITING)
    since = (now or datetime.now(UTC)) - ASK_EVERY
    asked = await session.scalar(
        select(Notification.id)
        .where(
            Notification.user_id == student_id,
            Notification.type == Kind.FAMILY_ASKED.value,
            Notification.actor_id == teacher.id,
            Notification.created_at >= since,
        )
        .limit(1)
    )
    if asked is not None:
        return False
    await NotificationService(session).notify(
        user_id=student_id,
        kind=Kind.FAMILY_ASKED,
        actor_id=teacher.id,
        payload={"teacher_name": name_of(teacher), "class_name": student.class_names[0]},
    )
    return True
