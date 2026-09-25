"""roles, and what a student's account carries

Every account gets a role; admins keep being admins because the role is
backfilled from is_admin before that column goes. Students sign in with a
username and have no email, teachers the reverse, so both become nullable
with a check that nobody has neither.

Revision ID: d0ea8d80adb9
Revises: 9e51797acc9c
Create Date: 2026-09-25 00:10:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d0ea8d80adb9"
down_revision: str | None = "9e51797acc9c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=16), server_default="teacher", nullable=False),
    )
    op.execute("UPDATE users SET role = 'admin' WHERE is_admin")
    op.drop_column("users", "is_admin")
    op.create_check_constraint(
        "ck_users_role", "users", "role IN ('admin', 'teacher', 'student')"
    )

    op.alter_column("users", "username", existing_type=sa.String(length=64), nullable=True)
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=True)
    op.create_check_constraint(
        "ck_users_identifier", "users", "username IS NOT NULL OR email IS NOT NULL"
    )

    op.add_column("users", sa.Column("grade_level", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("buddy", sa.String(length=24), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column("users", sa.Column("onboarded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_role", "users", ["role"])


def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    for column in ("last_seen_at", "onboarded_at", "preferences", "buddy", "grade_level"):
        op.drop_column("users", column)

    op.drop_constraint("ck_users_identifier", "users", type_="check")
    # Rows from before roles always had both; a student row cannot go back, so the
    # downgrade refuses rather than inventing an address for a child.
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM users WHERE username IS NULL OR email IS NULL) "
        "THEN RAISE EXCEPTION 'accounts without a username or email cannot be downgraded'; "
        "END IF; END $$"
    )
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=False)
    op.alter_column("users", "username", existing_type=sa.String(length=64), nullable=False)

    op.drop_constraint("ck_users_role", "users", type_="check")
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.execute("UPDATE users SET is_admin = (role = 'admin')")
    op.drop_column("users", "role")
