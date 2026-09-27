"""item pictures: a picture for each question or card, for Year 1–3

Revision ID: b3e7f9a1c254
Revises: a9d2e4b6c018
Create Date: 2026-09-27 18:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3e7f9a1c254"
down_revision: str | None = "a9d2e4b6c018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.drop_table("item_pictures")
