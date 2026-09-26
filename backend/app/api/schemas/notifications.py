from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.db.models.notification import Notification


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    payload: dict[str, Any]
    count: int
    read: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def of(cls, note: Notification) -> NotificationResponse:
        return cls(
            id=note.id,
            type=note.type,
            payload=note.payload,
            count=note.count,
            read=note.read_at is not None,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )


class NotificationPageResponse(BaseModel):
    items: list[NotificationResponse]
    next_cursor: str | None
    unread: int
    unseen: int = 0


class UnreadResponse(BaseModel):
    unread: int
    unseen: int = 0
