"""parents: the role, and the links a child's invitation makes

Revision ID: c5e2a9d4f713
Revises: b3d8f1a6c472
Create Date: 2026-09-26 15:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c5e2a9d4f713"
down_revision: str | None = "b3d8f1a6c472"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID(as_uuid=True)
NOW = sa.text("clock_timestamp()")


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role", "users", "role IN ('admin', 'teacher', 'student', 'parent')"
    )
    op.create_table(
        "family_links",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("parent_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "student_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("label", sa.String(24), nullable=False, server_default="Parent"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.UniqueConstraint("parent_id", "student_id", name="uq_family_link_pair"),
    )
    op.create_index("ix_family_links_student", "family_links", ["student_id"])
    op.create_table(
        "family_invites",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "student_id",
            UUID,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("code", sa.String(8), nullable=False, unique=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )


def downgrade() -> None:
    op.drop_table("family_invites")
    op.drop_index("ix_family_links_student", table_name="family_links")
    op.drop_table("family_links")
    op.execute("DELETE FROM users WHERE role = 'parent'")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint("ck_users_role", "users", "role IN ('admin', 'teacher', 'student')")
