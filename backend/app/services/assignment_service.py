"""Sharing a learning set with a class, or some of its groups.

An assignment pins the set's current version, so later edits never change
what students are working on. Its audience is worked out when asked — whole
class, or the members of the chosen groups — so a student let in later sees
work shared with the whole class, and one removed from a group stops seeing
what was shared with it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.db.models.classroom import ClassGroup, ClassMembership, Classroom, GroupMember
from app.db.models.learning import Assignment, AssignmentGroup, LearningSet
from app.db.models.user import User
from app.db.repositories.classes import ClassRepository
from app.events.bus import EventBus
from app.events.catalog import AssignmentChanged, AssignmentShared

FEEDBACK_MODES = ("instant", "end")


@dataclass(frozen=True, slots=True)
class ShareSettings:
    group_ids: tuple[UUID, ...] = ()
    feedback_mode: str = "instant"
    due_at: datetime | None = None
    allow_retakes: bool = False
    max_attempts: int | None = None
    shuffle_questions: bool = False
    shuffle_options: bool = True
    leaderboard_enabled: bool = True


@dataclass(frozen=True, slots=True)
class AssignmentView:
    assignment: Assignment
    class_name: str
    group_names: list[str]
    audience: int


class AssignmentService:
    def __init__(self, session: AsyncSession, bus: EventBus) -> None:
        self._session = session
        self._bus = bus
        self._classes = ClassRepository(session)

    async def share(
        self, teacher: User, set_id: UUID, class_id: UUID, settings: ShareSettings
    ) -> AssignmentView:
        learning_set = await self._shareable(teacher.id, set_id)
        classroom = await self._owned_class(teacher.id, class_id)
        groups = await self._groups(class_id, settings.group_ids)
        _check(settings)
        assignment = Assignment(
            set_id=learning_set.id,
            version=learning_set.current_version,
            class_id=class_id,
            teacher_id=teacher.id,
            title=learning_set.title,
            kind=learning_set.kind,
            feedback_mode=settings.feedback_mode,
            shuffle_questions=settings.shuffle_questions,
            shuffle_options=settings.shuffle_options,
            allow_retakes=settings.allow_retakes,
            max_attempts=settings.max_attempts if settings.allow_retakes else 1,
            leaderboard_enabled=settings.leaderboard_enabled and learning_set.kind == "quiz",
            due_at=settings.due_at,
        )
        self._session.add(assignment)
        await self._session.flush()
        self._session.add_all(
            AssignmentGroup(assignment_id=assignment.id, group_id=g.id) for g in groups
        )
        await self._session.flush()
        audience = await self.audience(assignment)
        await self._announce(teacher, classroom, assignment, audience)
        return AssignmentView(assignment, classroom.name, [g.name for g in groups], len(audience))

    async def for_class(self, teacher_id: UUID, class_id: UUID) -> list[AssignmentView]:
        classroom = await self._owned_class(teacher_id, class_id)
        found = (
            (
                await self._session.execute(
                    select(Assignment)
                    .where(Assignment.class_id == class_id)
                    .order_by(Assignment.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
        return [await self._view(a, classroom.name) for a in found]

    async def get(self, teacher_id: UUID, assignment_id: UUID) -> AssignmentView:
        assignment = await self._owned(teacher_id, assignment_id)
        classroom = await self._session.get(Classroom, assignment.class_id)
        return await self._view(assignment, classroom.name if classroom else "")

    async def update(
        self,
        teacher_id: UUID,
        assignment_id: UUID,
        *,
        due_at: datetime | None = None,
        clear_due: bool = False,
        closed: bool | None = None,
    ) -> AssignmentView:
        assignment = await self._owned(teacher_id, assignment_id)
        if clear_due:
            assignment.due_at = None
        elif due_at is not None:
            assignment.due_at = due_at
        if closed is not None:
            assignment.closed_at = datetime.now(UTC) if closed else None
        await self._session.flush()
        await self._bus.publish(
            AssignmentChanged(
                assignment_id=assignment.id,
                class_id=assignment.class_id,
                teacher_id=teacher_id,
                audience=tuple(await self.audience(assignment)),
                closed=assignment.closed_at is not None,
            ),
            self._session,
        )
        return await self.get(teacher_id, assignment_id)

    async def audience(self, assignment: Assignment) -> list[UUID]:
        """Who this is for, right now: approved members of the class, or of
        the chosen groups within it."""
        approved = select(ClassMembership.student_id).where(
            ClassMembership.class_id == assignment.class_id, ClassMembership.status == "approved"
        )
        targeted = select(AssignmentGroup.group_id).where(
            AssignmentGroup.assignment_id == assignment.id
        )
        if await self._session.scalar(select(func.count()).select_from(targeted.subquery())):
            in_groups = select(GroupMember.student_id).where(GroupMember.group_id.in_(targeted))
            query = approved.where(ClassMembership.student_id.in_(in_groups))
        else:
            query = approved
        return list((await self._session.execute(query)).scalars().unique().all())

    # --- internals --------------------------------------------------------

    async def _shareable(self, teacher_id: UUID, set_id: UUID) -> LearningSet:
        learning_set = (
            await self._session.execute(
                select(LearningSet).where(
                    LearningSet.id == set_id, LearningSet.owner_id == teacher_id
                )
            )
        ).scalar_one_or_none()
        if learning_set is None:
            raise NotFoundError("No such set.")
        if learning_set.purpose != "assign":
            raise ForbiddenError("Practice sets are private and cannot be shared.")
        if learning_set.status != "ready" or not learning_set.current_version:
            raise ValidationError("This set isn't ready to share yet.")
        return learning_set

    async def _owned_class(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        classroom = await self._classes.owned(class_id, teacher_id)
        if classroom is None or classroom.archived_at is not None:
            raise NotFoundError("No such class.")
        return classroom

    async def _owned(self, teacher_id: UUID, assignment_id: UUID) -> Assignment:
        assignment = (
            await self._session.execute(
                select(Assignment).where(
                    Assignment.id == assignment_id, Assignment.teacher_id == teacher_id
                )
            )
        ).scalar_one_or_none()
        if assignment is None:
            raise NotFoundError("No such assignment.")
        return assignment

    async def _groups(self, class_id: UUID, group_ids: tuple[UUID, ...]) -> list[ClassGroup]:
        if not group_ids:
            return []
        found = (
            (
                await self._session.execute(
                    select(ClassGroup).where(
                        ClassGroup.class_id == class_id, ClassGroup.id.in_(group_ids)
                    )
                )
            )
            .scalars()
            .all()
        )
        if len(found) != len(set(group_ids)):
            raise ValidationError("One of those groups isn't in this class.")
        return list(found)

    async def _view(self, assignment: Assignment, class_name: str) -> AssignmentView:
        names = (
            (
                await self._session.execute(
                    select(ClassGroup.name)
                    .join(AssignmentGroup, AssignmentGroup.group_id == ClassGroup.id)
                    .where(AssignmentGroup.assignment_id == assignment.id)
                    .order_by(ClassGroup.name)
                )
            )
            .scalars()
            .all()
        )
        return AssignmentView(
            assignment, class_name, list(names), len(await self.audience(assignment))
        )

    async def _announce(
        self, teacher: User, classroom: Classroom, assignment: Assignment, audience: list[UUID]
    ) -> None:
        await self._bus.publish(
            AssignmentShared(
                assignment_id=assignment.id,
                title=assignment.title,
                kind=assignment.kind,
                class_id=classroom.id,
                class_name=classroom.name,
                teacher_id=teacher.id,
                teacher_name=teacher.display_name or "your teacher",
                student_ids=tuple(audience),
                due_at=assignment.due_at.isoformat() if assignment.due_at else None,
            ),
            self._session,
        )


def _check(settings: ShareSettings) -> None:
    if settings.feedback_mode not in FEEDBACK_MODES:
        raise ValidationError("Feedback must be instant or at the end.")
    if settings.due_at is not None and settings.due_at <= datetime.now(UTC):
        raise ValidationError("A due date has to be in the future.")
    if settings.max_attempts is not None and not 1 <= settings.max_attempts <= 20:
        raise ValidationError("Attempts must be between 1 and 20.")
