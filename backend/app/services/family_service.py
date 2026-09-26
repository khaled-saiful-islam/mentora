"""A child's family: the invitation a child sends, the parents it links, and
the one lookup every parent read goes through.

- The child starts every link. Their invitation is a link and a 6-letter
  code, alive for `INVITE_DAYS`. A parent who signed up on their own connects
  by opening the link or typing the code.
- Only the parent ends a link (§20.0).
- `child(parent_id, student_id)` is the gate. A child who is not linked is
  *not found*, never *forbidden*: the same rule the classes use, so nobody
  can learn whether a child exists by asking.
- A dead invitation — off, expired, made anew, or never real — gets one
  answer, so guessing codes teaches nothing.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.roles import Role
from app.db.models.family import FamilyInvite, FamilyLink
from app.db.models.user import User
from app.events.bus import EventBus
from app.events.catalog import FamilyLinked
from app.services.invite_service import CODE_ALPHABET, CODE_LENGTH

INVITE_DAYS = 14
MAX_PARENTS = 4
MAX_CHILDREN = 8
LABEL_CHARS = 24
DEFAULT_LABEL = "Parent"
DEAD = "This invitation isn't working any more — ask your child to send you a new one."


@dataclass(frozen=True, slots=True)
class FamilyPreview:
    """What an invitation shows before anyone signs in: a first name and a
    buddy, and nothing else about a child."""

    first_name: str
    buddy: str | None


@dataclass(frozen=True, slots=True)
class ChildView:
    student: User
    label: str
    linked_at: datetime


@dataclass(frozen=True, slots=True)
class ParentView:
    parent: User
    label: str
    linked_at: datetime


class FamilyService:
    def __init__(
        self, session: AsyncSession, bus: EventBus | None = None, *, clock: Clock = utc_now
    ) -> None:
        self._session = session
        self._bus = bus
        self._clock = clock

    # --- the child's invitation ----------------------------------------------

    async def invite_for(self, student: User) -> FamilyInvite:
        """The child's invitation, made fresh when there is none or it expired."""
        invite = await self._invite(student.id)
        if invite is None or invite.expires_at <= self._clock():
            return await self._renew(student.id, invite)
        return invite

    async def rotate(self, student: User) -> FamilyInvite:
        """A new link and code; the old ones stop working at once."""
        return await self._renew(student.id, await self._invite(student.id))

    async def set_enabled(self, student: User, enabled: bool) -> FamilyInvite:
        invite = await self.invite_for(student)
        invite.enabled = enabled
        await self._session.flush()
        return invite

    async def preview(self, key: str) -> FamilyPreview:
        _, student = await self._alive(key)
        return FamilyPreview(first_name=first_name(student), buddy=student.buddy)

    # --- linking ---------------------------------------------------------------

    async def connect(self, parent: User, key: str, label: str | None = None) -> ChildView:
        """Link a parent to the child whose invitation this is. Already linked
        is not an error: it answers with the link there is."""
        if parent.role != Role.PARENT.value:
            raise ForbiddenError("Only a parent account can connect to a child.")
        _, student = await self._alive(key)
        existing = await self._link(parent.id, student.id)
        if existing is not None:
            return ChildView(student, existing.label, existing.created_at)
        if await self._count(FamilyLink.student_id == student.id) >= MAX_PARENTS:
            raise ConflictError(
                f"{first_name(student)} already has {MAX_PARENTS} parents connected."
            )
        if await self._count(FamilyLink.parent_id == parent.id) >= MAX_CHILDREN:
            raise ConflictError(f"You can follow up to {MAX_CHILDREN} children.")
        link = FamilyLink(parent_id=parent.id, student_id=student.id, label=clean_label(label))
        self._session.add(link)
        await self._session.flush()
        if self._bus is not None:
            await self._bus.publish(
                FamilyLinked(
                    student_id=student.id,
                    parent_id=parent.id,
                    parent_name=parent.display_name or parent.sign_in_name,
                    label=link.label,
                ),
                self._session,
            )
        return ChildView(student, link.label, link.created_at)

    async def disconnect(self, parent_id: UUID, student_id: UUID) -> None:
        """Only ever the parent's to do."""
        link = await self._link(parent_id, student_id)
        if link is None:
            raise NotFoundError("No such child.")
        await self._session.delete(link)
        await self._session.flush()

    # --- reading -----------------------------------------------------------------

    async def child(self, parent_id: UUID, student_id: UUID) -> User:
        """The gate for every parent read: the child, if linked to this parent."""
        student = await self._session.scalar(
            select(User)
            .join(FamilyLink, FamilyLink.student_id == User.id)
            .where(FamilyLink.parent_id == parent_id, FamilyLink.student_id == student_id)
        )
        if student is None:
            raise NotFoundError("No such child.")
        return student

    async def children(self, parent_id: UUID) -> list[ChildView]:
        rows = await self._session.execute(
            select(User, FamilyLink.label, FamilyLink.created_at)
            .join(FamilyLink, FamilyLink.student_id == User.id)
            .where(FamilyLink.parent_id == parent_id)
            .order_by(FamilyLink.created_at)
        )
        return [ChildView(user, label, at) for user, label, at in rows.all()]

    async def parents(self, student_id: UUID) -> list[ParentView]:
        rows = await self._session.execute(
            select(User, FamilyLink.label, FamilyLink.created_at)
            .join(FamilyLink, FamilyLink.parent_id == User.id)
            .where(FamilyLink.student_id == student_id)
            .order_by(FamilyLink.created_at)
        )
        return [ParentView(user, label, at) for user, label, at in rows.all()]

    async def parents_of(self, student_ids: list[UUID]) -> dict[UUID, list[str]]:
        """For a teacher's class list: who is connected to each student, as
        "Name (Mum)"."""
        if not student_ids:
            return {}
        rows = await self._session.execute(
            select(FamilyLink.student_id, User.display_name, User.email, FamilyLink.label)
            .join(User, User.id == FamilyLink.parent_id)
            .where(FamilyLink.student_id.in_(student_ids))
            .order_by(FamilyLink.created_at)
        )
        found: dict[UUID, list[str]] = {}
        for student_id, name, email, label in rows.all():
            found.setdefault(student_id, []).append(f"{name or email} ({label})")
        return found

    # --- internals -----------------------------------------------------------

    async def _invite(self, student_id: UUID) -> FamilyInvite | None:
        return await self._session.scalar(
            select(FamilyInvite).where(FamilyInvite.student_id == student_id)
        )

    async def _renew(self, student_id: UUID, invite: FamilyInvite | None) -> FamilyInvite:
        # The code first: looking for a free one queries, and a query flushes
        # whatever was added — a half-made invite would reach the table.
        code = await self._fresh_code()
        expires = self._clock() + timedelta(days=INVITE_DAYS)
        if invite is None:
            invite = FamilyInvite(student_id=student_id, token="", code=code, expires_at=expires)
            self._session.add(invite)
        invite.token = secrets.token_urlsafe(24)
        invite.code = code
        invite.enabled = True
        invite.expires_at = expires
        await self._session.flush()
        return invite

    async def _alive(self, key: str) -> tuple[FamilyInvite, User]:
        cleaned = key.strip()
        invite = await self._session.scalar(
            select(FamilyInvite).where(
                (FamilyInvite.token == cleaned) | (FamilyInvite.code == cleaned.upper())
            )
        )
        student = await self._session.get(User, invite.student_id) if invite else None
        if (
            invite is None
            or student is None
            or not invite.enabled
            or invite.expires_at <= self._clock()
            or student.role != Role.STUDENT.value
            or not student.is_active
        ):
            raise NotFoundError(DEAD)
        return invite, student

    async def _link(self, parent_id: UUID, student_id: UUID) -> FamilyLink | None:
        return await self._session.scalar(
            select(FamilyLink).where(
                FamilyLink.parent_id == parent_id, FamilyLink.student_id == student_id
            )
        )

    async def _count(self, where) -> int:  # noqa: ANN001 — a column comparison
        return int(await self._session.scalar(select(func.count()).where(where)) or 0)

    async def _fresh_code(self) -> str:
        for _ in range(10):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            taken = await self._session.scalar(
                select(FamilyInvite.id).where(FamilyInvite.code == code)
            )
            if taken is None:
                return code
        raise RuntimeError("could not find a free family code")  # pragma: no cover


def first_name(user: User) -> str:
    return ((user.display_name or user.sign_in_name).split() or ["your child"])[0]


def clean_label(label: str | None) -> str:
    cleaned = " ".join((label or "").split())[:LABEL_CHARS]
    if cleaned and len(cleaned) < 2:
        raise ValidationError("Say who you are to them — Mum, Dad, Guardian…")
    return cleaned or DEFAULT_LABEL
