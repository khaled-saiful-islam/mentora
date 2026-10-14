"""explain why: a student's reasoning after a right answer, and the verdict

Revision ID: 8d2f61a0b4c3
Revises: 5b81c0e4a7d2
Create Date: 2026-10-14 20:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "8d2f61a0b4c3"
down_revision: str | None = "5b81c0e4a7d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "why_given",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_id", sa.String(40), nullable=False),
        sa.Column("words", sa.Text(), nullable=False),
        sa.Column("verdict", sa.String(16), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.UniqueConstraint("attempt_id", "item_id", name="uq_why_given_once"),
    )
    op.create_index("ix_why_given_student", "why_given", ["student_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_why_given_student", table_name="why_given")
    op.drop_table("why_given")
