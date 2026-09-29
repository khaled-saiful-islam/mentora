"""Who may write to whom: a parent to the teachers of each linked child, a
teacher to the linked parents of each student in their classes.

Worked out fresh on every call from the links themselves — the family link
and an approved place in a class that is not archived — so when either ends,
the conversation closes at once, for both sides, with nothing to clean up.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.errors import ForbiddenError
from app.core.roles import Role, parse_role
from app.db.models.classroom import ClassMembership, Classroom
from app.db.models.family import FamilyLink
from app.db.models.user import User


class Side(StrEnum):
    PARENT = "parent"
    TEACHER = "teacher"


@dataclass(frozen=True, slots=True)
class Contact:
    """Someone this person may write to, about one child."""

    student_id: UUID
    student_name: str
    person_id: UUID
    person_name: str
    # To a parent, "Teacher"; to a teacher, what the child calls this parent.
    relation: str
    # The classes that connect them — the teacher's, with this child in them.
    class_ids: tuple[UUID, ...]
    class_names: tuple[str, ...]

    @property
    def key(self) -> tuple[UUID, UUID]:
        return (self.student_id, self.person_id)


def side_of(user: User) -> Side:
    role = parse_role(user.role)
    if role is Role.PARENT:
        return Side.PARENT
    if role in (Role.TEACHER, Role.ADMIN):
        return Side.TEACHER
    raise ForbiddenError("Only parents and teachers can send messages.")


def name_of(user: User) -> str:
    return user.display_name or user.sign_in_name


async def contacts(session: AsyncSession, user: User) -> list[Contact]:
    side = side_of(user)
    student, other = aliased(User), aliased(User)
    query = (
        select(FamilyLink, student, other, Classroom)
        .join(ClassMembership, ClassMembership.student_id == FamilyLink.student_id)
        .join(Classroom, Classroom.id == ClassMembership.class_id)
        .join(student, student.id == FamilyLink.student_id)
        .where(ClassMembership.status == "approved", Classroom.archived_at.is_(None))
        .order_by(student.display_name, Classroom.created_at)
    )
    if side is Side.PARENT:
        query = query.join(other, other.id == Classroom.teacher_id).where(
            FamilyLink.parent_id == user.id
        )
    else:
        query = query.join(other, other.id == FamilyLink.parent_id).where(
            Classroom.teacher_id == user.id
        )
    return _grouped(side, (await session.execute(query)).all())


def _grouped(side: Side, rows) -> list[Contact]:  # noqa: ANN001 — result rows
    found: dict[tuple[UUID, UUID], Contact] = {}
    for link, student, other, room in rows:
        key = (student.id, other.id)
        known = found.get(key)
        if known is None:
            found[key] = Contact(
                student_id=student.id,
                student_name=name_of(student),
                person_id=other.id,
                person_name=name_of(other),
                relation="Teacher" if side is Side.PARENT else link.label,
                class_ids=(room.id,),
                class_names=(room.name,),
            )
        elif room.id not in known.class_ids:
            found[key] = replace(
                known,
                class_ids=(*known.class_ids, room.id),
                class_names=(*known.class_names, room.name),
            )
    return list(found.values())
