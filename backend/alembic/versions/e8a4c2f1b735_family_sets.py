"""family sets: material a parent makes, and its shares with their child

Revision ID: e8a4c2f1b735
Revises: d7f3b1c8e924
Create Date: 2026-09-26 23:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "e8a4c2f1b735"
down_revision: str | None = "d7f3b1c8e924"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOW = sa.text("clock_timestamp()")


def _fk(table: str) -> sa.ForeignKey:
    return sa.ForeignKey(f"{table}.id", ondelete="CASCADE")


def upgrade() -> None:
    op.drop_constraint("ck_learning_sets_purpose", "learning_sets", type_="check")
    op.create_check_constraint(
        "ck_learning_sets_purpose", "learning_sets", "purpose IN ('assign', 'practice', 'family')"
    )
    op.create_table(
        "family_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), _fk("users"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), _fk("users"), nullable=False),
        sa.Column("set_id", postgresql.UUID(as_uuid=True), _fk("learning_sets"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.UniqueConstraint("set_id", "student_id", name="uq_family_share_set_student"),
    )
    op.create_index("ix_family_shares_student", "family_shares", ["student_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_family_shares_student", table_name="family_shares")
    op.drop_table("family_shares")
    op.execute("DELETE FROM learning_sets WHERE purpose = 'family'")
    op.drop_constraint("ck_learning_sets_purpose", "learning_sets", type_="check")
    op.create_check_constraint(
        "ck_learning_sets_purpose", "learning_sets", "purpose IN ('assign', 'practice')"
    )
