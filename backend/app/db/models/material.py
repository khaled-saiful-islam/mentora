"""A teacher's own teaching material — a worksheet, a textbook chapter, their
notes — uploaded once and kept, so any quiz, deck, guide or live lesson can
be made from it (PLAN.md §21).

Kept as its text, like every other upload here: read once at upload, with
no bytes to store and nothing to re-parse later.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # "pages", "slides", "paragraphs" or "lines", and how many.
    unit: Mapped[str] = mapped_column(String(16), nullable=False)
    unit_count: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (Index("ix_materials_owner", "owner_id", "updated_at"),)
