"""A picture found for one question or card, for the youngest children's
look — or the record that none fits (`picture` is null), so nobody looks
again (docs/features/045-question-pictures.md)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


class ItemPicture(Base):
    __tablename__ = "item_pictures"
    __table_args__ = (UniqueConstraint("set_id", "item_key", name="uq_item_pictures_item"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    set_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("learning_sets.id", ondelete="CASCADE"), nullable=False
    )
    # What the item shows, hashed: an edit that leaves it alone keeps its
    # picture, and one that changes it gets looked at again.
    item_key: Mapped[str] = mapped_column(String(64), nullable=False)
    # The search that was run; empty when the item is better without one.
    query: Mapped[str | None] = mapped_column(Text)
    picture: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = created_at()
