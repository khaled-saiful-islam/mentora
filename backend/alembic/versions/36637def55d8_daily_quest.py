"""the daily quest, and what each student remembers of each skill

Revision ID: 36637def55d8
Revises: 10760171ed1d
Create Date: 2026-10-14 14:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "36637def55d8"
down_revision: str | None = "10760171ed1d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "daily_quests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column(
            "set_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("learning_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("review", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fresh", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("done_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.UniqueConstraint("student_id", "day", name="uq_daily_quest_a_day"),
    )
    op.create_index("ix_daily_quests_set", "daily_quests", ["set_id"])
    op.create_table(
        "skill_memory",
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("skill", sa.String(64), primary_key=True),
        sa.Column("box", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("seen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("right", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("skill_memory")
    op.drop_index("ix_daily_quests_set", table_name="daily_quests")
    op.drop_table("daily_quests")
