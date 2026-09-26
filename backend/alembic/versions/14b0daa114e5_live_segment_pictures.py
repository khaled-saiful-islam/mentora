"""live segment pictures

Each part of a live lesson can carry a picture shown on screen while it is
taught. Nullable: parts written before this simply have none.

Revision ID: 14b0daa114e5
Revises: 301aae208835
Create Date: 2026-09-26 03:07:56.197171
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "14b0daa114e5"
down_revision: str | None = "301aae208835"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "live_segments", sa.Column("image", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("live_segments", "image")
