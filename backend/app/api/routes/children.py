"""A parent's view of one child — everything the child does, read-only
(PLAN.md §20.3).

Every route starts at the family gate, `FamilyService.child`: a child who is
not linked to this parent is *not found*. What comes back is what the child's
own pages show, built by the same services for the child's id — so a parent
can never see more, or less, than their child does. The one exception is
other children: lesson notes leave out the transcript, which names
classmates.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, SessionDep, require_capability
from app.api.schemas.learning import SetSummary
from app.api.schemas.live import session_summary
from app.api.schemas.play import (
    AttemptResponse,
    ChildWorkItem,
    TodoResponse,
    history_row,
    made_for_you_row,
)
from app.core.errors import NotFoundError
from app.db.models.user import User
from app.events.registry import build_bus
from app.services.attempt_service import AttemptService
from app.services.auto_practice import AutoPracticeService
from app.services.child_view_service import ChildViewService
from app.services.coverage.service import CoverageService
from app.services.family_service import FamilyService
from app.services.live_session_service import LiveSessionService
from app.services.live_summary_service import LiveSummaryService
from app.services.results_service import ResultsService
from app.services.student_home_service import StudentHomeService

router = APIRouter(
    prefix="/me/children/{student_id}",
    tags=["family"],
    dependencies=[Depends(require_capability("see_children"))],
)

LATEST = 4
UPCOMING = 2
SKILLS = 3


async def _child(session, user: User, student_id: UUID) -> User:
    return await FamilyService(session).child(user.id, student_id)


@router.get("/overview")
async def overview(student_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    """This week at a glance: what is waiting, what is done, how it went."""
    child = await _child(session, user, student_id)
    home = await StudentHomeService(session).home(child)
    results = ResultsService(session, build_bus())
    insights = await results.insights(child.id)
    views = await LiveSessionService(session).for_student(child.id)
    return {
        "todo": [TodoResponse.of(c) for c in home["todo"]],
        "done": [TodoResponse.of(c) for c in home["done"]],
        "badges": home["badges"],
        "streak": home["streak"],
        "practise": insights["practise"][:SKILLS],
        "strengths": insights["strengths"][:SKILLS],
        "latest": [history_row(a, s) for a, s in await results.history(child.id, LATEST)],
        "upcoming": [session_summary(v) for v in views if v.session.status != "ended"][:UPCOMING],
        "made_for_you": [
            made_for_you_row(m) for m in await AutoPracticeService(session).made_for(child.id)
        ],
    }


@router.get("/work")
async def work(student_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    """Everything shared with the child, with the latest finished try to open."""
    child = await _child(session, user, student_id)
    cards = await StudentHomeService(session).assignments(child)
    reviews: dict[UUID, UUID] = {}
    for attempt, _ in await ResultsService(session, build_bus()).history(child.id, limit=200):
        if attempt.assignment_id is not None:
            reviews.setdefault(attempt.assignment_id, attempt.id)
    return {
        "items": [
            ChildWorkItem.of(c).model_copy(
                update={"review_attempt_id": reviews.get(c.assignment.id)}
            )
            for c in cards
        ]
    }


@router.get("/results")
async def results(student_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    child = await _child(session, user, student_id)
    service = ResultsService(session, build_bus())
    return {
        "attempts": [history_row(a, s) for a, s in await service.history(child.id)],
        "insights": await service.insights(child.id),
    }


@router.get("/practice")
async def practice(student_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    child = await _child(session, user, student_id)
    rows = await ChildViewService(session).practice(child.id)
    return {
        "items": [
            {
                **SetSummary.of(r.view).model_dump(mode="json"),
                "best": r.best,
                "tries": r.tries,
                "made_for_you": r.made_for_you,
            }
            for r in rows
        ]
    }


@router.get("/schedule")
async def schedule(student_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    """Live lessons coming up and done — and, for those done, whether they came."""
    child = await _child(session, user, student_id)
    views = await LiveSessionService(session).for_student(child.id)
    past = [v for v in views if v.session.status == "ended"]
    came = await ChildViewService(session).attended(child.id, [v.session.id for v in past])
    return {
        "upcoming": [session_summary(v) for v in views if v.session.status != "ended"],
        "past": [{**session_summary(v), "attended": v.session.id in came} for v in reversed(past)],
    }


@router.get("/schedule/{session_id}/notes")
async def lesson_notes(
    student_id: UUID, session_id: UUID, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    """The key points of a lesson the child's group had."""
    child = await _child(session, user, student_id)
    live = await LiveSessionService(session).visible(child.id, session_id)
    if live.status != "ended":
        raise NotFoundError("Notes appear once the lesson has ended.")
    notes = await LiveSummaryService(session).notes(live)
    return {"title": notes["title"], "parts": notes["parts"]}


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
async def attempt(
    student_id: UUID, attempt_id: UUID, user: CurrentUser, session: SessionDep
) -> AttemptResponse:
    """One of the child's tries, with the answers as the child sees them."""
    child = await _child(session, user, student_id)
    return AttemptResponse.of(await AttemptService(session).view(child.id, attempt_id))


@router.get("/classes/{class_id}/coverage")
async def class_coverage(
    student_id: UUID, class_id: UUID, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    """What the class has covered, and how the child did on each topic — the
    report a teacher sends home, always current."""
    child = await _child(session, user, student_id)
    return await CoverageService(session).for_student(class_id, child)
