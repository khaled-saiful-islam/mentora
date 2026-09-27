"""material photos: a thumbnail for a photo kept as a material

Revision ID: a9d2e4b6c018
Revises: f1c9d3e2a846
Create Date: 2026-09-27 16:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a9d2e4b6c018"
down_revision: str | None = "f1c9d3e2a846"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("materials", sa.Column("thumbnail", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("materials", "thumbnail")
