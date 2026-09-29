"""tompok for bolt: Bolt the robot is gone; whoever had Bolt now has Tompok the cat

Revision ID: b8e2f4a6c931
Revises: a1c6e3f8b420
Create Date: 2026-09-28 19:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "b8e2f4a6c931"
down_revision: str | None = "a1c6e3f8b420"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE users SET buddy = 'tompok' WHERE buddy = 'bolt'")


def downgrade() -> None:
    op.execute("UPDATE users SET buddy = 'bolt' WHERE buddy = 'tompok'")
