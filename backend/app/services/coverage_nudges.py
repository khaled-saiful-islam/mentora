"""Keeping a class on its syllabus: what to teach next, and what to finish.

Once a class has a syllabus (the coverage map, `041-coverage-map.md`),
Mentora keeps nudging, gently:

- **the teacher**, with the next topics not taught yet, the ones the class
  scored low on, and sets made and ready to share — on their home, and once
  a week per class in the bell;
- **each student**, with the class work they have not finished and the topic
  the class is on — on their home, and every few days in the bell while
  something has been waiting a while.

The map is read without sorting anything new (`sort=False`), so a nudge
never costs a model call; what is not placed yet is placed when the teacher
next opens the map.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.notifications import Kind
from app.db.models.classroom import ClassMembership, Classroom
from app.db.models.coverage import ClassSyllabus, CoverageLink
from app.db.models.notification import Notification
from app.db.models.user import User
from app.services.coverage.service import CoverageService
from app.services.notification_service import NotificationService
from app.services.student_home_service import StudentHomeService

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]

# How many topics a nudge names.
NEXT = 3
LOW = 2
# How often the bell may say it, per class.
TEACHER_EVERY = timedelta(days=7)
STUDENT_EVERY = timedelta(days=3)
# Work a student has had this long without finishing is worth a reminder.
STUDENT_WAIT = timedelta(days=2)
UNFINISHED = ("todo", "in_progress")


@dataclass(frozen=True, slots=True)
class TopicNudge:
    id: str
    title: str
    area: str


@dataclass(frozen=True, slots=True)
class ClassNudge:
    class_id: UUID
    name: str
    subject: str | None
    grade_level: str | None
    taught: int
    topics: int
    next: tuple[TopicNudge, ...]
    low: tuple[TopicNudge, ...]
    ready: int


@dataclass(frozen=True, slots=True)
class KeepUpItem:
    assignment_id: UUID
    title: str
    kind: str
    # The syllabus topic it covers, when the teacher's map has placed it.
    topic: str | None
    due_at: datetime | None
    shared_at: datetime


@dataclass(frozen=True, slots=True)
class KeepUp:
    class_id: UUID
    name: str
    items: tuple[KeepUpItem, ...]


class CoverageNudges:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def for_teacher(self, teacher_id: UUID) -> list[ClassNudge]:
        """Each of the teacher's classes with a syllabus: what is next."""
        rooms = await self._session.scalars(
            select(Classroom)
            .join(ClassSyllabus, ClassSyllabus.class_id == Classroom.id)
            .where(Classroom.teacher_id == teacher_id, Classroom.archived_at.is_(None))
            .order_by(Classroom.created_at)
        )
        return [await self.for_class(room) for room in rooms.all()]

    async def for_class(self, room: Classroom) -> ClassNudge:
        shaped = await CoverageService(self._session).coverage(room, sort=False, ready=True)
        topics = [(area["title"], t) for area in shaped["areas"] for t in area["topics"]]

        def pick(status: str, most: int) -> tuple[TopicNudge, ...]:
            return tuple(
                TopicNudge(t["id"], t["title"], area) for area, t in topics if t["status"] == status
            )[:most]

        summary = shaped["summary"]
        return ClassNudge(
            class_id=room.id,
            name=room.name,
            subject=room.subject,
            grade_level=room.grade_level,
            taught=summary["taught"],
            topics=summary["topics"],
            next=pick("untouched", NEXT),
            low=pick("needs_work", LOW),
            ready=summary.get("ready", 0),
        )

    async def for_student(self, student: User) -> list[KeepUp]:
        """Unfinished class work, by class, with the topic each one covers."""
        cards = [
            c for c in await StudentHomeService(self._session).assignments(student)
            if c.status in UNFINISHED
        ]  # fmt: skip
        if not cards:
            return []
        topic_of = await self._topics({c.assignment.class_id for c in cards})
        by_class: dict[UUID, tuple[str, list[KeepUpItem]]] = {}
        for card in cards:
            a = card.assignment
            name, items = by_class.setdefault(a.class_id, (card.class_name, []))
            items.append(
                KeepUpItem(
                    assignment_id=a.id,
                    title=a.title,
                    kind=a.kind,
                    topic=topic_of.get(a.id),
                    due_at=a.due_at,
                    shared_at=a.created_at,
                )
            )
        return [
            KeepUp(class_id, name, tuple(sorted(items, key=_soonest)))
            for class_id, (name, items) in by_class.items()
        ]

    async def _topics(self, class_ids: set[UUID]) -> dict[UUID, str]:
        """Assignment → the title of the topic the map placed it on."""
        titles: dict[tuple[UUID, str], str] = {}
        for row in await self._session.scalars(
            select(ClassSyllabus).where(ClassSyllabus.class_id.in_(class_ids))
        ):
            for area in row.areas:
                for topic in area.get("topics", []):
                    titles[(row.class_id, topic["id"])] = topic["title"]
        links = await self._session.scalars(
            select(CoverageLink).where(
                CoverageLink.class_id.in_(class_ids),
                CoverageLink.kind == "assignment",
                CoverageLink.topic_id.is_not(None),
            )
        )
        return {
            link.item_id: titles[(link.class_id, link.topic_id)]
            for link in links.all()
            if (link.class_id, link.topic_id) in titles
        }


def _soonest(item: KeepUpItem) -> tuple[bool, datetime]:
    return (item.due_at is None, item.due_at or item.shared_at)


class CoverageWatcher:
    """Rings the bell with a nudge now and then — never more often than
    `TEACHER_EVERY` per class for a teacher, `STUDENT_EVERY` for a student."""

    def __init__(self, *, settings: Settings, session_maker: SessionMaker) -> None:
        self._settings = settings
        self._db = session_maker

    async def run(self) -> None:
        while True:
            try:
                async with self._db() as db:
                    await self.check(db, datetime.now(UTC))
                    await db.commit()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("the coverage watcher failed a tick")
            await asyncio.sleep(self._settings.coverage_nudge_seconds)

    async def check(self, db: AsyncSession, now: datetime) -> int:
        """Send what is due; how many nudges went out."""
        rooms = (
            await db.scalars(
                select(Classroom)
                .join(ClassSyllabus, ClassSyllabus.class_id == Classroom.id)
                .where(Classroom.archived_at.is_(None))
            )
        ).all()
        sent = 0
        nudges = CoverageNudges(db)
        for room in rooms:
            sent += await self._teacher(db, nudges, room, now)
            sent += await self._students(db, nudges, room, now)
        return sent

    async def _teacher(
        self, db: AsyncSession, nudges: CoverageNudges, room: Classroom, now: datetime
    ) -> int:
        nudge = await nudges.for_class(room)
        if not nudge.next or await _recent(
            db, room.teacher_id, Kind.COVERAGE_NUDGE, room.id, now - TEACHER_EVERY
        ):
            return 0
        await NotificationService(db).notify(
            user_id=room.teacher_id,
            kind=Kind.COVERAGE_NUDGE,
            payload={
                "class_id": str(room.id),
                "class_name": room.name,
                "taught": nudge.taught,
                "topics": nudge.topics,
                "next": [t.title for t in nudge.next],
                "ready": nudge.ready,
            },
        )
        return 1

    async def _students(
        self, db: AsyncSession, nudges: CoverageNudges, room: Classroom, now: datetime
    ) -> int:
        members = await db.scalars(
            select(User)
            .join(ClassMembership, ClassMembership.student_id == User.id)
            .where(ClassMembership.class_id == room.id, ClassMembership.status == "approved")
        )
        sent = 0
        for student in members.all():
            waiting = [
                item
                for keep in await nudges.for_student(student)
                if keep.class_id == room.id
                for item in keep.items
                if item.shared_at <= now - STUDENT_WAIT
            ]
            if not waiting or await _recent(
                db, student.id, Kind.KEEP_UP, room.id, now - STUDENT_EVERY
            ):
                continue
            first = waiting[0]
            await NotificationService(db).notify(
                user_id=student.id,
                kind=Kind.KEEP_UP,
                payload={
                    "class_id": str(room.id),
                    "class_name": room.name,
                    "count": len(waiting),
                    "title": first.title,
                    "topic": first.topic,
                    "assignment_id": str(first.assignment_id),
                },
            )
            sent += 1
        return sent


async def _recent(
    db: AsyncSession, user_id: UUID, kind: Kind, class_id: UUID, since: datetime
) -> bool:
    """Whether this nudge about this class already rang since `since`."""
    found = await db.scalar(
        select(Notification.id)
        .where(
            Notification.user_id == user_id,
            Notification.type == kind.value,
            Notification.payload["class_id"].astext == str(class_id),
            Notification.created_at >= since,
        )
        .limit(1)
    )
    return found is not None


def as_dict(nudge: ClassNudge) -> dict[str, Any]:
    return {
        "class_id": str(nudge.class_id),
        "name": nudge.name,
        "subject": nudge.subject,
        "grade_level": nudge.grade_level,
        "taught": nudge.taught,
        "topics": nudge.topics,
        "next": [{"id": t.id, "title": t.title, "area": t.area} for t in nudge.next],
        "low": [{"id": t.id, "title": t.title, "area": t.area} for t in nudge.low],
        "ready": nudge.ready,
    }


def keep_up_dict(keep: KeepUp) -> dict[str, Any]:
    return {
        "class_id": str(keep.class_id),
        "name": keep.name,
        "items": [
            {
                "assignment_id": str(i.assignment_id),
                "title": i.title,
                "kind": i.kind,
                "topic": i.topic,
                "due_at": i.due_at.isoformat() if i.due_at else None,
            }
            for i in keep.items
        ],
    }
