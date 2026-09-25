"""learning set versions carry extras

A study guide has parts that are not items — a big question to open on, an
introduction, a summary, a challenge. They are versioned with the items, so a
guide already shared keeps the ones it was shared with. Every existing
version gets an empty object: quizzes and flashcards have none.

Revision ID: 7c2d9e14ab60
Revises: 5b412374bc49
Create Date: 2026-09-25 08:10:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "7c2d9e14ab60"
down_revision: str | None = "5b412374bc49"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "learning_set_versions",
        sa.Column(
            "extras",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("learning_set_versions", "extras")
