"""Second chance, at your level (§28.3.7).

`item_help` keeps what was written for one question: its explanation at each
reading level, and a question like it when one had to be made. Keyed by the
question itself, not where it sits, so a question copied into a Daily Quest
or a new version of its set is explained once.

`second_chances` is one student's second try at a question they got wrong:
the question like it they were given, and how they did. The first answer and
the attempt's score are never touched.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


class ItemHelp(Base):
    __tablename__ = "item_help"

    id: Mapped[uuid.UUID] = uuid_pk()
    # A hash of the question's words, options and answer (`item_key`).
    item_key: Mapped[str] = mapped_column(String(64), nullable=False)
    # The year it was written for, or "" when not known.
    grade: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    # "simple", "core" or "stretch" for an explanation; "twin" for a question like it.
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (UniqueConstraint("item_key", "grade", "kind", name="uq_item_help_once"),)


class SecondChance(Base):
    __tablename__ = "second_chances"

    id: Mapped[uuid.UUID] = uuid_pk()
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # The question got wrong, in its attempt.
    item_id: Mapped[str] = mapped_column(String(40), nullable=False)
    skill: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    # The question like it: {"prompt", "options", "answer", "explanation", "from"}.
    question: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    choice: Mapped[int | None] = mapped_column(Integer)
    correct: Mapped[bool | None] = mapped_column(Boolean)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("attempt_id", "item_id", name="uq_second_chance_once"),
        Index("ix_second_chances_student", "student_id", "created_at"),
    )
