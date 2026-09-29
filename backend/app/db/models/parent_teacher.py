"""A parent and their child's teacher, writing to each other about the child
(`docs/features/048-parent-teacher-messages.md`).

One thread per parent, teacher and child: a parent with two children in the
same teacher's class has two threads, so each stays about one child. Each
side keeps its own "read up to", which is all an unread count needs.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, uuid_pk


def _user() -> Mapped[uuid.UUID]:
    return mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


class ParentTeacherThread(Base):
    __tablename__ = "parent_teacher_threads"

    id: Mapped[uuid.UUID] = uuid_pk()
    parent_id: Mapped[uuid.UUID] = _user()
    teacher_id: Mapped[uuid.UUID] = _user()
    student_id: Mapped[uuid.UUID] = _user()
    parent_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    teacher_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Null until the first message: an opened thread with nothing in it.
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("parent_id", "teacher_id", "student_id", name="uq_pt_thread_trio"),
        Index("ix_pt_threads_teacher", "teacher_id"),
    )


class ParentTeacherMessage(Base):
    __tablename__ = "parent_teacher_messages"

    id: Mapped[uuid.UUID] = uuid_pk()
    thread_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("parent_teacher_threads.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID] = _user()
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (Index("ix_pt_messages_thread_created", "thread_id", "created_at"),)
