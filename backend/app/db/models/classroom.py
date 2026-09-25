"""Classes, and who is in them.

A teacher runs classes; a class has students (through memberships) and
groups (subsets of those students). A membership is never deleted when a
student leaves or is removed — its status changes, so results they earned in
the class survive them going.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk

MEMBERSHIP_STATUSES = ("pending", "approved", "rejected", "revoked", "left")


def _user_fk(ondelete: str = "CASCADE") -> Mapped[uuid.UUID]:
    return mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete=ondelete), nullable=False
    )


class Classroom(Base):
    """`classes` in the database; `Classroom` here, because `class` is taken."""

    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = uuid_pk()
    teacher_id: Mapped[uuid.UUID] = _user_fk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(80))
    grade_level: Mapped[str | None] = mapped_column(String(32))
    description: Mapped[str | None] = mapped_column(Text)
    # A colour key from the frontend's class palette, so a class looks the
    # same on every screen that shows it.
    theme: Mapped[str] = mapped_column(String(16), nullable=False, default="grape")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (Index("ix_classes_teacher", "teacher_id", "archived_at"),)


class ClassInvite(Base):
    """The one live way into a class: a link token and a short typed code.

    Rotating replaces both, which is how a teacher shuts a door that leaked.
    """

    __tablename__ = "class_invites"

    id: Mapped[uuid.UUID] = uuid_pk()
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    code: Mapped[str] = mapped_column(String(8), nullable=False, unique=True)
    enabled: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ClassMembership(Base):
    __tablename__ = "class_memberships"

    id: Mapped[uuid.UUID] = uuid_pk()
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = _user_fk()
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    __table_args__ = (
        UniqueConstraint("class_id", "student_id", name="uq_class_memberships_class_student"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'revoked', 'left')",
            name="ck_class_memberships_status",
        ),
        Index("ix_class_memberships_class_status", "class_id", "status"),
        Index("ix_class_memberships_student_status", "student_id", "status"),
    )


class ClassGroup(Base):
    __tablename__ = "class_groups"

    id: Mapped[uuid.UUID] = uuid_pk()
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    colour: Mapped[str] = mapped_column(String(16), nullable=False, default="sky")
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (Index("ix_class_groups_class", "class_id"),)


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("class_groups.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    added_at: Mapped[datetime] = created_at()

    __table_args__ = (Index("ix_group_members_student", "student_id"),)
