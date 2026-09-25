"""Who is in a class: asking to join, being let in, leaving, being removed.

A membership row is never deleted. Its status moves —
pending → approved | rejected, approved → revoked | left — so the record of
a student having been in a class, and the results they earned there, outlive
them going. Asking again reopens a closed row as pending.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.grades import grade_label
from app.db.models.classroom import ClassGroup, ClassMembership, Classroom, GroupMember
from app.db.models.user import User
from app.db.repositories.classes import ClassRepository, GroupRepository, MembershipRepository
from app.events.bus import EventBus
from app.events.catalog import (
    MembershipApproved,
    MembershipEnded,
    MembershipRejected,
    MembershipRequested,
)
from app.policies.capabilities import capabilities_for
from app.services.invite_service import InvitePreview, InviteService

PAGE_SIZE = 50


@dataclass(frozen=True, slots=True)
class JoinOutcome:
    # "requested": asked just now. "pending": already waiting. "member": already in.
    status: str
    preview: InvitePreview


@dataclass(frozen=True, slots=True)
class MemberView:
    membership_id: UUID
    student_id: UUID
    name: str
    username: str | None
    grade_label: str | None
    buddy: str | None
    status: str
    requested_at: datetime


@dataclass(frozen=True, slots=True)
class MemberPage:
    items: list[MemberView]
    total: int


@dataclass(frozen=True, slots=True)
class StudentClassView:
    class_id: UUID
    class_name: str
    subject: str | None
    theme: str
    teacher_name: str
    status: str
    groups: list[str]


class MembershipService:
    def __init__(self, session: AsyncSession, bus: EventBus) -> None:
        self._session = session
        self._bus = bus
        self._classes = ClassRepository(session)
        self._members = MembershipRepository(session)
        self._invites = InviteService(session)

    # --- students ---------------------------------------------------------

    async def request(self, student: User, invite_key: str) -> JoinOutcome:
        if not capabilities_for(student.role).join_classes:
            raise ForbiddenError("Only students join classes.")
        _, classroom = await self._invites.resolve(invite_key)
        preview = await self._invites.lookup(invite_key)
        membership = await self._members.of(classroom.id, student.id)
        if membership is not None and membership.status in ("approved", "pending"):
            return JoinOutcome("member" if membership.status == "approved" else "pending", preview)

        membership = await self._open(classroom.id, student.id, membership)
        await self._bus.publish(
            MembershipRequested(
                membership_id=membership.id,
                class_id=classroom.id,
                class_name=classroom.name,
                teacher_id=classroom.teacher_id,
                student_id=student.id,
                student_name=student.display_name or student.sign_in_name,
                grade_label=grade_label(student.grade_level),
            ),
            self._session,
        )
        return JoinOutcome("requested", preview)

    async def _open(
        self, class_id: UUID, student_id: UUID, existing: ClassMembership | None
    ) -> ClassMembership:
        now = datetime.now(UTC)
        if existing is None:
            existing = ClassMembership(class_id=class_id, student_id=student_id, status="pending")
            self._session.add(existing)
        else:
            existing.status = "pending"
            existing.decided_at = None
            existing.decided_by = None
            existing.requested_at = now
        await self._session.flush()
        return existing

    async def leave(self, student_id: UUID, class_id: UUID) -> ClassMembership:
        membership = await self._members.of(class_id, student_id)
        if membership is None or membership.status not in ("approved", "pending"):
            raise NotFoundError("You are not in that class.")
        classroom = await self._session.get(Classroom, class_id)
        await self._end(membership, "left", decided_by=student_id)
        await self._bus.publish(
            MembershipEnded(membership.id, class_id, classroom.teacher_id, student_id, "left"),
            self._session,
        )
        return membership

    async def classes_of(self, student_id: UUID) -> list[StudentClassView]:
        rows = await self._members.for_student(student_id)
        groups = await GroupRepository(self._session).names_for_student(
            student_id, [c.id for _, c, _ in rows]
        )
        return [
            StudentClassView(
                class_id=classroom.id,
                class_name=classroom.name,
                subject=classroom.subject,
                theme=classroom.theme,
                teacher_name=teacher.display_name or "your teacher",
                status=membership.status,
                groups=groups.get(classroom.id, []),
            )
            for membership, classroom, teacher in rows
        ]

    # --- teachers ---------------------------------------------------------

    async def approve(
        self, teacher_id: UUID, class_id: UUID, membership_id: UUID
    ) -> ClassMembership:
        classroom, membership = await self._decidable(teacher_id, class_id, membership_id)
        self._decide(membership, "approved", teacher_id)
        await self._session.flush()
        await self._announce_approval(classroom, membership)
        return membership

    async def approve_all(self, teacher_id: UUID, class_id: UUID) -> int:
        classroom = await self._owned(teacher_id, class_id)
        waiting = await self._members.pending(class_id)
        for membership in waiting:
            self._decide(membership, "approved", teacher_id)
        await self._session.flush()
        for membership in waiting:
            await self._announce_approval(classroom, membership)
        return len(waiting)

    async def reject(
        self, teacher_id: UUID, class_id: UUID, membership_id: UUID
    ) -> ClassMembership:
        _, membership = await self._decidable(teacher_id, class_id, membership_id)
        self._decide(membership, "rejected", teacher_id)
        await self._session.flush()
        await self._bus.publish(
            MembershipRejected(membership.id, class_id, teacher_id, membership.student_id),
            self._session,
        )
        return membership

    async def revoke(
        self, teacher_id: UUID, class_id: UUID, membership_id: UUID
    ) -> ClassMembership:
        await self._owned(teacher_id, class_id)
        membership = await self._members.in_class(membership_id, class_id)
        if membership is None or membership.status != "approved":
            raise NotFoundError("That student is not in this class.")
        await self._end(membership, "revoked", decided_by=teacher_id)
        await self._bus.publish(
            MembershipEnded(membership.id, class_id, teacher_id, membership.student_id, "revoked"),
            self._session,
        )
        return membership

    async def members(
        self,
        teacher_id: UUID,
        class_id: UUID,
        *,
        status: str | None = None,
        q: str | None = None,
        limit: int = PAGE_SIZE,
        offset: int = 0,
    ) -> MemberPage:
        await self._owned(teacher_id, class_id)
        rows, total = await self._members.page(
            class_id, status=status, q=q, limit=min(limit, 200), offset=max(offset, 0)
        )
        return MemberPage(items=[_view(m, u) for m, u in rows], total=total)

    # --- internals --------------------------------------------------------

    async def _owned(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        classroom = await self._classes.owned(class_id, teacher_id)
        if classroom is None:
            raise NotFoundError("No such class.")
        return classroom

    async def _decidable(
        self, teacher_id: UUID, class_id: UUID, membership_id: UUID
    ) -> tuple[Classroom, ClassMembership]:
        classroom = await self._owned(teacher_id, class_id)
        membership = await self._members.in_class(membership_id, class_id)
        if membership is None:
            raise NotFoundError("No such request.")
        if membership.status != "pending":
            raise ConflictError("That request has already been decided.")
        return classroom, membership

    @staticmethod
    def _decide(membership: ClassMembership, status: str, teacher_id: UUID) -> None:
        membership.status = status
        membership.decided_at = datetime.now(UTC)
        membership.decided_by = teacher_id

    async def _end(self, membership: ClassMembership, status: str, *, decided_by: UUID) -> None:
        self._decide(membership, status, decided_by)
        # Out of every group in this class too, so group-shared work stops
        # reaching them. Their answers and results are untouched.
        groups = select(ClassGroup.id).where(ClassGroup.class_id == membership.class_id)
        await self._session.execute(
            delete(GroupMember).where(
                GroupMember.student_id == membership.student_id, GroupMember.group_id.in_(groups)
            )
        )
        await self._session.flush()

    async def _announce_approval(self, classroom: Classroom, membership: ClassMembership) -> None:
        teacher = await self._classes.teacher(classroom)
        await self._bus.publish(
            MembershipApproved(
                membership_id=membership.id,
                class_id=classroom.id,
                class_name=classroom.name,
                teacher_id=classroom.teacher_id,
                teacher_name=(teacher.display_name if teacher else None) or "your teacher",
                student_id=membership.student_id,
            ),
            self._session,
        )


def _view(membership: ClassMembership, user: User) -> MemberView:
    return MemberView(
        membership_id=membership.id,
        student_id=user.id,
        name=user.display_name or user.sign_in_name,
        username=user.username,
        grade_label=grade_label(user.grade_level),
        buddy=user.buddy,
        status=membership.status,
        requested_at=membership.requested_at,
    )
