"""Live sessions as records: made by a teacher for one group, reviewed, then
scheduled onto the group's schedule.

Ownership and membership are parameters of every lookup (`owned`,
`visible`), never a check done afterwards. Who a session is for is always
worked out now — approved members of the class who are in the group — so a
student who joins the group later sees it, and one who leaves stops seeing it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.db.models.classroom import ClassGroup, ClassMembership, Classroom, GroupMember
from app.db.models.live import (
    VISIBLE_TO_STUDENTS,
    LiveSegment,
    LiveSession,
    LiveSessionDocument,
)
from app.db.models.user import User
from app.db.repositories.classes import ClassRepository, GroupRepository
from app.events.bus import EventBus
from app.events.catalog import LiveSessionCancelled, LiveSessionScheduled
from app.live.settings import SessionSettings
from app.live.timeline import already_told

# Settings that change what the lesson says; editing one means writing it again.
PLAN_FIELDS = (
    "subject",
    "topic",
    "grade_level",
    "breakdown",
    "difficulty",
    "approach",
    "custom_instruction",
    "duration_minutes",
)
EDITABLE = ("draft", "planned", "failed", "approved")
SCHEDULABLE = ("approved", "scheduled")
# Far enough ahead for a real class, near enough to be a real plan.
MAX_AHEAD = timedelta(days=120)
MAX_DOCUMENTS = 5
START_NOW_GRACE = timedelta(minutes=2)


@dataclass(frozen=True, slots=True)
class SessionView:
    session: LiveSession
    class_name: str
    group_name: str
    students: int
    segments: int
    teacher_name: str | None = None


class LiveSessionService:
    def __init__(self, session: AsyncSession, bus: EventBus | None = None) -> None:
        self._session = session
        self._bus = bus
        self._classes = ClassRepository(session)
        self._groups = GroupRepository(session)

    # --- a teacher's own ----------------------------------------------------

    async def create(
        self,
        teacher: User,
        *,
        class_id: UUID,
        group_id: UUID,
        settings: SessionSettings,
        template_id: UUID | None = None,
    ) -> LiveSession:
        await self._owned_class(teacher.id, class_id)
        if await self._groups.in_class(group_id, class_id) is None:
            raise ValidationError("That group isn't in this class.")
        live = LiveSession(
            teacher_id=teacher.id,
            class_id=class_id,
            group_id=group_id,
            template_id=template_id,
            title=settings.topic[:200],
            settings=settings.model_dump(mode="json"),
            status="draft",
        )
        self._session.add(live)
        await self._session.flush()
        return live

    async def owned(self, teacher_id: UUID, session_id: UUID) -> LiveSession:
        live = (
            await self._session.execute(
                select(LiveSession).where(
                    LiveSession.id == session_id, LiveSession.teacher_id == teacher_id
                )
            )
        ).scalar_one_or_none()
        if live is None:
            raise NotFoundError("No such live session.")
        return live

    async def for_teacher(self, teacher_id: UUID) -> list[SessionView]:
        found = (
            (
                await self._session.execute(
                    select(LiveSession)
                    .where(LiveSession.teacher_id == teacher_id)
                    .order_by(LiveSession.created_at.desc())
                    .limit(200)
                )
            )
            .scalars()
            .all()
        )
        return [await self.view(s) for s in found]

    async def view(self, live: LiveSession, *, teacher_name: str | None = None) -> SessionView:
        classroom = await self._session.get(Classroom, live.class_id)
        group = await self._session.get(ClassGroup, live.group_id)
        segments = await self._session.scalar(
            select(func.count()).select_from(LiveSegment).where(LiveSegment.session_id == live.id)
        )
        return SessionView(
            session=live,
            class_name=classroom.name if classroom else "",
            group_name=group.name if group else "",
            students=len(await self.audience(live)),
            segments=int(segments or 0),
            teacher_name=teacher_name,
        )

    async def update_settings(
        self, teacher_id: UUID, session_id: UUID, settings: SessionSettings
    ) -> LiveSession:
        live = await self.owned(teacher_id, session_id)
        if live.status not in EDITABLE:
            raise ValidationError("This session can no longer be changed.")
        new = settings.model_dump(mode="json")
        if any(new.get(k) != live.settings.get(k) for k in PLAN_FIELDS) and live.status != "draft":
            # What the lesson says has changed; it has to be written again.
            live.status = "draft"
        live.settings = new
        live.title = settings.topic[:200]
        await self._session.flush()
        return live

    async def delete(self, teacher_id: UUID, session_id: UUID) -> None:
        live = await self.owned(teacher_id, session_id)
        if live.status in ("scheduled", "lobby", "live"):
            raise ValidationError("Cancel this session before deleting it.")
        await self._session.delete(live)
        await self._session.flush()

    # --- materials and parts ------------------------------------------------

    async def documents(self, session_id: UUID) -> list[LiveSessionDocument]:
        return list(
            (
                await self._session.execute(
                    select(LiveSessionDocument)
                    .where(LiveSessionDocument.session_id == session_id)
                    .order_by(LiveSessionDocument.created_at)
                )
            )
            .scalars()
            .all()
        )

    async def add_document(
        self, live: LiveSession, *, filename: str, media_type: str, size: int, text: str
    ) -> LiveSessionDocument:
        if live.status not in EDITABLE:
            raise ValidationError("This session can no longer be changed.")
        if len(await self.documents(live.id)) >= MAX_DOCUMENTS:
            raise ValidationError(f"A session can have {MAX_DOCUMENTS} files. Remove one first.")
        document = LiveSessionDocument(
            session_id=live.id,
            filename=filename[:255],
            media_type=media_type[:120],
            size_bytes=size,
            text=text,
        )
        self._session.add(document)
        await self._session.flush()
        return document

    async def remove_document(self, live: LiveSession, document_id: UUID) -> None:
        result = await self._session.execute(
            delete(LiveSessionDocument).where(
                LiveSessionDocument.id == document_id, LiveSessionDocument.session_id == live.id
            )
        )
        if not result.rowcount:
            raise NotFoundError("No such file.")

    async def segments(self, session_id: UUID) -> list[LiveSegment]:
        return list(
            (
                await self._session.execute(
                    select(LiveSegment)
                    .where(LiveSegment.session_id == session_id)
                    .order_by(LiveSegment.position)
                )
            )
            .scalars()
            .all()
        )

    async def segment(self, live: LiveSession, segment_id: UUID) -> LiveSegment:
        found = (
            await self._session.execute(
                select(LiveSegment).where(
                    LiveSegment.id == segment_id, LiveSegment.session_id == live.id
                )
            )
        ).scalar_one_or_none()
        if found is None:
            raise NotFoundError("No such part.")
        return found

    async def replace_segments(self, session_id: UUID, planned: list[dict[str, Any]]) -> None:
        await self._session.execute(delete(LiveSegment).where(LiveSegment.session_id == session_id))
        await self.append_segments(session_id, planned, start=0)

    async def append_segments(
        self, session_id: UUID, planned: list[dict[str, Any]], *, start: int
    ) -> list[LiveSegment]:
        rows = [
            LiveSegment(session_id=session_id, position=start + i, status="draft", **p)
            for i, p in enumerate(planned)
        ]
        self._session.add_all(rows)
        await self._session.flush()
        return rows

    def reopen(self, live: LiveSession) -> None:
        """An edit after approval means the voice must be recorded again."""
        if live.status == "approved":
            live.status = "planned"

    # --- scheduling -----------------------------------------------------------

    async def schedule(self, teacher: User, session_id: UUID, at: datetime | None) -> LiveSession:
        live = await self.owned(teacher.id, session_id)
        if live.status not in SCHEDULABLE:
            raise ValidationError("Approve the lesson before scheduling it.")
        now = datetime.now(UTC)
        # "Start now" gives the group a couple of minutes to come in.
        when = at or now + START_NOW_GRACE
        if when.tzinfo is None:
            raise ValidationError("Give the start time with its time zone.")
        if when < now - timedelta(minutes=1):
            raise ValidationError("That time has already passed.")
        if when > now + MAX_AHEAD:
            raise ValidationError("Schedule it within the next four months.")
        moved = live.status == "scheduled" and live.scheduled_at is not None
        live.scheduled_at = when
        live.status = "scheduled"
        # Moving it means the reminders are due again for the new time — except
        # any the new time makes pointless.
        live.reminders_sent = already_told(when, now)
        await self._session.flush()
        await self._announce_scheduled(teacher, live, moved=moved)
        return live

    async def cancel(self, teacher: User, session_id: UUID) -> LiveSession:
        live = await self.owned(teacher.id, session_id)
        if live.status in ("ended", "cancelled"):
            raise ValidationError("This session is already over.")
        was_visible = live.status in VISIBLE_TO_STUDENTS
        live.status = "cancelled"
        await self._session.flush()
        if was_visible and self._bus is not None:
            await self._bus.publish(
                LiveSessionCancelled(
                    session_id=live.id,
                    title=live.title,
                    teacher_id=teacher.id,
                    student_ids=tuple(await self.audience(live)),
                ),
                self._session,
            )
        return live

    async def audience(self, live: LiveSession) -> list[UUID]:
        """Approved members of the class who are in the session's group."""
        query = (
            select(GroupMember.student_id)
            .join(
                ClassMembership,
                (ClassMembership.student_id == GroupMember.student_id)
                & (ClassMembership.class_id == live.class_id),
            )
            .where(GroupMember.group_id == live.group_id, ClassMembership.status == "approved")
        )
        return list((await self._session.execute(query)).scalars().unique().all())

    # --- a student's schedule -------------------------------------------------

    async def for_student(self, student_id: UUID) -> list[SessionView]:
        rows = (
            await self._session.execute(
                select(LiveSession, User.display_name)
                .join(GroupMember, GroupMember.group_id == LiveSession.group_id)
                .join(
                    ClassMembership,
                    (ClassMembership.class_id == LiveSession.class_id)
                    & (ClassMembership.student_id == GroupMember.student_id),
                )
                .join(User, User.id == LiveSession.teacher_id)
                .where(
                    GroupMember.student_id == student_id,
                    ClassMembership.status == "approved",
                    LiveSession.status.in_(VISIBLE_TO_STUDENTS),
                )
                .order_by(LiveSession.scheduled_at)
                .limit(200)
            )
        ).all()
        return [await self.view(live, teacher_name=name) for live, name in rows]

    async def visible(self, student_id: UUID, session_id: UUID) -> LiveSession:
        for view in await self.for_student(student_id):
            if view.session.id == session_id:
                return view.session
        raise NotFoundError("No such live session.")

    # --- internals ------------------------------------------------------------

    async def _owned_class(self, teacher_id: UUID, class_id: UUID) -> Classroom:
        classroom = await self._classes.owned(class_id, teacher_id)
        if classroom is None or classroom.archived_at is not None:
            raise NotFoundError("No such class.")
        return classroom

    async def _announce_scheduled(self, teacher: User, live: LiveSession, *, moved: bool) -> None:
        if self._bus is None or live.scheduled_at is None:
            return
        classroom = await self._session.get(Classroom, live.class_id)
        await self._bus.publish(
            LiveSessionScheduled(
                session_id=live.id,
                title=live.title,
                teacher_id=teacher.id,
                teacher_name=teacher.display_name or "your teacher",
                class_id=live.class_id,
                class_name=classroom.name if classroom else "",
                student_ids=tuple(await self.audience(live)),
                scheduled_at=live.scheduled_at.isoformat(),
                moved=moved,
            ),
            self._session,
        )
