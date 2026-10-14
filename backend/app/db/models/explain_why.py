"""Explain why (§28.3.5, Form 1–5): after a right answer, sometimes "Tell me
why" — the student's reasoning in their own words, and what the model made
of it. One per question in an attempt; counted for the daily cap."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


class WhyGiven(Base):
    __tablename__ = "why_given"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[str] = mapped_column(String(40), nullable=False)
    # What the student said or typed, as screened.
    words: Mapped[str] = mapped_column(Text, nullable=False)
    # "spot_on", "nearly" or "not_yet".
    verdict: Mapped[str] = mapped_column(String(16), nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("attempt_id", "item_id", name="uq_why_given_once"),
        Index("ix_why_given_student", "student_id", "created_at"),
    )
