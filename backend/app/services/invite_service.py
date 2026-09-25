"""The way into a class: a link to share and a short code to type.

A dead invite — disabled, expired, rotated away, its class archived, or one
that never existed — gets one answer. Distinguishing them would tell anyone
guessing codes which ones are real.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.grades import grade_label
from app.db.models.classroom import ClassInvite, Classroom
from app.db.repositories.classes import ClassRepository, InviteRepository

# No 0/O, 1/I/L: a code is read off a projector and typed on a tablet.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
DEAD = "This invite isn't working any more — ask your teacher for a new one."


@dataclass(frozen=True, slots=True)
class InvitePreview:
    class_id: UUID
    class_name: str
    subject: str | None
    grade_label: str | None
    theme: str
    teacher_name: str


class InviteService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._invites = InviteRepository(session)
        self._classes = ClassRepository(session)

    async def ensure(self, classroom: Classroom) -> ClassInvite:
        existing = await self._invites.for_class(classroom.id)
        if existing is not None:
            return existing
        invite = ClassInvite(
            class_id=classroom.id, token=_token(), code=await self._fresh_code(), enabled=True
        )
        self._session.add(invite)
        await self._session.flush()
        return invite

    async def for_class(self, teacher_id: UUID, class_id: UUID) -> ClassInvite:
        return await self.ensure(await self._owned(teacher_id, class_id))

    async def rotate(self, teacher_id: UUID, class_id: UUID) -> ClassInvite:
        invite = await self.for_class(teacher_id, class_id)
        invite.token = _token()
        invite.code = await self._fresh_code()
        invite.rotated_at = datetime.now(UTC)
        await self._session.flush()
        return invite

    async def configure(
        self,
        teacher_id: UUID,
        class_id: UUID,
        *,
        enabled: bool | None = None,
        expires_at: datetime | None = None,
        clear_expiry: bool = False,
    ) -> ClassInvite:
        invite = await self.for_class(teacher_id, class_id)
        if enabled is not None:
            invite.enabled = enabled
        if clear_expiry:
            invite.expires_at = None
        elif expires_at is not None:
            invite.expires_at = expires_at
        await self._session.flush()
        return invite

    async def lookup(self, key: str) -> InvitePreview:
        invite, classroom = await self.resolve(key)
        teacher = await self._classes.teacher(classroom)
        return InvitePreview(
            class_id=classroom.id,
            class_name=classroom.name,
            subject=classroom.subject,
            grade_label=grade_label(classroom.grade_level),
            theme=classroom.theme,
            teacher_name=(teacher.display_name if teacher else None) or "your teacher",
        )

    async def resolve(self, key: str) -> tuple[ClassInvite, Classroom]:
        """The live invite and its class, or the one refusal for everything else."""
        invite = await self._invites.by_token_or_code(key.strip()[:64]) if key.strip() else None
        classroom = await self._session.get(Classroom, invite.class_id) if invite else None
        if invite is None or classroom is None or not _alive(invite, classroom):
            raise NotFoundError(DEAD)
        return invite, classroom

    async def _owned(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        classroom = await self._classes.owned(class_id, teacher_id)
        if classroom is None:
            raise NotFoundError("No such class.")
        return classroom

    async def _fresh_code(self) -> str:
        # 31^6 ≈ 887 million codes: a collision is rare, and a retry is cheap.
        for _ in range(10):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if not await self._invites.code_taken(code):
                return code
        raise RuntimeError("could not find a free class code")  # pragma: no cover


def _token() -> str:
    return secrets.token_urlsafe(24)


def _alive(invite: ClassInvite, classroom: Classroom) -> bool:
    if not invite.enabled or classroom.archived_at is not None:
        return False
    return invite.expires_at is None or invite.expires_at > datetime.now(UTC)
