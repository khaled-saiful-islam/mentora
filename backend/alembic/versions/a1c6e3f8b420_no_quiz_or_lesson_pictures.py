"""no quiz or lesson pictures: pictures are for study guides only

Drops the pictures beside Year 1–3 questions and cards (`item_pictures`) and
the picture a live lesson's part showed (`live_segments.image`).

Revision ID: a1c6e3f8b420
Revises: f4c9a2d7e815
Create Date: 2026-09-28 18:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1c6e3f8b420"
down_revision: str | None = "f4c9a2d7e815"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("item_pictures")
    op.drop_column("live_segments", "image")


def downgrade() -> None:
    op.add_column("live_segments", sa.Column("image", postgresql.JSONB(), nullable=True))
    op.create_table(
        "item_pictures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "set_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("learning_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_key", sa.String(64), nullable=False),
        sa.Column("query", sa.Text(), nullable=True),
        sa.Column("picture", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.UniqueConstraint("set_id", "item_key", name="uq_item_pictures_item"),
    )
