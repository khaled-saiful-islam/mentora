"""Learning sets, the versions they go through, and where they are shared.

A version referenced by an assignment is never edited: a teacher changing a
question after sharing forks a new version, so what a student answered is
always the question they were shown.
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
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk


def _fk(target: str, ondelete: str = "CASCADE", nullable: bool = False) -> Mapped[Any]:
    return mapped_column(
        PGUUID(as_uuid=True), ForeignKey(target, ondelete=ondelete), nullable=nullable
    )


class LearningSet(Base):
    __tablename__ = "learning_sets"

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_id: Mapped[uuid.UUID] = _fk("users.id")
    # "assign": made to be shared with a class. "practice": a student's own.
    purpose: Mapped[str] = mapped_column(String(16), nullable=False, default="assign")
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(80))
    topic: Mapped[str] = mapped_column(String(200), nullable=False)
    grade_level: Mapped[str | None] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    # generating | ready | failed | refused
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="generating")
    failure: Mapped[str | None] = mapped_column(Text)
    requested_count: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (
        CheckConstraint("purpose IN ('assign', 'practice')", name="ck_learning_sets_purpose"),
        CheckConstraint(
            "status IN ('generating', 'ready', 'failed', 'refused')",
            name="ck_learning_sets_status",
        ),
        Index("ix_learning_sets_owner", "owner_id", "archived_at", "updated_at"),
    )


class LearningSetVersion(Base):
    __tablename__ = "learning_set_versions"

    id: Mapped[uuid.UUID] = uuid_pk()
    set_id: Mapped[uuid.UUID] = _fk("learning_sets.id")
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    skills: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    sources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    # What the set has besides its items: a study guide's big question,
    # introduction, summary and challenge. Empty for kinds without any.
    extras: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    grounded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    model: Mapped[str | None] = mapped_column(String(120))
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    build_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (UniqueConstraint("set_id", "version", name="uq_learning_set_version"),)


class Assignment(Base):
    """A version of a set, shared with a class — or some of its groups."""

    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = uuid_pk()
    set_id: Mapped[uuid.UUID] = _fk("learning_sets.id")
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    class_id: Mapped[uuid.UUID] = _fk("classes.id")
    teacher_id: Mapped[uuid.UUID] = _fk("users.id")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    # "instant": right or wrong after each answer. "end": all at the end.
    feedback_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="instant")
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allow_retakes: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_attempts: Mapped[int | None] = mapped_column(Integer)
    leaderboard_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # When the podium badges went out. Set once, when the leaderboard is final
    # (closed, or past due), so a medal is never handed out twice or taken back.
    ranks_awarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        CheckConstraint("feedback_mode IN ('instant', 'end')", name="ck_assignments_feedback"),
        Index("ix_assignments_class", "class_id", "created_at"),
        Index("ix_assignments_set", "set_id"),
    )


class AssignmentGroup(Base):
    """No rows: the whole class. Rows: only these groups."""

    __tablename__ = "assignment_groups"

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("class_groups.id", ondelete="CASCADE"), primary_key=True
    )
