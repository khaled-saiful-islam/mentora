"""Quizzes and flashcards: making them, watching them made, editing them.

Making one starts a job and answers 202 at once; the build is followed on
`/stream`, which replays from the first event — so a reload, a second tab or
coming back later all rejoin it rather than losing it.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sse_starlette.sse import EventSourceResponse

from app.api.deps import (
    CurrentUser,
    GenerationServiceDep,
    SessionDep,
    StreamUser,
    limit_generate,
    require_any_capability,
)
from app.api.schemas.learning import (
    AddItemRequest,
    EditSetRequest,
    GenerateRequest,
    RewriteRequest,
    RewriteResponse,
    SetDetail,
    SetList,
    SetSummary,
)
from app.core.errors import NotFoundError, ValidationError
from app.db.models.learning import LearningSet
from app.db.session import session_scope
from app.learning.model import GenerationUnavailable
from app.services.generation_service import GenerationDraft, GenerationService
from app.services.jobs import jobs
from app.services.learning_set_service import LearningSetService, SetView
from app.services.work import work
from app.services.work_tickets import for_set

router = APIRouter(
    prefix="/learning-sets",
    tags=["learning"],
    dependencies=[Depends(require_any_capability("share_learning_sets", "make_practice_sets"))],
)


@router.post(
    "/generate",
    response_model=SetSummary,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_generate)],
)
async def generate(
    body: GenerateRequest, user: CurrentUser, session: SessionDep, service: GenerationServiceDep
) -> SetSummary:
    learning_set = await service.begin(session, user, GenerationDraft(**body.model_dump()))
    # Committed before the job starts, so the job's own session finds the row.
    await session.commit()
    _build(learning_set, user.id, service)
    return SetSummary.of(SetView(learning_set, None, 0))


@router.post("/{set_id}/retry", response_model=SetSummary, dependencies=[Depends(limit_generate)])
async def retry(
    set_id: UUID, user: CurrentUser, session: SessionDep, service: GenerationServiceDep
) -> SetSummary:
    learning_set = await LearningSetService(session).owned(user.id, set_id)
    if learning_set.status not in ("failed", "refused") or learning_set.current_version:
        raise ValidationError("Only a set that could not be made can be tried again.")
    learning_set.status, learning_set.failure = "generating", None
    await session.commit()
    _build(learning_set, user.id, service)
    return SetSummary.of(SetView(learning_set, None, 0))


def _build(learning_set: LearningSet, owner_id: UUID, service: GenerationService) -> None:
    """Start making the set in the background, on its owner's work board."""
    jobs.start(
        learning_set.id,
        owner_id,
        service.events(learning_set.id, service.request_for(learning_set)),
        watcher=work.watch(learning_set.id, owner_id, for_set(learning_set)),
    )


@router.get("/{set_id}/stream")
async def stream(set_id: UUID, user: StreamUser) -> EventSourceResponse:
    """The build, from its first event. A build that has already finished
    answers with how it ended, read from the set itself."""
    job = jobs.find(set_id, user.id)
    return EventSourceResponse(_frames(job.follow() if job else _settled(set_id, user.id)), ping=15)


async def _frames(events: AsyncIterator[dict]) -> AsyncIterator[dict[str, str]]:
    async for event in events:
        yield {
            "event": str(event.get("type", "message")),
            "data": json.dumps(event, ensure_ascii=False),
        }


async def _settled(set_id: UUID, owner_id: UUID) -> AsyncIterator[dict]:
    async with session_scope() as session:
        try:
            view = await LearningSetService(session).view(owner_id, set_id)
        except NotFoundError:
            yield {"type": "failed", "message": "No such set."}
            return
    found: LearningSet = view.learning_set
    if found.status == "ready":
        yield {
            "type": "done",
            "set_id": str(set_id),
            "title": found.title,
            "count": len(view.version.items) if view.version else 0,
        }
    elif found.status == "generating":
        # The job is gone (the server restarted) but the row never heard.
        yield {"type": "failed", "message": "This build was interrupted. Try again?"}
    else:
        yield {"type": found.status, "message": found.failure or "This set could not be made."}


@router.get("", response_model=SetList)
async def index(
    user: CurrentUser,
    session: SessionDep,
    kind: str | None = Query(default=None, max_length=32),
    q: str | None = Query(default=None, max_length=80),
    archived: bool = False,
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> SetList:
    views, total = await LearningSetService(session).page(
        user.id, kind=kind, q=q, archived=archived, limit=limit, offset=offset
    )
    return SetList(items=[SetSummary.of(v) for v in views], total=total, limit=limit, offset=offset)


@router.get("/{set_id}", response_model=SetDetail)
async def read(set_id: UUID, user: CurrentUser, session: SessionDep) -> SetDetail:
    return SetDetail.of(await LearningSetService(session).view(user.id, set_id))


@router.patch("/{set_id}", response_model=SetDetail)
async def edit(
    set_id: UUID, body: EditSetRequest, user: CurrentUser, session: SessionDep
) -> SetDetail:
    view = await LearningSetService(session).edit(
        user.id, set_id, title=body.title, items=body.items, extras=body.extras
    )
    return SetDetail.of(view)


@router.post(
    "/{set_id}/items/{item_id}/rewrite",
    response_model=RewriteResponse,
    dependencies=[Depends(limit_generate)],
)
async def rewrite(
    set_id: UUID,
    item_id: str,
    body: RewriteRequest,
    user: CurrentUser,
    session: SessionDep,
    service: GenerationServiceDep,
) -> RewriteResponse:
    try:
        item = await service.rewrite(session, user.id, set_id, item_id[:40], body.instruction)
    except GenerationUnavailable as exc:
        raise ValidationError(str(exc)) from exc
    return RewriteResponse(item=item)


@router.post(
    "/{set_id}/items",
    response_model=RewriteResponse,
    dependencies=[Depends(limit_generate)],
)
async def add_item(
    set_id: UUID,
    body: AddItemRequest,
    user: CurrentUser,
    session: SessionDep,
    service: GenerationServiceDep,
) -> RewriteResponse:
    """One more item, written on the teacher's word. Returned for the editor
    to place and save — nothing is saved here."""
    try:
        item = await service.add(session, user.id, set_id, body.instruction)
    except GenerationUnavailable as exc:
        raise ValidationError(str(exc)) from exc
    return RewriteResponse(item=item)


@router.delete("/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive(set_id: UUID, user: CurrentUser, session: SessionDep) -> Response:
    await LearningSetService(session).archive(user.id, set_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
