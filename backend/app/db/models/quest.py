"""The Daily Quest (§28.3.4): one short quest a day for each student, and
what they remember of each skill — the box it is in and when it is due again.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk


class DailyQuest(Base):
    __tablename__ = "daily_quests"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # The student's own day, in the school's time zone.
    day: Mapped[date] = mapped_column(Date, nullable=False)
    # The quest itself: a practice set of questions picked from their work.
    set_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("learning_sets.id", ondelete="CASCADE"), nullable=False
    )
    review: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fresh: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (UniqueConstraint("student_id", "day", name="uq_daily_quest_a_day"),)


class SkillMemory(Base):
    __tablename__ = "skill_memory"

    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    skill: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Leitner box, 0 (found hard) … 5 (known well).
    box: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    due_on: Mapped[date] = mapped_column(Date, nullable=False)
    seen: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    right: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = updated_at()
