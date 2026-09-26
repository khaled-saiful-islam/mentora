"""A class at a glance, for its card: what is shared, how it is going and
what is next — for the teacher who runs it, and for each student in it.

Read-only and a handful of grouped queries for any number of classes, so a
list of cards costs the same as one.
"""

from __future__ import annotations

import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.db.models.attempt import Attempt
from app.db.models.classroom import ClassMembership
from app.db.models.learning import Assignment
from app.db.models.live import LiveSession
from app.db.models.user import User
from app.services.live_session_service import LiveSessionService
from app.services.student_home_service import StudentHomeService

# Coming up, or happening now.
UPCOMING = ("scheduled", "lobby", "live")
# How many students' faces a card shows.
FACES = 5
WEEK = timedelta(days=7)


@dataclass(frozen=True, slots=True)
class NextLive:
    id: UUID
    title: str
    scheduled_at: datetime | None
    status: str


@dataclass(frozen=True, slots=True)
class TeacherPulse:
    # Shared and still open.
    shared: int
    # The class's mean first-try score, over everything shared.
    average: float | None
    # Attempts finished in the last seven days.
    finished_week: int
    next_live: NextLive | None
    # The first few students' names, for the faces on the card.
    faces: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class StudentPulse:
    to_do: int
    done: int
    next_live: NextLive | None


EMPTY_TEACHER = TeacherPulse(shared=0, average=None, finished_week=0, next_live=None, faces=())
EMPTY_STUDENT = StudentPulse(to_do=0, done=0, next_live=None)


class ClassPulseService:
    def __init__(self, session: AsyncSession, *, clock: Clock = utc_now) -> None:
        self._session = session
        self._clock = clock

    async def for_teacher(self, class_ids: Sequence[UUID]) -> dict[UUID, TeacherPulse]:
        if not class_ids:
            return {}
        ids = list(class_ids)
        shared = await self._shared(ids)
        average, week = await self._results(ids)
        upcoming = await self._upcoming(ids)
        faces = await self._faces(ids)
        return {
            cid: TeacherPulse(
                shared=shared.get(cid, 0),
                average=average.get(cid),
                finished_week=week.get(cid, 0),
                next_live=upcoming.get(cid),
                faces=faces.get(cid, ()),
            )
            for cid in ids
        }

    async def for_student(self, student: User) -> dict[UUID, StudentPulse]:
        """Per class the student is in: what is left to do, what is done, and
        their next live lesson there."""
        tally: dict[UUID, list[int]] = {}
        for card in await StudentHomeService(self._session).assignments(student):
            counts = tally.setdefault(card.assignment.class_id, [0, 0])
            if card.status in ("todo", "in_progress"):
                counts[0] += 1
            elif card.status == "done":
                counts[1] += 1
        upcoming: dict[UUID, NextLive] = {}
        for view in await LiveSessionService(self._session).for_student(student.id):
            live = view.session
            if live.status in UPCOMING and live.class_id not in upcoming:
                upcoming[live.class_id] = _next(live)
        return {
            cid: StudentPulse(
                to_do=tally.get(cid, [0, 0])[0],
                done=tally.get(cid, [0, 0])[1],
                next_live=upcoming.get(cid),
            )
            for cid in set(tally) | set(upcoming)
        }

    # --- teacher queries ------------------------------------------------------

    async def _shared(self, ids: list[UUID]) -> dict[UUID, int]:
        rows = await self._session.execute(
            select(Assignment.class_id, func.count())
            .where(Assignment.class_id.in_(ids), Assignment.closed_at.is_(None))
            .group_by(Assignment.class_id)
        )
        return {cid: int(n) for cid, n in rows.all()}

    async def _results(self, ids: list[UUID]) -> tuple[dict[UUID, float], dict[UUID, int]]:
        since = self._clock() - WEEK
        rows = await self._session.execute(
            select(Assignment.class_id, Attempt.number, Attempt.percent, Attempt.completed_at)
            .join(Assignment, Assignment.id == Attempt.assignment_id)
            .where(Assignment.class_id.in_(ids), Attempt.status == "completed")
        )
        firsts: dict[UUID, list[float]] = {}
        week: dict[UUID, int] = {}
        for cid, number, percent, completed_at in rows.all():
            if number == 1:
                firsts.setdefault(cid, []).append(float(percent))
            if completed_at is not None and completed_at >= since:
                week[cid] = week.get(cid, 0) + 1
        average = {cid: round(statistics.fmean(scores), 1) for cid, scores in firsts.items()}
        return average, week

    async def _upcoming(self, ids: list[UUID]) -> dict[UUID, NextLive]:
        rows = await self._session.scalars(
            select(LiveSession)
            .where(LiveSession.class_id.in_(ids), LiveSession.status.in_(UPCOMING))
            .order_by(LiveSession.scheduled_at.nulls_last())
        )
        found: dict[UUID, NextLive] = {}
        for live in rows.all():
            found.setdefault(live.class_id, _next(live))
        return found

    async def _faces(self, ids: list[UUID]) -> dict[UUID, tuple[str, ...]]:
        rows = await self._session.execute(
            select(ClassMembership.class_id, User.display_name, User.username)
            .join(User, User.id == ClassMembership.student_id)
            .where(ClassMembership.class_id.in_(ids), ClassMembership.status == "approved")
            .order_by(ClassMembership.decided_at.nulls_last(), User.display_name)
        )
        faces: dict[UUID, list[str]] = {}
        for cid, display_name, username in rows.all():
            names = faces.setdefault(cid, [])
            if len(names) < FACES:
                names.append(display_name or username)
        return {cid: tuple(names) for cid, names in faces.items()}


def _next(live: LiveSession) -> NextLive:
    return NextLive(
        id=live.id, title=live.title, scheduled_at=live.scheduled_at, status=live.status
    )
