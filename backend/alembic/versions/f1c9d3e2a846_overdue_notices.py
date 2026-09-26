"""past-due alerts: one per piece of work, due date and child

Revision ID: f1c9d3e2a846
Revises: e8a4c2f1b735
Create Date: 2026-09-27 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f1c9d3e2a846"
down_revision: str | None = "e8a4c2f1b735"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "overdue_notices",
        sa.Column("work_key", sa.String(96), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("overdue_notices")
