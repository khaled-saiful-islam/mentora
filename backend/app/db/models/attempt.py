"""A student's go at a set, what they answered, and the badges they earned.

An attempt is tied to a set *version*, so it is always marked against the
questions the student was shown. It belongs to an assignment when a teacher
shared the set, or to nothing when it is the student's own practice.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Null for practice: a student's own set, not shared by anyone.
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE")
    )
    set_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("learning_sets.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # in_progress | completed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="in_progress")
    # The order items are shown in, and each item's option order: fixed at the
    # start so a reload resumes exactly where the student was.
    plan: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_late: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime] = created_at()
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('in_progress', 'completed')", name="ck_attempts_status"),
        Index("ix_attempts_assignment", "assignment_id", "status", "percent"),
        Index("ix_attempts_student", "student_id", "completed_at"),
        Index("ix_attempts_set_student", "set_id", "student_id"),
    )


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id: Mapped[uuid.UUID] = uuid_pk()
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[str] = mapped_column(String(40), nullable=False)
    skill: Mapped[str] = mapped_column(String(64), nullable=False)
    # What was chosen, in the item's own terms (the original option index),
    # never in the shuffled order it was shown in.
    response: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )

    __table_args__ = (
        UniqueConstraint("attempt_id", "item_id", name="uq_attempt_answers_item"),
        Index("ix_attempt_answers_attempt", "attempt_id"),
    )


class StudentBadge(Base):
    __tablename__ = "student_badges"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    badge: Mapped[str] = mapped_column(String(40), nullable=False)
    # What it was earned for — an assignment id, or "" for a lifetime badge.
    # A string, not a nullable FK, so the unique key really is unique:
    # Postgres treats NULLs as all different.
    scope: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assignments.id", ondelete="SET NULL")
    )
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    awarded_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("student_id", "badge", "scope", name="uq_student_badges"),
        Index("ix_student_badges_student", "student_id", "awarded_at"),
    )
