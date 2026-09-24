"""drop the news cache

Mentora has no news strip, so the table that cached its headlines goes. The
revision that created it (9d5f12e0e5e4) stays: it also creates message_sources.

Revision ID: 9e51797acc9c
Revises: e8a3f61c2d95
Create Date: 2026-09-24 23:40:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "9e51797acc9c"
down_revision: str | None = "e8a3f61c2d95"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_news_cache_cache_key", table_name="news_cache")
    op.drop_table("news_cache")


def downgrade() -> None:
    op.create_table(
        "news_cache",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("cache_key", sa.String(length=200), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_news_cache_cache_key", "news_cache", ["cache_key"], unique=True)
