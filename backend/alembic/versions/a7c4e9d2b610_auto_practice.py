"""practice made for a student from their weak spots

After a shared quiz or deck, the skills a student found hard are practised
in a set made just for them. One row per student per assignment keeps it to
one, and records what it practises.

Revision ID: a7c4e9d2b610
Revises: 78dba5b693b5
Create Date: 2026-09-26 06:20:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a7c4e9d2b610"
down_revision: str | None = "78dba5b693b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "auto_practice",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assignment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "set_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("learning_sets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "skills", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="making"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.UniqueConstraint("student_id", "assignment_id", name="uq_auto_practice_assignment"),
        sa.CheckConstraint(
            "status IN ('making', 'ready', 'failed')", name="ck_auto_practice_status"
        ),
    )
    op.create_index("ix_auto_practice_student", "auto_practice", ["student_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_auto_practice_student", table_name="auto_practice")
    op.drop_table("auto_practice")
