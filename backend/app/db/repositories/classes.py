"""Data access for classes, memberships, invites and groups.

Ownership is a parameter of the lookup, never a check the caller must
remember: `owned(class_id, teacher_id)` returns nothing for someone else's
class, so a forgotten check cannot leak one.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.classroom import (
    ClassGroup,
    ClassInvite,
    ClassMembership,
    Classroom,
    GroupMember,
)
from app.db.models.user import User


@dataclass(frozen=True, slots=True)
class ClassCounts:
    students: int
    pending: int
    groups: int


class ClassRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def owned(self, class_id: UUID, teacher_id: UUID) -> Classroom | None:
        return (
            await self._session.execute(
                select(Classroom).where(
                    Classroom.id == class_id, Classroom.teacher_id == teacher_id
                )
            )
        ).scalar_one_or_none()

    async def for_teacher(self, teacher_id: UUID, *, archived: bool) -> list[Classroom]:
        state = Classroom.archived_at.is_not(None) if archived else Classroom.archived_at.is_(None)
        query = (
            select(Classroom)
            .where(Classroom.teacher_id == teacher_id, state)
            .order_by(Classroom.created_at.desc())
        )
        return list((await self._session.execute(query)).scalars().all())

    async def counts(self, class_ids: list[UUID]) -> dict[UUID, ClassCounts]:
        """Students, pending requests and groups per class, in two queries."""
        if not class_ids:
            return {}
        members = await self._session.execute(
            select(ClassMembership.class_id, ClassMembership.status, func.count())
            .where(
                ClassMembership.class_id.in_(class_ids),
                ClassMembership.status.in_(("approved", "pending")),
            )
            .group_by(ClassMembership.class_id, ClassMembership.status)
        )
        tally: dict[UUID, dict[str, int]] = {cid: {} for cid in class_ids}
        for class_id, status, count in members.all():
            tally[class_id][status] = count
        groups = dict(
            (
                await self._session.execute(
                    select(ClassGroup.class_id, func.count())
                    .where(ClassGroup.class_id.in_(class_ids))
                    .group_by(ClassGroup.class_id)
                )
            ).all()
        )
        return {
            cid: ClassCounts(
                students=tally[cid].get("approved", 0),
                pending=tally[cid].get("pending", 0),
                groups=int(groups.get(cid, 0)),
            )
            for cid in class_ids
        }

    async def teacher(self, classroom: Classroom) -> User | None:
        return await self._session.get(User, classroom.teacher_id)


class InviteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def for_class(self, class_id: UUID) -> ClassInvite | None:
        return (
            await self._session.execute(select(ClassInvite).where(ClassInvite.class_id == class_id))
        ).scalar_one_or_none()

    async def by_token_or_code(self, key: str) -> ClassInvite | None:
        return (
            await self._session.execute(
                select(ClassInvite).where(
                    or_(ClassInvite.token == key, ClassInvite.code == key.upper())
                )
            )
        ).scalar_one_or_none()

    async def code_taken(self, code: str) -> bool:
        return (
            await self._session.scalar(select(func.count()).where(ClassInvite.code == code))
        ) > 0


class MembershipRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def in_class(self, membership_id: UUID, class_id: UUID) -> ClassMembership | None:
        return (
            await self._session.execute(
                select(ClassMembership).where(
                    ClassMembership.id == membership_id, ClassMembership.class_id == class_id
                )
            )
        ).scalar_one_or_none()

    async def of(self, class_id: UUID, student_id: UUID) -> ClassMembership | None:
        return (
            await self._session.execute(
                select(ClassMembership).where(
                    ClassMembership.class_id == class_id, ClassMembership.student_id == student_id
                )
            )
        ).scalar_one_or_none()

    def listing(self, class_id: UUID, status: str | None, q: str | None) -> Select:
        query = (
            select(ClassMembership, User)
            .join(User, User.id == ClassMembership.student_id)
            .where(ClassMembership.class_id == class_id)
        )
        if status:
            query = query.where(ClassMembership.status == status)
        if q:
            like = f"%{q.strip().lower()}%"
            query = query.where(
                or_(func.lower(User.display_name).like(like), User.username.like(like))
            )
        return query

    async def page(
        self, class_id: UUID, *, status: str | None, q: str | None, limit: int, offset: int
    ) -> tuple[list[tuple[ClassMembership, User]], int]:
        query = self.listing(class_id, status, q)
        total = await self._session.scalar(select(func.count()).select_from(query.subquery()))
        rows = await self._session.execute(
            query.order_by(ClassMembership.requested_at.desc()).limit(limit).offset(offset)
        )
        return [(m, u) for m, u in rows.all()], int(total or 0)

    async def pending(self, class_id: UUID) -> list[ClassMembership]:
        return list(
            (
                await self._session.execute(
                    select(ClassMembership).where(
                        ClassMembership.class_id == class_id, ClassMembership.status == "pending"
                    )
                )
            )
            .scalars()
            .all()
        )

    async def for_student(self, student_id: UUID) -> list[tuple[ClassMembership, Classroom, User]]:
        rows = await self._session.execute(
            select(ClassMembership, Classroom, User)
            .join(Classroom, Classroom.id == ClassMembership.class_id)
            .join(User, User.id == Classroom.teacher_id)
            .where(ClassMembership.student_id == student_id, Classroom.archived_at.is_(None))
            .order_by(ClassMembership.requested_at.desc())
        )
        return [(m, c, u) for m, c, u in rows.all()]

    async def approved_ids(self, class_id: UUID, student_ids: list[UUID]) -> set[UUID]:
        if not student_ids:
            return set()
        rows = await self._session.execute(
            select(ClassMembership.student_id).where(
                ClassMembership.class_id == class_id,
                ClassMembership.status == "approved",
                ClassMembership.student_id.in_(student_ids),
            )
        )
        return set(rows.scalars().all())


class GroupRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def in_class(self, group_id: UUID, class_id: UUID) -> ClassGroup | None:
        return (
            await self._session.execute(
                select(ClassGroup).where(ClassGroup.id == group_id, ClassGroup.class_id == class_id)
            )
        ).scalar_one_or_none()

    async def named(self, class_id: UUID, name: str) -> ClassGroup | None:
        return (
            await self._session.execute(
                select(ClassGroup).where(
                    ClassGroup.class_id == class_id, func.lower(ClassGroup.name) == name.lower()
                )
            )
        ).scalar_one_or_none()

    async def for_class(self, class_id: UUID) -> list[ClassGroup]:
        return list(
            (
                await self._session.execute(
                    select(ClassGroup)
                    .where(ClassGroup.class_id == class_id)
                    .order_by(ClassGroup.created_at)
                )
            )
            .scalars()
            .all()
        )

    async def member_ids(self, group_ids: list[UUID]) -> dict[UUID, list[UUID]]:
        found: dict[UUID, list[UUID]] = {gid: [] for gid in group_ids}
        if not group_ids:
            return found
        rows = await self._session.execute(
            select(GroupMember.group_id, GroupMember.student_id)
            .where(GroupMember.group_id.in_(group_ids))
            .order_by(GroupMember.added_at)
        )
        for group_id, student_id in rows.all():
            found[group_id].append(student_id)
        return found

    async def names_for_student(
        self, student_id: UUID, class_ids: list[UUID]
    ) -> dict[UUID, list[str]]:
        found: dict[UUID, list[str]] = {cid: [] for cid in class_ids}
        if not class_ids:
            return found
        rows = await self._session.execute(
            select(ClassGroup.class_id, ClassGroup.name)
            .join(GroupMember, GroupMember.group_id == ClassGroup.id)
            .where(GroupMember.student_id == student_id, ClassGroup.class_id.in_(class_ids))
            .order_by(ClassGroup.name)
        )
        for class_id, name in rows.all():
            found[class_id].append(name)
        return found
