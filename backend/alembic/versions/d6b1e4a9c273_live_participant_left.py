"""live participant left: when a student chose to leave a live lesson

Revision ID: d6b1e4a9c273
Revises: c4f7a9d2e615
Create Date: 2026-09-30 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d6b1e4a9c273"
down_revision: str | None = "c4f7a9d2e615"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Null while they are in the lesson (or never left); cleared when they
    # come back in.
    op.add_column("live_participants", sa.Column("left_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("live_participants", "left_at")
