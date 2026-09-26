"""Live sessions: a teacher setting one up, reviewing its lesson and putting it
on the group's schedule; a student seeing what is coming.

Writing the lesson and recording its voice are jobs (202 at once), followed on
`/work/stream`, which replays from the first event — so a reload rejoins it.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sse_starlette.sse import EventSourceResponse

from app.api.deps import (
    CurrentUser,
    LivePlanServiceDep,
    SessionDep,
    StreamUser,
    limit_generate,
    limit_upload,
    require_capability,
)
from app.api.schemas.live import (
    BreakdownRequest,
    CreateSession,
    RewriteSegment,
    ScheduleRequest,
    SegmentEdit,
    TemplateRequest,
    TemplateUpdate,
    UpdateSession,
    document_out,
    segment_out,
    session_detail,
    session_summary,
    template_out,
)
from app.core.errors import NotFoundError, ValidationError
from app.db.models.live import LiveSession
from app.db.session import session_scope
from app.events.registry import build_bus
from app.live.beats import beats_from
from app.live.planner import checkin_from
from app.services.document_extract import (
    UnreadableDocument,
    UnsupportedDocument,
    classify,
    extract,
)
from app.services.document_service import human_size
from app.services.jobs import jobs
from app.services.live_session_service import EDITABLE, LiveSessionService
from app.services.live_template_service import LiveTemplateService

router = APIRouter(
    prefix="/live-sessions",
    tags=["live"],
    dependencies=[Depends(require_capability("run_live_sessions"))],
)
templates = APIRouter(
    prefix="/live-templates",
    tags=["live"],
    dependencies=[Depends(require_capability("run_live_sessions"))],
)
mine = APIRouter(
    prefix="/me/live-sessions",
    tags=["live"],
    dependencies=[Depends(require_capability("join_live_sessions"))],
)

MAX_DOCUMENT_BYTES = 8 * 1024 * 1024


def _service(session: SessionDep) -> LiveSessionService:
    return LiveSessionService(session, build_bus())


async def _detail(
    service: LiveSessionService, plans: LivePlanServiceDep, live: LiveSession
) -> dict[str, Any]:
    voice, speed = await plans.voice_of(live.id)
    return session_detail(
        await service.view(live),
        await service.segments(live.id),
        await service.documents(live.id),
        {"voice": voice, "speed": speed},
    )


# --- a teacher's sessions ---------------------------------------------------


@router.get("")
async def index(user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    views = await _service(session).for_teacher(user.id)
    return {"items": [session_summary(v) for v in views]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(
    body: CreateSession, user: CurrentUser, session: SessionDep, plans: LivePlanServiceDep
) -> dict[str, Any]:
    service = _service(session)
    live = await service.create(
        user,
        class_id=body.class_id,
        group_id=body.group_id,
        settings=body.settings,
        template_id=body.template_id,
    )
    return await _detail(service, plans, live)


@router.post("/breakdown", dependencies=[Depends(limit_generate)])
async def breakdown(
    body: BreakdownRequest, user: CurrentUser, session: SessionDep, plans: LivePlanServiceDep
) -> dict[str, Any]:
    notes = ""
    if body.session_id is not None:
        service = _service(session)
        live = await service.owned(user.id, body.session_id)
        notes = "\n\n".join(d.text[:800] for d in await service.documents(live.id))
    parts = await plans.breakdown(
        subject=body.subject,
        topic=body.topic,
        grade_level=body.grade_level,
        difficulty=body.difficulty,
        notes=notes,
    )
    return {"parts": parts}


@router.get("/{session_id}")
async def show(
    session_id: UUID, user: CurrentUser, session: SessionDep, plans: LivePlanServiceDep
) -> dict[str, Any]:
    service = _service(session)
    return await _detail(service, plans, await service.owned(user.id, session_id))


@router.patch("/{session_id}")
async def update(
    session_id: UUID,
    body: UpdateSession,
    user: CurrentUser,
    session: SessionDep,
    plans: LivePlanServiceDep,
) -> dict[str, Any]:
    service = _service(session)
    live = await service.update_settings(user.id, session_id, body.settings)
    return await _detail(service, plans, live)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(session_id: UUID, user: CurrentUser, session: SessionDep) -> Response:
    await _service(session).delete(user.id, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{session_id}/documents",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_upload)],
)
async def upload(
    session_id: UUID, user: CurrentUser, session: SessionDep, file: UploadFile = File(...)
) -> dict[str, Any]:
    service = _service(session)
    live = await service.owned(user.id, session_id)
    data = await file.read()
    name = (file.filename or "file").strip()[:255]
    if not data:
        raise ValidationError(f"{name} is empty.")
    if len(data) > MAX_DOCUMENT_BYTES:
        raise ValidationError(
            f"{name} is {human_size(len(data))}. The limit is {human_size(MAX_DOCUMENT_BYTES)}."
        )
    media_type = file.content_type or "application/octet-stream"
    try:
        if classify(filename=name, media_type=media_type) == "image":
            raise ValidationError("Upload the lesson's text: a PDF, Word, PowerPoint or text file.")
        extracted = extract(data, filename=name, media_type=media_type)
    except (UnsupportedDocument, UnreadableDocument) as exc:
        raise ValidationError(str(exc)) from exc
    document = await service.add_document(
        live, filename=name, media_type=media_type, size=len(data), text=extracted.text
    )
    return document_out(document)


@router.delete("/{session_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document(
    session_id: UUID, document_id: UUID, user: CurrentUser, session: SessionDep
) -> Response:
    service = _service(session)
    live = await service.owned(user.id, session_id)
    if live.status not in EDITABLE:
        raise ValidationError("This session can no longer be changed.")
    await service.remove_document(live, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{session_id}/plan",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_generate)],
)
async def plan(
    session_id: UUID, user: CurrentUser, session: SessionDep, plans: LivePlanServiceDep
) -> dict[str, Any]:
    service = _service(session)
    live = await service.owned(user.id, session_id)
    if live.status not in ("draft", "planned", "failed", "approved"):
        raise ValidationError("This session's lesson can't be written again now.")
    live.status, live.failure = "planning", None
    await session.commit()
    jobs.start(live.id, user.id, plans.plan_events(live.id))
    return {"id": str(live.id), "status": live.status}


@router.post("/{session_id}/approve", status_code=status.HTTP_202_ACCEPTED)
async def approve(
    session_id: UUID, user: CurrentUser, session: SessionDep, plans: LivePlanServiceDep
) -> dict[str, Any]:
    service = _service(session)
    live = await service.owned(user.id, session_id)
    if live.status not in ("planned", "approved"):
        raise ValidationError("Write the lesson before approving it.")
    if not await service.segments(live.id):
        raise ValidationError("This lesson has no parts yet.")
    live.status, live.failure = "recording", None
    await session.commit()
    jobs.start(live.id, user.id, plans.record_events(live.id))
    return {"id": str(live.id), "status": live.status}


@router.get("/{session_id}/work/stream")
async def work(session_id: UUID, user: StreamUser) -> EventSourceResponse:
    """The lesson being written or recorded, from its first event. When nothing
    is running, one `settled` event says where the session is."""
    job = jobs.find(session_id, user.id)
    return EventSourceResponse(
        _frames(job.follow() if job else _settled(session_id, user.id)), ping=15
    )


@router.patch("/{session_id}/segments/{segment_id}")
async def edit_segment(
    session_id: UUID, segment_id: UUID, body: SegmentEdit, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    service = _service(session)
    live = await service.owned(user.id, session_id)
    if live.status not in EDITABLE:
        raise ValidationError("This session can no longer be changed.")
    row = await service.segment(live, segment_id)
    if body.title is not None:
        row.title = " ".join(body.title.split())
    if body.beats is not None:
        made = beats_from([b.model_dump() for b in body.beats], prefix=f"s{row.position}b")
        if not made:
            raise ValidationError("A part needs something to say.")
        row.beats = [b.as_dict() for b in made]
    if body.key_points is not None:
        row.key_points = [" ".join(k.split()) for k in body.key_points if k.strip()]
    if body.remove_image:
        row.image = None
    if body.remove_checkin:
        row.checkin = None
    elif body.checkin is not None:
        checked = checkin_from(body.checkin.model_dump())
        if checked is None:
            raise ValidationError("A check needs a question, different options and a right answer.")
        row.checkin = checked
    service.reopen(live)
    await session.flush()
    return segment_out(row)


@router.post("/{session_id}/segments/{segment_id}/rewrite", dependencies=[Depends(limit_generate)])
async def rewrite_segment(
    session_id: UUID,
    segment_id: UUID,
    body: RewriteSegment,
    user: CurrentUser,
    session: SessionDep,
    plans: LivePlanServiceDep,
) -> dict[str, Any]:
    live = await _service(session).owned(user.id, session_id)
    if live.status not in EDITABLE:
        raise ValidationError("This session can no longer be changed.")
    await session.commit()
    return await plans.rewrite(user.id, session_id, segment_id, body.instruction)


@router.post("/{session_id}/schedule")
async def schedule(
    session_id: UUID,
    body: ScheduleRequest,
    user: CurrentUser,
    session: SessionDep,
    plans: LivePlanServiceDep,
) -> dict[str, Any]:
    service = _service(session)
    live = await service.schedule(user, session_id, body.at)
    return await _detail(service, plans, live)


@router.post("/{session_id}/cancel")
async def cancel(
    session_id: UUID, user: CurrentUser, session: SessionDep, plans: LivePlanServiceDep
) -> dict[str, Any]:
    service = _service(session)
    live = await service.cancel(user, session_id)
    return await _detail(service, plans, live)


# --- templates ------------------------------------------------------------------


@templates.get("")
async def template_index(user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    return {"items": [template_out(t) for t in await LiveTemplateService(session).list(user.id)]}


@templates.post("", status_code=status.HTTP_201_CREATED)
async def template_create(
    body: TemplateRequest, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    return template_out(
        await LiveTemplateService(session).create(user.id, body.name, body.settings)
    )


@templates.patch("/{template_id}")
async def template_update(
    template_id: UUID, body: TemplateUpdate, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    made = await LiveTemplateService(session).update(
        user.id, template_id, name=body.name, settings=body.settings
    )
    return template_out(made)


@templates.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def template_delete(template_id: UUID, user: CurrentUser, session: SessionDep) -> Response:
    await LiveTemplateService(session).delete(user.id, template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- a student's schedule ---------------------------------------------------------


@mine.get("")
async def my_sessions(user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    views = await LiveSessionService(session).for_student(user.id)
    upcoming = [session_summary(v) for v in views if v.session.status != "ended"]
    past = [session_summary(v) for v in views if v.session.status == "ended"]
    return {"upcoming": upcoming, "past": list(reversed(past))}


@mine.get("/{session_id}")
async def my_session(session_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    service = LiveSessionService(session)
    for view in await service.for_student(user.id):
        if view.session.id == session_id:
            return session_summary(view)
    raise NotFoundError("No such live session.")


# --- streaming ----------------------------------------------------------------


async def _frames(events: AsyncIterator[dict]) -> AsyncIterator[dict[str, str]]:
    async for event in events:
        yield {
            "event": str(event.get("type", "message")),
            "data": json.dumps(event, ensure_ascii=False),
        }


async def _settled(session_id: UUID, teacher_id: UUID) -> AsyncIterator[dict]:
    async with session_scope() as session:
        try:
            live = await LiveSessionService(session).owned(teacher_id, session_id)
        except NotFoundError:
            yield {"type": "settled", "status": "missing", "failure": None}
            return
        yield {"type": "settled", "status": live.status, "failure": live.failure}
