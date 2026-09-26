"""live tutoring sessions

A teacher's live lesson for one group: its setup, its reference files as text,
its parts (segments said as beats), and reusable setups (templates). The
tables for who joined, raised hands, the transcript and check-ins arrive with
the live session itself, in the next revision. All new, so nothing to backfill.

Revision ID: 3537259a196c
Revises: 7c2d9e14ab60
Create Date: 2026-09-26 01:14:54.737259
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "3537259a196c"
down_revision: str | None = "7c2d9e14ab60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "live_session_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_live_session_templates_teacher", "live_session_templates", ["teacher_id"], unique=False
    )
    op.create_table(
        "live_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("template_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("failure", sa.Text(), nullable=True),
        sa.Column(
            "position",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reminders_sent",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("quiz_set_id", sa.UUID(), nullable=True),
        sa.Column("assignment_id", sa.UUID(), nullable=True),
        sa.Column("flagged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["class_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["quiz_set_id"], ["learning_sets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["template_id"], ["live_session_templates.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_live_sessions_due", "live_sessions", ["status", "scheduled_at"], unique=False
    )
    op.create_index(
        "ix_live_sessions_group", "live_sessions", ["group_id", "scheduled_at"], unique=False
    )
    op.create_index(
        "ix_live_sessions_teacher", "live_sessions", ["teacher_id", "created_at"], unique=False
    )
    op.create_table(
        "live_segments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("subtopic", sa.String(length=160), nullable=False),
        sa.Column("skill", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("beats", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("key_points", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("checkin", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("target_seconds", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_id"], ["live_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "position", name="uq_live_segments_position"),
    )
    op.create_table(
        "live_session_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("media_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_id"], ["live_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_live_session_documents_session", "live_session_documents", ["session_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_live_session_documents_session", table_name="live_session_documents")
    op.drop_table("live_session_documents")
    op.drop_table("live_segments")
    op.drop_index("ix_live_sessions_teacher", table_name="live_sessions")
    op.drop_index("ix_live_sessions_group", table_name="live_sessions")
    op.drop_index("ix_live_sessions_due", table_name="live_sessions")
    op.drop_table("live_sessions")
    op.drop_index("ix_live_session_templates_teacher", table_name="live_session_templates")
    op.drop_table("live_session_templates")
