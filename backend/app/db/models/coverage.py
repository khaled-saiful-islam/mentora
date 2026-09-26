"""What a class is meant to cover, what it has covered, and the read-only
reports a teacher sends home.

The syllabus is the class's plan for the year: areas, each with a few
topics, drafted by a model from the subject and grade and then the
teacher's to edit. Everything the class is taught — a shared quiz, a deck, a
study guide, a live lesson — is sorted onto one topic once and remembered,
so the matrix is cheap to draw and does not move under the teacher's feet.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk


def _fk(target: str, *, nullable: bool = False, ondelete: str = "CASCADE") -> Mapped[Any]:
    return mapped_column(
        PGUUID(as_uuid=True), ForeignKey(target, ondelete=ondelete), nullable=nullable
    )


class ClassSyllabus(Base):
    __tablename__ = "class_syllabi"

    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True
    )
    # [{"id": "a1", "title": ..., "topics": [{"id": "a1t1", "title": ...}]}]
    areas: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    # "ai" when drafted, "teacher" once they have edited it.
    made_by: Mapped[str] = mapped_column(String(16), nullable=False, default="ai")
    updated_at: Mapped[datetime] = updated_at()


class CoverageLink(Base):
    """One taught thing, sorted onto one topic of the syllabus — or onto none,
    when it falls outside it."""

    __tablename__ = "coverage_links"

    id: Mapped[uuid.UUID] = uuid_pk()
    class_id: Mapped[uuid.UUID] = _fk("classes.id")
    # "assignment" or "live".
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    topic_id: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("class_id", "kind", "item_id", name="uq_coverage_link_item"),
        CheckConstraint("kind IN ('assignment', 'live')", name="ck_coverage_link_kind"),
    )


class ProgressReport(Base):
    """A read-only link a teacher sends home: the class's coverage, or one
    student's progress. Revoking it answers exactly like a link that never
    existed."""

    __tablename__ = "progress_reports"

    id: Mapped[uuid.UUID] = uuid_pk()
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    class_id: Mapped[uuid.UUID] = _fk("classes.id")
    # Null: the whole class, with no names in it.
    student_id: Mapped[uuid.UUID | None] = _fk("users.id", nullable=True)
    created_by: Mapped[uuid.UUID] = _fk("users.id")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (Index("ix_progress_reports_class", "class_id", "student_id"),)
