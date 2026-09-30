"""What a student's buddy knows about them, in one place.

The buddy keeps a student company on every page. To say something that
really helps ("Water was tricky last time, so let's read slowly"), it has
to know the student: what is waiting and when it is due, their streak and
badges, what they are strong at and what needs practice, how their
quizzes, flashcards and study guides have gone lately, and their next live
lesson. This puts that together from the services that already know each
part (`features/buddies/companion.ts` turns it into words).

Nothing here is about a question's content, so nothing the buddy says from
it can give an answer away.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.events.registry import build_bus
from app.services.family_service import first_name
from app.services.live_session_service import LiveSessionService
from app.services.results_service import ResultsService
from app.services.student_home_service import StudentHomeService

# How far ahead a due date counts as "soon".
SOON = timedelta(hours=48)
# How many finished attempts of each kind "lately" means.
LATELY = 10
# How long after its start a lesson may still be on.
LESSON_RUNS = timedelta(hours=2)
KINDS = ("quiz", "flashcard", "study_guide")


@dataclass(frozen=True, slots=True)
class Waiting:
    title: str
    kind: str
    due_at: str | None
    overdue: bool


@dataclass(frozen=True, slots=True)
class Recent:
    title: str
    kind: str
    percent: float


@dataclass(frozen=True, slots=True)
class KindRecord:
    """How one kind of set has gone lately: the average, and over how many."""

    kind: str
    average: float
    count: int


@dataclass(frozen=True, slots=True)
class NextLesson:
    id: str
    title: str
    status: str
    scheduled_at: str | None


@dataclass(frozen=True, slots=True)
class BuddyBrief:
    name: str
    streak: int
    badges: int
    # Soonest first, at most three; `waiting_count` is how many in all.
    waiting: tuple[Waiting, ...]
    waiting_count: int
    overdue: int
    due_soon: int
    strengths: tuple[str, ...]
    practise: tuple[str, ...]
    recent: tuple[Recent, ...]
    kinds: tuple[KindRecord, ...]
    next_lesson: NextLesson | None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


async def brief_for(
    session: AsyncSession, student: User, *, now: datetime | None = None
) -> BuddyBrief:
    at = now or datetime.now(UTC)
    home = await StudentHomeService(session).home(student)
    results = ResultsService(session, build_bus())
    insights = await results.insights(student.id)
    history = await results.history(student.id, limit=LATELY * len(KINDS))
    waiting = in_order([_waiting(card.assignment, at) for card in home["todo"]])
    return BuddyBrief(
        name=first_name(student),
        streak=int(home["streak"]),
        badges=int(home["badges"]),
        waiting=tuple(waiting[:3]),
        waiting_count=len(waiting),
        overdue=sum(1 for w in waiting if w.overdue),
        due_soon=sum(1 for w in waiting if _soon(w, at)),
        strengths=tuple(s["label"] for s in insights["strengths"][:2]),
        practise=tuple(s["label"] for s in insights["practise"][:2]),
        recent=tuple(
            Recent(title=s.title, kind=s.kind, percent=float(a.percent)) for a, s in history[:3]
        ),
        kinds=_kinds([(s.kind, float(a.percent)) for a, s in history]),
        next_lesson=await _next_lesson(session, student.id, at),
    )


def _waiting(assignment: Any, at: datetime) -> Waiting:
    due = assignment.due_at
    return Waiting(
        title=assignment.title,
        kind=assignment.kind,
        due_at=due.isoformat() if due else None,
        overdue=bool(due and due < at),
    )


def in_order(waiting: list[Waiting]) -> list[Waiting]:
    """Overdue first, then the soonest due, then the rest as home lists them."""
    return sorted(waiting, key=lambda w: (not w.overdue, w.due_at is None, w.due_at or ""))


def _soon(waiting: Waiting, at: datetime) -> bool:
    if waiting.overdue or waiting.due_at is None:
        return False
    return datetime.fromisoformat(waiting.due_at) - at <= SOON


def _kinds(scores: list[tuple[str, float]]) -> tuple[KindRecord, ...]:
    """The average of each kind's latest attempts, newest first in `scores`."""
    by_kind: dict[str, list[float]] = defaultdict(list)
    for kind, percent in scores:
        if len(by_kind[kind]) < LATELY:
            by_kind[kind].append(percent)
    return tuple(
        KindRecord(kind=k, average=round(sum(v) / len(v), 1), count=len(v))
        for k in KINDS
        if (v := by_kind.get(k))
    )


async def _next_lesson(session: AsyncSession, student_id: UUID, at: datetime) -> NextLesson | None:
    """The lesson happening now, or else the next one on the schedule."""
    views = await LiveSessionService(session).for_student(student_id)
    lessons = [v.session for v in views]
    on = [s for s in lessons if s.status in ("lobby", "live")]
    ahead = [
        s
        for s in lessons
        if s.status == "scheduled" and s.scheduled_at and s.scheduled_at >= at - LESSON_RUNS
    ]
    found = on[0] if on else (ahead[0] if ahead else None)
    if found is None:
        return None
    return NextLesson(
        id=str(found.id),
        title=found.title,
        status=found.status,
        scheduled_at=found.scheduled_at.isoformat() if found.scheduled_at else None,
    )
