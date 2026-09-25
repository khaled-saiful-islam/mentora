from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


class ModerationEvent(Base):
    """Something a safety check did: a message refused, a child offered help,
    personal details removed, an answer withdrawn, an injection neutralised, a
    topic refused.

    Kept so a person can review it, and so the checks can be judged after the
    fact: a rule that fires on every third message is wrong, and without a
    log the only evidence is people quietly switching it off.
    """

    __tablename__ = "moderation_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    # A child's record goes with the child: deleting the account deletes these.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL")
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL")
    )
    set_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("learning_sets.id", ondelete="SET NULL")
    )
    # held | support | redacted | retracted | injection | topic_refused
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    # user_input | model_output | web_search | document | generation
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    rule: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    screen: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    findings: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # What was said, truncated — enough for a reviewer to judge, no more.
    excerpt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'reviewed', 'dismissed')", name="ck_moderation_events_status"
        ),
        CheckConstraint("severity IN ('low', 'medium', 'high')", name="ck_moderation_severity"),
        Index("ix_moderation_events_queue", "status", "severity", "created_at"),
        Index("ix_moderation_events_user", "user_id", "created_at"),
        Index("ix_moderation_events_created", "created_at"),
    )
