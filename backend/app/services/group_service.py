"""Groups within a class — subsets of its admitted students.

A student can be in any number of groups in a class. Only students whose
membership is approved can be put in one; a pending request or an outsider is
refused by count, so a teacher knows how many to fix.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.palette import THEMES, is_theme
from app.db.models.classroom import ClassGroup, Classroom, GroupMember
from app.db.repositories.classes import ClassRepository, GroupRepository, MembershipRepository

MAX_GROUP_SIZE = 500


@dataclass(frozen=True, slots=True)
class GroupView:
    group: ClassGroup
    member_ids: list[UUID]


class GroupService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._classes = ClassRepository(session)
        self._groups = GroupRepository(session)
        self._members = MembershipRepository(session)

    async def list(self, teacher_id: UUID, class_id: UUID) -> list[GroupView]:
        await self._owned(teacher_id, class_id)
        found = await self._groups.for_class(class_id)
        members = await self._groups.member_ids([g.id for g in found])
        return [GroupView(group=g, member_ids=members[g.id]) for g in found]

    async def create(
        self, teacher_id: UUID, class_id: UUID, *, name: str, colour: str = "sky"
    ) -> ClassGroup:
        await self._owned(teacher_id, class_id)
        cleaned = await self._free_name(class_id, name)
        group = ClassGroup(class_id=class_id, name=cleaned, colour=_colour(colour))
        self._session.add(group)
        await self._session.flush()
        return group

    async def update(
        self,
        teacher_id: UUID,
        class_id: UUID,
        group_id: UUID,
        *,
        name: str | None = None,
        colour: str | None = None,
    ) -> ClassGroup:
        group = await self._group(teacher_id, class_id, group_id)
        if name is not None and name.strip().lower() != group.name.lower():
            group.name = await self._free_name(class_id, name)
        if colour is not None:
            group.colour = _colour(colour)
        await self._session.flush()
        return group

    async def delete(self, teacher_id: UUID, class_id: UUID, group_id: UUID) -> None:
        group = await self._group(teacher_id, class_id, group_id)
        await self._session.delete(group)
        await self._session.flush()

    async def set_members(
        self, teacher_id: UUID, class_id: UUID, group_id: UUID, student_ids: list[UUID]
    ) -> GroupView:
        group = await self._group(teacher_id, class_id, group_id)
        wanted = list(dict.fromkeys(student_ids))
        if len(wanted) > MAX_GROUP_SIZE:
            raise ValidationError(f"A group can hold at most {MAX_GROUP_SIZE} students.")
        admitted = await self._members.approved_ids(class_id, wanted)
        strays = [sid for sid in wanted if sid not in admitted]
        if strays:
            raise ValidationError(
                f"{len(strays)} of these students are not in this class yet — approve them first."
            )
        await self._session.execute(delete(GroupMember).where(GroupMember.group_id == group.id))
        self._session.add_all(GroupMember(group_id=group.id, student_id=sid) for sid in wanted)
        await self._session.flush()
        return GroupView(group=group, member_ids=wanted)

    async def _owned(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        classroom = await self._classes.owned(class_id, teacher_id)
        if classroom is None:
            raise NotFoundError("No such class.")
        return classroom

    async def _group(self, teacher_id: UUID, class_id: UUID, group_id: UUID) -> ClassGroup:
        await self._owned(teacher_id, class_id)
        group = await self._groups.in_class(group_id, class_id)
        if group is None:
            raise NotFoundError("No such group.")
        return group

    async def _free_name(self, class_id: UUID, raw: str) -> str:
        name = " ".join(raw.split())
        if not 1 <= len(name) <= 80:
            raise ValidationError("A group name must be 1-80 characters.")
        if await self._groups.named(class_id, name):
            raise ConflictError("This class already has a group with that name.")
        return name


def _colour(key: str) -> str:
    if not is_theme(key):
        raise ValidationError(f"Colour must be one of: {', '.join(THEMES)}.")
    return key
