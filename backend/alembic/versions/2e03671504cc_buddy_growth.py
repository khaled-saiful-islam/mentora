"""a buddy that grows as its student learns, and the buddies they have met

Revision ID: 2e03671504cc
Revises: b9e4c1a7d203
Create Date: 2026-10-13 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "2e03671504cc"
down_revision: str | None = "b9e4c1a7d203"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Every buddy starts as a newborn (§28.3.1, decided 2026-10-13): the
    # ledger starts empty for everyone, existing students too.
    op.create_table(
        "buddy_growth",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(24), nullable=False),
        sa.Column("source_id", sa.String(160), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.UniqueConstraint("student_id", "source", "source_id", name="uq_buddy_growth_once"),
        sa.CheckConstraint("points > 0", name="ck_buddy_growth_points"),
    )
    op.create_index("ix_buddy_growth_student", "buddy_growth", ["student_id", "created_at"])
    op.create_table(
        "buddy_progress",
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("seen_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("arrived_at", sa.DateTime(timezone=True)),
        sa.Column(
            "met", postgresql.ARRAY(sa.String(16)), nullable=False, server_default="{}"
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("buddy_progress")
    op.drop_index("ix_buddy_growth_student", table_name="buddy_growth")
    op.drop_table("buddy_growth")
