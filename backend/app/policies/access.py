"""Whether a particular person may reach a particular thing.

Capabilities answer "may a student do this at all?"; these answer "may this
student open *this* assignment?". A student reaches an assignment when their
membership of its class is approved and — if it was shared with groups — they
are in one of those groups. Everyone else gets "not found", never
"forbidden", which would confirm it exists.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.classroom import ClassMembership, GroupMember
from app.db.models.learning import Assignment, AssignmentGroup


def visible_to(student_id: UUID):
    """A filter on `Assignment`: the ones this student is in the audience of."""
    in_class = exists().where(
        ClassMembership.class_id == Assignment.class_id,
        ClassMembership.student_id == student_id,
        ClassMembership.status == "approved",
    )
    targeted = exists().where(AssignmentGroup.assignment_id == Assignment.id)
    in_a_target = exists().where(
        AssignmentGroup.assignment_id == Assignment.id,
        AssignmentGroup.group_id == GroupMember.group_id,
        GroupMember.student_id == student_id,
    )
    return in_class & (~targeted | in_a_target)


async def assignment_for_student(
    session: AsyncSession, student_id: UUID, assignment_id: UUID
) -> Assignment | None:
    return (
        await session.execute(
            select(Assignment).where(Assignment.id == assignment_id, visible_to(student_id))
        )
    ).scalar_one_or_none()
