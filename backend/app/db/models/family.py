"""A child's family: the parents linked to them, and the invitation that links
them.

The child starts every link: their invitation is a link to share and a short
code to type, like a class's. Only the parent can end a link, so a child
cannot quietly cut their parent off (§20.0).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk


def _user() -> Mapped[uuid.UUID]:
    return mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


class FamilyLink(Base):
    __tablename__ = "family_links"

    id: Mapped[uuid.UUID] = uuid_pk()
    parent_id: Mapped[uuid.UUID] = _user()
    student_id: Mapped[uuid.UUID] = _user()
    # What the child calls them: "Mum", "Dad", "Guardian", or the parent's own.
    label: Mapped[str] = mapped_column(String(24), nullable=False, default="Parent")
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (
        UniqueConstraint("parent_id", "student_id", name="uq_family_link_pair"),
        Index("ix_family_links_student", "student_id"),
    )


class FamilyInvite(Base):
    """One per child. Made anew when rotated; dead once expired or off."""

    __tablename__ = "family_invites"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    code: Mapped[str] = mapped_column(String(8), nullable=False, unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = created_at()


class FamilyShare(Base):
    """A parent's set, shared with their child (§20.4). One per set and
    child: sharing again moves it to the set's latest version and due date."""

    __tablename__ = "family_shares"

    id: Mapped[uuid.UUID] = uuid_pk()
    parent_id: Mapped[uuid.UUID] = _user()
    student_id: Mapped[uuid.UUID] = _user()
    set_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("learning_sets.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (
        UniqueConstraint("set_id", "student_id", name="uq_family_share_set_student"),
        Index("ix_family_shares_student", "student_id", "created_at"),
    )
