"""live for a class: a live lesson's group is optional — none is the whole class

Revision ID: d7a2c4e9f311
Revises: c5d1e8f3a907
Create Date: 2026-09-28 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "d7a2c4e9f311"
down_revision: str | None = "c5d1e8f3a907"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("live_sessions", "group_id", nullable=True)


def downgrade() -> None:
    # A whole-class lesson has no group to go back to.
    op.execute("DELETE FROM live_sessions WHERE group_id IS NULL")
    op.alter_column("live_sessions", "group_id", nullable=False)
