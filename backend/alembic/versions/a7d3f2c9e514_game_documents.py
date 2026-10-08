"""play and learn, revised: the code of each simulation game

Revision ID: a7d3f2c9e514
Revises: e2a7c5d9f041
Create Date: 2026-10-08 15:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a7d3f2c9e514"
down_revision: str | None = "e2a7c5d9f041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A game set's HTML, as it passed its tests (§24). Each change a revision.
    op.create_table(
        "game_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "set_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("learning_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("html", sa.Text(), nullable=False),
        sa.Column(
            "report",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("instruction", sa.Text()),
        sa.Column("model", sa.String(120)),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("build_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.UniqueConstraint("set_id", "revision", name="uq_game_document_revision"),
    )
    op.create_index("ix_game_documents_set", "game_documents", ["set_id", "revision"])


def downgrade() -> None:
    op.drop_index("ix_game_documents_set", table_name="game_documents")
    op.drop_table("game_documents")
