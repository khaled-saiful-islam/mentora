"""The bell: a page of news, an unread count, and a live stream of changes.

The stream carries no content, only "something changed" — the browser then
asks for the page it is showing. That keeps one source of truth (the table)
and makes a missed push harmless: the next one, or the fallback poll, catches
up.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Query
from sse_starlette.sse import EventSourceResponse

from app.api.deps import CurrentUser, SessionDep, StreamUser
from app.api.schemas.notifications import (
    NotificationPageResponse,
    NotificationResponse,
    UnreadResponse,
)
from app.services.notification_service import NotificationService
from app.services.realtime import hub

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPageResponse)
async def page(
    user: CurrentUser,
    session: SessionDep,
    cursor: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
) -> NotificationPageResponse:
    bell = NotificationService(session)
    found = await bell.page(user.id, cursor=cursor, limit=limit)
    return NotificationPageResponse(
        items=[NotificationResponse.of(note) for note in found.items],
        next_cursor=found.next_cursor,
        unread=await bell.unread_count(user.id),
        unseen=await bell.unseen_count(user.id),
    )


@router.get("/unread-count", response_model=UnreadResponse)
async def unread(user: CurrentUser, session: SessionDep) -> UnreadResponse:
    bell = NotificationService(session)
    return UnreadResponse(
        unread=await bell.unread_count(user.id), unseen=await bell.unseen_count(user.id)
    )


@router.post("/seen", response_model=UnreadResponse)
async def seen(user: CurrentUser, session: SessionDep) -> UnreadResponse:
    """The bell was opened. The badge clears; the notes stay new until read."""
    bell = NotificationService(session)
    await bell.mark_seen(user.id)
    return UnreadResponse(unread=await bell.unread_count(user.id), unseen=0)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def read(
    notification_id: UUID, user: CurrentUser, session: SessionDep
) -> NotificationResponse:
    return NotificationResponse.of(
        await NotificationService(session).mark_read(user.id, notification_id)
    )


@router.post("/read-all", response_model=UnreadResponse)
async def read_all(user: CurrentUser, session: SessionDep) -> UnreadResponse:
    await NotificationService(session).mark_all_read(user.id)
    return UnreadResponse(unread=0)


@router.get("/stream")
async def stream(user: StreamUser) -> EventSourceResponse:
    """Pushes for this user until the tab closes. Holds no database
    connection — `StreamUser` returned its session before the first event."""
    return EventSourceResponse(_events(user.id), ping=20)


async def _events(user_id: UUID) -> AsyncIterator[dict[str, str]]:
    yield {"event": "ready", "data": "{}"}
    async for message in hub.subscribe(user_id):
        yield {"event": str(message.get("topic", "changed")), "data": json.dumps(message)}
