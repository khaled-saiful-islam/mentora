"""play and learn from mentora's own templates: no game code is kept

Revision ID: b9e4c1a7d203
Revises: a7d3f2c9e514
Create Date: 2026-10-09 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "b9e4c1a7d203"
down_revision: str | None = "a7d3f2c9e514"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A game is islands played in the app's own templates (§26): there is no
    # model-written code to keep.
    op.drop_index("ix_game_documents_set", table_name="game_documents")
    op.drop_table("game_documents")
    # Games made before have no rounds to play — the §23 challenges, the §24
    # missions — so they are archived rather than left to open on nothing.
    # Archived, not deleted: their results stay, and an admin can bring one back.
    op.execute(
        """
        UPDATE learning_sets s SET archived_at = clock_timestamp()
        WHERE s.kind = 'game' AND s.archived_at IS NULL AND EXISTS (
            SELECT 1 FROM learning_set_versions v
            WHERE v.set_id = s.id AND v.version = s.current_version
              AND jsonb_typeof(v.items) = 'array' AND jsonb_array_length(v.items) > 0
              AND NOT (v.items -> 0 ? 'play')
        )
        """
    )


def downgrade() -> None:
    # The archived games stay archived: which were archived here is not known.
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
            "report", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")
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
