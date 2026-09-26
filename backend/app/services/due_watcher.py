"""The past-due watcher (PLAN.md §20.5): when a child's work passes its due
date unfinished, their parents hear at once — and only once.

Each tick looks at work due in the last `OVERDUE_LOOK_BACK_HOURS`:

- class work: an assignment still open, in a class not archived, for the
  children it is shared with now — a child who left is not counted;
- work from home: a share whose parent is still linked.

A child with a finished try, or with no parent, is skipped. Each alert is
claimed in `overdue_notices` under the work, its due date and the child, in
the same transaction as the notes — so a restart, a second tick or a read
bell note never sends it twice, and a failed tick sends it next time.

A loop in the app's lifespan, like the live-lesson clock.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Iterable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.attempt import Attempt
from app.db.models.classroom import Classroom
from app.db.models.family import FamilyLink, FamilyShare, OverdueNotice
from app.db.models.learning import Assignment, LearningSet
from app.db.models.user import User
from app.events.bus import EventBus
from app.events.catalog import ChildOverdue
from app.services.assignment_service import AssignmentService
from app.services.family_service import first_name

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]


@dataclass(frozen=True, slots=True)
class Overdue:
    """One child's unfinished piece of work, past its due date."""

    work_key: str
    student_id: UUID
    title: str
    kind: str
    due_at: datetime
    source: str  # class | home
    source_name: str
    # What a finished try would point at: the assignment, or the set sent home.
    assignment_id: UUID | None
    set_id: UUID


class DueWatcher:
    def __init__(
        self, *, settings: Settings, bus: Callable[[], EventBus], session_maker: SessionMaker
    ) -> None:
        self._settings = settings
        self._bus = bus
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
                logger.exception("the past-due watcher failed a tick")
            await asyncio.sleep(self._settings.due_watcher_seconds)

    async def check(self, db: AsyncSession, now: datetime) -> int:
        """Announce what went past due since the look-back; how many alerts."""
        since = now - timedelta(hours=self._settings.overdue_look_back_hours)
        found = [*await _class_work(db, since, now), *await _home_work(db, since, now)]
        if not found:
            return 0
        students = {item.student_id for item in found}
        parents = await _parents(db, students)
        names = await _first_names(db, students)
        finished = await _finished(db, found)
        sent = 0
        for item in found:
            if not parents.get(item.student_id) or _key(item) in finished:
                continue
            if not await _claim(db, item):
                continue
            await self._bus().publish(
                ChildOverdue(
                    student_id=item.student_id,
                    student_name=names.get(item.student_id, "Your child"),
                    parent_ids=tuple(parents[item.student_id]),
                    title=item.title,
                    kind=item.kind,
                    due_at=item.due_at.isoformat(),
                    source=item.source,
                    source_name=item.source_name,
                ),
                db,
            )
            sent += 1
        return sent


def _stamp(due: datetime) -> int:
    return int(due.timestamp())


def _key(item: Overdue) -> tuple[UUID | None, UUID, UUID]:
    return (item.assignment_id, item.set_id, item.student_id)


async def _class_work(db: AsyncSession, since: datetime, now: datetime) -> list[Overdue]:
    rows = await db.execute(
        select(Assignment, Classroom.name)
        .join(Classroom, Classroom.id == Assignment.class_id)
        .where(
            Assignment.due_at > since,
            Assignment.due_at <= now,
            Assignment.closed_at.is_(None),
            Classroom.archived_at.is_(None),
        )
    )
    audience = AssignmentService(db, EventBus())
    found: list[Overdue] = []
    for assignment, class_name in rows.all():
        for student_id in await audience.audience(assignment):
            found.append(
                Overdue(
                    work_key=f"class:{assignment.id}:{_stamp(assignment.due_at)}",
                    student_id=student_id,
                    title=assignment.title,
                    kind=assignment.kind,
                    due_at=assignment.due_at,
                    source="class",
                    source_name=class_name,
                    assignment_id=assignment.id,
                    set_id=assignment.set_id,
                )
            )
    return found


async def _home_work(db: AsyncSession, since: datetime, now: datetime) -> list[Overdue]:
    rows = await db.execute(
        select(FamilyShare, LearningSet.title, LearningSet.kind, FamilyLink.label)
        .join(LearningSet, LearningSet.id == FamilyShare.set_id)
        .join(
            FamilyLink,
            (FamilyLink.parent_id == FamilyShare.parent_id)
            & (FamilyLink.student_id == FamilyShare.student_id),
        )
        .where(
            FamilyShare.due_at > since,
            FamilyShare.due_at <= now,
            LearningSet.archived_at.is_(None),
        )
    )
    return [
        Overdue(
            work_key=f"home:{share.id}:{_stamp(share.due_at)}",
            student_id=share.student_id,
            title=title,
            kind=kind,
            due_at=share.due_at,
            source="home",
            source_name=label,
            assignment_id=None,
            set_id=share.set_id,
        )
        for share, title, kind, label in rows.all()
    ]


async def _parents(db: AsyncSession, students: Iterable[UUID]) -> dict[UUID, list[UUID]]:
    rows = await db.execute(
        select(FamilyLink.student_id, FamilyLink.parent_id).where(
            FamilyLink.student_id.in_(list(students))
        )
    )
    found: dict[UUID, list[UUID]] = {}
    for student_id, parent_id in rows.all():
        found.setdefault(student_id, []).append(parent_id)
    return found


async def _first_names(db: AsyncSession, students: Iterable[UUID]) -> dict[UUID, str]:
    rows = await db.scalars(select(User).where(User.id.in_(list(students))))
    return {user.id: first_name(user) for user in rows.all()}


async def _finished(db: AsyncSession, found: list[Overdue]) -> set[tuple[UUID | None, UUID, UUID]]:
    """(assignment, set, child) with a finished try — class work by its
    assignment, work from home by its set."""
    rows = await db.execute(
        select(Attempt.assignment_id, Attempt.set_id, Attempt.student_id).where(
            Attempt.status == "completed",
            Attempt.student_id.in_(list({item.student_id for item in found})),
            Attempt.set_id.in_(list({item.set_id for item in found})),
        )
    )
    return {(assignment_id, set_id, student_id) for assignment_id, set_id, student_id in rows}


async def _claim(db: AsyncSession, item: Overdue) -> bool:
    """Record the alert; False when it went out before."""
    claimed = await db.scalar(
        insert(OverdueNotice)
        .values(work_key=item.work_key, student_id=item.student_id)
        .on_conflict_do_nothing()
        .returning(OverdueNotice.work_key)
    )
    return claimed is not None
