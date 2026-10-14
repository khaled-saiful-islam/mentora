"""What a skill means, for a parent, and something to do at home (§28.3.3).

Written once for each skill, year and language, and kept: every parent of a
Year 4 child stuck on "equivalent fractions" reads the same careful words,
and the model is asked once.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


class SkillHelp(Base):
    __tablename__ = "skill_help"

    id: Mapped[uuid.UUID] = uuid_pk()
    subject: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    # A school year, or "" when the child's is not known.
    grade: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    meaning: Mapped[str] = mapped_column(Text, nullable=False)
    example: Mapped[str] = mapped_column(Text, nullable=False)
    # {"title", "minutes", "needs": [...], "steps": [...]}
    activity: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("subject", "slug", "grade", "language", name="uq_skill_help_once"),
    )
