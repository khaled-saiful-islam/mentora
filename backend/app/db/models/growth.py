"""A buddy that grows as its student learns (§28.3.1).

`buddy_growth` is a ledger: one row per learning moment that earned growth,
unique on what earned it, so a retake, a replayed event or a second tab never
counts twice. The stage is worked out from the sum, never stored.
`buddy_progress` remembers what the student has already been shown — the
arrival of their baby buddy, and the growth celebrated so far — and the
buddies they have met: a new one is earned with badges (§28.3.1).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk


class BuddyGrowth(Base):
    __tablename__ = "buddy_growth"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # What kind of moment: finished, stars, day, badge, skill.
    source: Mapped[str] = mapped_column(String(24), nullable=False)
    # Which one: a set and a day, a badge and its scope, a skill.
    source_id: Mapped[str] = mapped_column(String(160), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("student_id", "source", "source_id", name="uq_buddy_growth_once"),
        CheckConstraint("points > 0", name="ck_buddy_growth_points"),
        Index("ix_buddy_growth_student", "student_id", "created_at"),
    )


class BuddyProgress(Base):
    __tablename__ = "buddy_progress"

    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # The growth already celebrated: anything above it is new to the student.
    seen_points: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # When the student met their baby buddy; null until they have.
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The buddies they have met, in order: theirs to switch between.
    met: Mapped[list[str]] = mapped_column(
        ARRAY(String(16)), nullable=False, server_default="{}"
    )
    updated_at: Mapped[datetime] = updated_at()
