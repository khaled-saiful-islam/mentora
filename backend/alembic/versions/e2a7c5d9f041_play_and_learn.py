"""play and learn: a set's level and its maker's choices; an attempt's points

Revision ID: e2a7c5d9f041
Revises: d6b1e4a9c273
Create Date: 2026-10-08 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "e2a7c5d9f041"
down_revision: str | None = "d6b1e4a9c273"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # How far into the topic the learner is (§23). Null: not chosen, as for
    # every set made before.
    op.add_column("learning_sets", sa.Column("level", sa.String(16)))
    op.create_check_constraint(
        "ck_learning_sets_level",
        "learning_sets",
        "level IS NULL OR level IN ('beginner', 'intermediate', 'advanced')",
    )
    # What the maker chose that only the set's kind understands — a game's
    # story, style and world — kept so a failed build can be retried as asked.
    op.add_column(
        "learning_sets",
        sa.Column(
            "choices",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    # A game's points, worked out on the server when it is finished. Null for
    # every other kind, and for games finished before points existed.
    op.add_column("attempts", sa.Column("points", sa.Integer()))


def downgrade() -> None:
    op.drop_column("attempts", "points")
    op.drop_column("learning_sets", "choices")
    op.drop_constraint("ck_learning_sets_level", "learning_sets", type_="check")
    op.drop_column("learning_sets", "level")
