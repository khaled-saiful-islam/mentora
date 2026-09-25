from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.elements import ColumnElement

from app.core.roles import Role
from app.db.base import Base, created_at, updated_at, uuid_pk


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'teacher', 'student')", name="ck_users_role"),
        # Students sign in with a username and have no email; teachers sign in
        # with an email and need no username. Nobody may have neither.
        CheckConstraint(
            "username IS NOT NULL OR email IS NOT NULL", name="ck_users_identifier"
        ),
    )

    id: Mapped[uuid_pk] = uuid_pk()

    # Citext would be tidier, but it needs an extension; lowercasing on the way
    # in keeps the unique index meaningful without one. Unique indexes allow
    # any number of NULLs, which is what lets both be optional.
    username: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    role: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=Role.TEACHER.value,
        server_default="teacher",
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # A student's school level, as a code from `app.core.grades`.
    grade_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # The companion a student picked. Other students see it on a leaderboard,
    # which is why it is a column and not buried in preferences.
    buddy: Mapped[str | None] = mapped_column(String(24), nullable=True)
    # Only what the user changed; defaults come from the role at read time, so
    # improving a default reaches everyone who never touched it.
    preferences: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Tokens this account may spend in any rolling 24 hours. NULL is unlimited,
    # which is the default — a template that throttles by surprise is worse
    # than one that does not throttle, and an admin who wants a cap sets one.
    daily_token_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    @hybrid_property
    def is_admin(self) -> bool:
        """Derived from the role, never stored.

        Kept because "is this an administrator?" is asked in a lot of places,
        and a second column that could disagree with `role` is the bug that
        takes a day to find.
        """
        return self.role == Role.ADMIN.value

    @is_admin.inplace.setter
    def _is_admin_setter(self, value: bool) -> None:
        if value:
            self.role = Role.ADMIN.value
        elif self.role == Role.ADMIN.value:
            # Demoting an admin makes a teacher; a student stays a student.
            self.role = Role.TEACHER.value

    @is_admin.inplace.expression
    @classmethod
    def _is_admin_expression(cls) -> ColumnElement[bool]:
        return cls.role == Role.ADMIN.value

    @property
    def is_student(self) -> bool:
        return self.role == Role.STUDENT.value

    @property
    def sign_in_name(self) -> str:
        """What the person types to sign in, for logs and admin screens."""
        return self.username or self.email or str(self.id)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.sign_in_name} {self.role}>"
