"""A student taking what they were given — or their own practice — and
everything about how they are doing."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import (
    CurrentUser,
    NarratorDep,
    PictureFillerDep,
    SessionDep,
    SettingsDep,
    limit_speech,
    require_capability,
)
from app.api.schemas.learning import SetSummary
from app.api.schemas.play import (
    AnswerRequest,
    AnswerResponse,
    AttemptResponse,
    BadgesResponse,
    EarnedBadge,
    FinishResponse,
    HomeWorkResponse,
    TodoResponse,
    catalog,
    history_row,
    made_for_you_row,
)
from app.api.schemas.read_aloud import SpokenDep, clip
from app.badges.catalog import CATALOG
from app.core.errors import ValidationError
from app.events.registry import build_bus
from app.services.attempt_service import AttemptService
from app.services.auto_practice import AutoPracticeService
from app.services.badge_service import BadgeService
from app.services.child_view_service import ChildViewService
from app.services.family_share_service import FamilyShareService
from app.services.item_picture_service import ItemPictureService
from app.services.play_service import PlayService
from app.services.read_aloud import ReadAloudService
from app.services.results_service import ResultsService
from app.services.student_home_service import StudentHomeService

router = APIRouter(
    prefix="/me",
    tags=["play"],
    dependencies=[Depends(require_capability("take_assignments"))],
)


@router.get("/assignments", response_model=list[TodoResponse])
async def my_assignments(
    user: CurrentUser, session: SessionDep, status: str | None = Query(default=None, max_length=16)
) -> list[TodoResponse]:
    cards = await StudentHomeService(session).assignments(user)
    return [TodoResponse.of(c) for c in cards if status is None or c.status == status]


@router.get("/home")
async def home(user: CurrentUser, session: SessionDep) -> dict[str, object]:
    found = await StudentHomeService(session).home(user)
    insights = await ResultsService(session, build_bus()).insights(user.id)
    return {
        "todo": [TodoResponse.of(c) for c in found["todo"]],
        "done": [TodoResponse.of(c) for c in found["done"]],
        "badges": found["badges"],
        "streak": found["streak"],
        "from_home": [
            HomeWorkResponse.of(w) for w in await FamilyShareService(session).for_student(user.id)
        ],
        "practise": insights["practise"][:2],
        "strengths": insights["strengths"][:2],
        "made_for_you": [
            made_for_you_row(m) for m in await AutoPracticeService(session).made_for(user.id)
        ],
    }


@router.post("/assignments/{assignment_id}/attempts", response_model=AttemptResponse)
async def start(assignment_id: UUID, user: CurrentUser, session: SessionDep) -> AttemptResponse:
    """Start, or resume the one already going, or — if no more tries are
    allowed — the last finished one, for its results."""
    return AttemptResponse.of(
        await AttemptService(session, bus=build_bus()).start(user, assignment_id)
    )


@router.post("/practice/{set_id}/attempts", response_model=AttemptResponse)
async def practise(set_id: UUID, user: CurrentUser, session: SessionDep) -> AttemptResponse:
    return AttemptResponse.of(await AttemptService(session).start_practice(user, set_id))


@router.post("/from-home/{share_id}/attempts", response_model=AttemptResponse)
async def from_home(share_id: UUID, user: CurrentUser, session: SessionDep) -> AttemptResponse:
    """Something a parent sent home: start it, or carry on with it."""
    share = await FamilyShareService(session).visible(user.id, share_id)
    return AttemptResponse.of(await AttemptService(session).start_from_home(user, share))


@router.get("/practice")
async def my_practice(user: CurrentUser, session: SessionDep) -> dict[str, object]:
    """Everything there is to practise that is the student's own: what Mentora
    made for them, and any sets they made before students stopped making them."""
    rows = await ChildViewService(session).practice(user.id)
    return {
        "items": [
            {
                **SetSummary.of(r.view).model_dump(mode="json"),
                "best": r.best,
                "tries": r.tries,
                "made_for_you": r.made_for_you,
            }
            for r in rows
            if r.view.learning_set.status == "ready"
        ]
    }


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
async def attempt(attempt_id: UUID, user: CurrentUser, session: SessionDep) -> AttemptResponse:
    return AttemptResponse.of(await AttemptService(session).view(user.id, attempt_id))


@router.post("/attempts/{attempt_id}/answers", response_model=AnswerResponse)
async def answer(
    attempt_id: UUID, body: AnswerRequest, user: CurrentUser, session: SessionDep
) -> AnswerResponse:
    if (body.choice is None) == (body.knew is None):
        raise ValidationError("Send a choice for a question, or knew for a card.")
    response = {"choice": body.choice} if body.choice is not None else {"knew": body.knew}
    result = await AttemptService(session, bus=build_bus()).answer(
        user.id, attempt_id, body.item_id, response, body.time_ms
    )
    return AnswerResponse.of(result)


@router.get("/attempts/{attempt_id}/pictures")
async def pictures(
    attempt_id: UUID, user: CurrentUser, session: SessionDep, filler: PictureFillerDep
) -> dict[str, object]:
    """Pictures beside the questions, for the Year 1–3 look: those found so
    far, and whether any are still being looked for."""
    found = await ItemPictureService(session, filler).for_attempt(user.id, attempt_id)
    return {"pictures": found.pictures, "done": found.done}


@router.get("/attempts/{attempt_id}/speech", dependencies=[Depends(limit_speech)])
async def speech(
    attempt_id: UUID,
    spoken: SpokenDep,
    user: CurrentUser,
    session: SessionDep,
    narrator: NarratorDep,
    settings: SettingsDep,
) -> Response:
    """Read it to me: one part of an item, in the tutor's voice."""
    audio = await ReadAloudService(session, narrator, settings).for_attempt(
        user.id, attempt_id, spoken.item, spoken.part, spoken.n
    )
    return clip(audio, keep=True)


@router.post("/attempts/{attempt_id}/complete", response_model=FinishResponse)
async def complete(attempt_id: UUID, user: CurrentUser, session: SessionDep) -> FinishResponse:
    return FinishResponse.of(await PlayService(session, build_bus()).finish(user, attempt_id))


@router.get("/results")
async def results(user: CurrentUser, session: SessionDep) -> dict[str, object]:
    service = ResultsService(session, build_bus())
    history = await service.history(user.id)
    return {
        "attempts": [history_row(a, s) for a, s in history],
        "insights": await service.insights(user.id),
    }


@router.get("/badges", response_model=BadgesResponse)
async def badges(user: CurrentUser, session: SessionDep) -> BadgesResponse:
    earned = await BadgeService(session, build_bus()).earned(user.id)
    return BadgesResponse(
        earned=[
            EarnedBadge(
                badge=b.badge,
                name=CATALOG[b.badge].name if b.badge in CATALOG else b.badge,
                description=CATALOG[b.badge].description if b.badge in CATALOG else "",
                reason=str(b.detail.get("reason", "")),
                awarded_at=b.awarded_at,
            )
            for b in earned
        ],
        catalog=catalog(),
    )
