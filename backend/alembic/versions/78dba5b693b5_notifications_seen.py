"""notifications remember being seen

The badge now counts notes not yet seen in the open bell, so opening it
clears the badge while each note stays new until it is read. Notes already
read count as seen.

Revision ID: 78dba5b693b5
Revises: 14b0daa114e5
Create Date: 2026-09-26 04:56:08.419643
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "78dba5b693b5"
down_revision: str | None = "14b0daa114e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE notifications SET seen_at = read_at WHERE read_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column("notifications", "seen_at")
