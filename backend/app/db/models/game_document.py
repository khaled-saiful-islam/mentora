"""A game's code (§24): the HTML document a model wrote for a game set, as it
passed its tests. Each *Change it* adds a revision; the newest one is served.

Kept out of `learning_set_versions.extras`, which every read of a set loads:
a game is tens of kilobytes, needed only when somebody plays it.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


class GameDocument(Base):
    __tablename__ = "game_documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    set_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("learning_sets.id", ondelete="CASCADE"), nullable=False
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    html: Mapped[str] = mapped_column(Text, nullable=False)
    # The design, every round of testing, the fixes it took — and, for a
    # change, what was asked.
    report: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    instruction: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(120))
    # Every call that made it — counted against its maker's daily tokens.
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    build_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("set_id", "revision", name="uq_game_document_revision"),
        Index("ix_game_documents_set", "set_id", "revision"),
    )
