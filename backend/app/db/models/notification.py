"""Something a person should know about, waiting for them in the bell.

`group_key` lets repeated news collapse into one row — five students finishing
the same quiz is one notification that says five, not five that each say one.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    group_key: Mapped[str | None] = mapped_column(String(160))
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Seen in the open bell: the badge counts what has not been seen yet, so
    # opening the bell clears it, while each note stays new until it is read.
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "read_at", "updated_at"),
        Index("ix_notifications_group", "user_id", "group_key"),
    )
