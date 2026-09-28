"""resort outside coverage: forget "fits no topic" so it is sorted again

The first sorting prompt filed broad things ("Living Things", "Scientific
Skills") under no topic, and such a link was kept for good. Forgetting them
lets the next look at the map sort them again, with the clearer prompt.

Revision ID: e2b8f5a1c603
Revises: d7a2c4e9f311
Create Date: 2026-09-28 14:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "e2b8f5a1c603"
down_revision: str | None = "d7a2c4e9f311"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM coverage_links WHERE topic_id IS NULL")


def downgrade() -> None:
    # Nothing to put back: they are sorted again when the map is next opened.
    pass
