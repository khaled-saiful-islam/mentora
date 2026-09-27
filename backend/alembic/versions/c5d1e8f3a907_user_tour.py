"""user tour: when someone finished or closed the first-visit tour

Revision ID: c5d1e8f3a907
Revises: b3e7f9a1c254
Create Date: 2026-09-27 20:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c5d1e8f3a907"
down_revision: str | None = "b3e7f9a1c254"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("toured_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "toured_at")
