"""A teacher's classes: making them, naming them, putting them away.

Every lookup is scoped to the teacher (`ClassRepository.owned`), so another
teacher's class is simply not found — never "found but forbidden", which
would say it exists.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.core.grades import is_grade
from app.core.palette import THEMES, is_theme
from app.db.models.classroom import Classroom
from app.db.models.user import User
from app.db.repositories.classes import ClassCounts, ClassRepository
from app.services.invite_service import InviteService

_UNSET = object()


@dataclass(frozen=True, slots=True)
class ClassSummary:
    classroom: Classroom
    students: int
    pending: int
    groups: int


class ClassService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._classes = ClassRepository(session)

    async def create(
        self,
        teacher: User,
        *,
        name: str,
        subject: str | None = None,
        grade_level: str | None = None,
        description: str | None = None,
        theme: str = "grape",
    ) -> Classroom:
        classroom = Classroom(
            teacher_id=teacher.id,
            name=_name(name),
            subject=_optional(subject, 80, "Subject"),
            grade_level=_grade(grade_level),
            description=_optional(description, 2000, "Description"),
            theme=_theme(theme),
        )
        self._session.add(classroom)
        await self._session.flush()
        # A class is born with its way in, so "share the link" is never a
        # step the teacher has to discover first.
        await InviteService(self._session).ensure(classroom)
        return classroom

    async def get(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        classroom = await self._classes.owned(class_id, teacher_id)
        if classroom is None:
            raise NotFoundError("No such class.")
        return classroom

    async def list_for(self, teacher_id: UUID, *, archived: bool = False) -> list[ClassSummary]:
        found = await self._classes.for_teacher(teacher_id, archived=archived)
        counts = await self._classes.counts([c.id for c in found])
        empty = ClassCounts(students=0, pending=0, groups=0)
        return [
            ClassSummary(
                classroom=c,
                students=counts.get(c.id, empty).students,
                pending=counts.get(c.id, empty).pending,
                groups=counts.get(c.id, empty).groups,
            )
            for c in found
        ]

    async def summary(self, teacher_id: UUID, class_id: UUID) -> ClassSummary:
        classroom = await self.get(teacher_id, class_id)
        counts = (await self._classes.counts([class_id]))[class_id]
        return ClassSummary(classroom, counts.students, counts.pending, counts.groups)

    async def update(
        self,
        teacher_id: UUID,
        class_id: UUID,
        *,
        name: str | None = None,
        subject: object = _UNSET,
        grade_level: object = _UNSET,
        description: object = _UNSET,
        theme: str | None = None,
    ) -> Classroom:
        classroom = await self.get(teacher_id, class_id)
        if name is not None:
            classroom.name = _name(name)
        if subject is not _UNSET:
            classroom.subject = _optional(subject, 80, "Subject")  # type: ignore[arg-type]
        if grade_level is not _UNSET:
            classroom.grade_level = _grade(grade_level)  # type: ignore[arg-type]
        if description is not _UNSET:
            classroom.description = _optional(description, 2000, "Description")  # type: ignore[arg-type]
        if theme is not None:
            classroom.theme = _theme(theme)
        await self._session.flush()
        return classroom

    async def archive(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        """Put away, not deleted: results earned in a class outlive it."""
        classroom = await self.get(teacher_id, class_id)
        classroom.archived_at = classroom.archived_at or datetime.now(UTC)
        await self._session.flush()
        return classroom

    async def restore(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        classroom = await self.get(teacher_id, class_id)
        classroom.archived_at = None
        await self._session.flush()
        return classroom


def _name(raw: str) -> str:
    name = " ".join(raw.split())
    if not 1 <= len(name) <= 120:
        raise ValidationError("A class name must be 1-120 characters.")
    return name


def _optional(raw: str | None, limit: int, label: str) -> str | None:
    if raw is None:
        return None
    cleaned = raw.strip()
    if len(cleaned) > limit:
        raise ValidationError(f"{label} must be at most {limit} characters.")
    return cleaned or None


def _grade(code: str | None) -> str | None:
    if code in (None, ""):
        return None
    if not is_grade(code):
        raise ValidationError("Pick a grade from the list.")
    return code


def _theme(key: str) -> str:
    if not is_theme(key):
        raise ValidationError(f"Theme must be one of: {', '.join(THEMES)}.")
    return key
