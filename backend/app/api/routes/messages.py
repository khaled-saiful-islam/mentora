"""A parent and their child's teacher, writing to each other
(`docs/features/048-parent-teacher-messages.md`).

Every route goes through `ParentTeacherService`, whose gate answers *not
found* for a thread that is not this person's or whose link has ended.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, SessionDep, limit_messages, require_capability
from app.api.schemas.messages import (
    AskFamilyRequest,
    AskFamilyResponse,
    ContactResponse,
    InboxResponse,
    MessagePageResponse,
    MessageResponse,
    OpenThreadRequest,
    SendRequest,
    ThreadResponse,
    UnreadMessagesResponse,
    WaitingResponse,
)
from app.services.parent_teacher.invites import ask_family, unconnected
from app.services.parent_teacher.service import ParentTeacherService

router = APIRouter(
    prefix="/messages",
    tags=["messages"],
    dependencies=[Depends(require_capability("parent_teacher_messages"))],
)


@router.get("", response_model=InboxResponse)
async def inbox(user: CurrentUser, session: SessionDep) -> InboxResponse:
    """The conversations, everyone this person may start one with, and — for
    a teacher — the students whose family has not connected yet."""
    talk = ParentTeacherService(session)
    threads = await talk.threads(user)
    return InboxResponse(
        threads=[ThreadResponse.of(view, user.id) for view in threads],
        contacts=[ContactResponse.of(c) for c in await talk.contacts(user)],
        waiting=[WaitingResponse.of(s) for s in await unconnected(session, user)],
        unread=sum(view.unread for view in threads),
    )


@router.post(
    "/ask-family", response_model=AskFamilyResponse, dependencies=[Depends(limit_messages)]
)
async def ask(body: AskFamilyRequest, user: CurrentUser, session: SessionDep) -> AskFamilyResponse:
    """A teacher asking a student to connect a parent (`invites.py`)."""
    return AskFamilyResponse(sent=await ask_family(session, user, body.student_id))


@router.get("/unread", response_model=UnreadMessagesResponse)
async def unread(user: CurrentUser, session: SessionDep) -> UnreadMessagesResponse:
    return UnreadMessagesResponse(unread=await ParentTeacherService(session).unread_total(user))


@router.post("/threads", response_model=ThreadResponse)
async def open_thread(
    body: OpenThreadRequest, user: CurrentUser, session: SessionDep
) -> ThreadResponse:
    view = await ParentTeacherService(session).open(user, body.student_id, body.person_id)
    return ThreadResponse.of(view, user.id)


@router.get("/threads/{thread_id}", response_model=ThreadResponse)
async def thread(thread_id: UUID, user: CurrentUser, session: SessionDep) -> ThreadResponse:
    return ThreadResponse.of(await ParentTeacherService(session).thread(user, thread_id), user.id)


@router.get("/threads/{thread_id}/messages", response_model=MessagePageResponse)
async def messages(
    thread_id: UUID,
    user: CurrentUser,
    session: SessionDep,
    before: UUID | None = Query(default=None),
) -> MessagePageResponse:
    page = await ParentTeacherService(session).messages(user, thread_id, before=before)
    return MessagePageResponse.of(page, user.id)


@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageResponse,
    dependencies=[Depends(limit_messages)],
)
async def send(
    thread_id: UUID, body: SendRequest, user: CurrentUser, session: SessionDep
) -> MessageResponse:
    message = await ParentTeacherService(session).send(user, thread_id, body.body)
    return MessageResponse.of(message, user.id)


@router.post("/threads/{thread_id}/read", response_model=UnreadMessagesResponse)
async def read(thread_id: UUID, user: CurrentUser, session: SessionDep) -> UnreadMessagesResponse:
    talk = ParentTeacherService(session)
    await talk.read(user, thread_id)
    return UnreadMessagesResponse(unread=await talk.unread_total(user))
