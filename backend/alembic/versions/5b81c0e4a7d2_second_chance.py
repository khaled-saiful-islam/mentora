"""second chance at your level: explanations and questions like it, kept per
question; each second try; and a test-mode switch on assignments

Revision ID: 5b81c0e4a7d2
Revises: 36637def55d8
Create Date: 2026-10-14 18:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "5b81c0e4a7d2"
down_revision: str | None = "36637def55d8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NOW = sa.text("clock_timestamp()")


def upgrade() -> None:
    op.add_column(
        "assignments",
        sa.Column("second_chance", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_table(
        "item_help",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("item_key", sa.String(64), nullable=False),
        sa.Column("grade", sa.String(32), nullable=False, server_default=""),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_NOW),
        sa.UniqueConstraint("item_key", "grade", "kind", name="uq_item_help_once"),
    )
    op.create_table(
        "second_chances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_id", sa.String(40), nullable=False),
        sa.Column("skill", sa.String(64), nullable=False, server_default="general"),
        sa.Column("question", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("choice", sa.Integer()),
        sa.Column("correct", sa.Boolean()),
        sa.Column("answered_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_NOW),
        sa.UniqueConstraint("attempt_id", "item_id", name="uq_second_chance_once"),
    )
    op.create_index("ix_second_chances_student", "second_chances", ["student_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_second_chances_student", table_name="second_chances")
    op.drop_table("second_chances")
    op.drop_table("item_help")
    op.drop_column("assignments", "second_chance")
