"""my materials: a teacher's own files, and the sets made from them

Revision ID: d7f3b1c8e924
Revises: c5e2a9d4f713
Create Date: 2026-09-26 16:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d7f3b1c8e924"
down_revision: str | None = "c5e2a9d4f713"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOW = sa.text("clock_timestamp()")


def upgrade() -> None:
    op.create_table(
        "materials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("media_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("unit", sa.String(16), nullable=False),
        sa.Column("unit_count", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_materials_owner", "materials", ["owner_id", "updated_at"])
    op.add_column(
        "learning_sets",
        sa.Column(
            "material_ids",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "learning_sets",
        sa.Column("web_sources", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("learning_sets", "web_sources")
    op.drop_column("learning_sets", "material_ids")
    op.drop_index("ix_materials_owner", table_name="materials")
    op.drop_table("materials")
