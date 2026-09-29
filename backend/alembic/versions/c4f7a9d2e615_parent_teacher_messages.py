"""parent teacher messages: a parent and their child's teacher writing to each other

Revision ID: c4f7a9d2e615
Revises: b8e2f4a6c931
Create Date: 2026-09-29 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c4f7a9d2e615"
down_revision: str | None = "b8e2f4a6c931"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _user(name: str) -> sa.Column:
    return sa.Column(
        name,
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "parent_teacher_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _user("parent_id"),
        _user("teacher_id"),
        _user("student_id"),
        sa.Column("parent_read_at", sa.DateTime(timezone=True)),
        sa.Column("teacher_read_at", sa.DateTime(timezone=True)),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.clock_timestamp(),
        ),
        sa.UniqueConstraint("parent_id", "teacher_id", "student_id", name="uq_pt_thread_trio"),
    )
    op.create_index("ix_pt_threads_teacher", "parent_teacher_threads", ["teacher_id"])
    op.create_table(
        "parent_teacher_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "thread_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("parent_teacher_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        _user("author_id"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.clock_timestamp(),
        ),
    )
    op.create_index(
        "ix_pt_messages_thread_created", "parent_teacher_messages", ["thread_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_pt_messages_thread_created", table_name="parent_teacher_messages")
    op.drop_table("parent_teacher_messages")
    op.drop_index("ix_pt_threads_teacher", table_name="parent_teacher_threads")
    op.drop_table("parent_teacher_threads")
