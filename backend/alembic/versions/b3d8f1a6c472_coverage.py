"""what a class covers: its syllabus, what was taught where, reports home

Revision ID: b3d8f1a6c472
Revises: a7c4e9d2b610
Create Date: 2026-09-26 06:40:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3d8f1a6c472"
down_revision: str | None = "a7c4e9d2b610"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID(as_uuid=True)
NOW = sa.text("clock_timestamp()")


def upgrade() -> None:
    op.create_table(
        "class_syllabi",
        sa.Column(
            "class_id", UUID, sa.ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "areas", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("made_by", sa.String(16), nullable=False, server_default="ai"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_table(
        "coverage_links",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "class_id", UUID, sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("item_id", UUID, nullable=False),
        sa.Column("topic_id", sa.String(16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.UniqueConstraint("class_id", "kind", "item_id", name="uq_coverage_link_item"),
        sa.CheckConstraint("kind IN ('assignment', 'live')", name="ck_coverage_link_kind"),
    )
    op.create_table(
        "progress_reports",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "class_id", UUID, sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("student_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column(
            "created_by", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_progress_reports_class", "progress_reports", ["class_id", "student_id"])


def downgrade() -> None:
    op.drop_index("ix_progress_reports_class", table_name="progress_reports")
    op.drop_table("progress_reports")
    op.drop_table("coverage_links")
    op.drop_table("class_syllabi")
