"""Managing accounts, as an administrator.

Two rules shape this and both exist to stop an administrator locking everyone
out of their own deployment:

- The last active administrator cannot be demoted or disabled.
- Nobody can disable or demote themselves.

Neither is paranoia. A single-admin install is the normal case for this
template, and an admin who removes their own access has no way back in short of
a database console.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.grades import is_grade
from app.core.roles import Role, parse_role
from app.core.security import hash_password
from app.db.models.user import User
from app.services.auth_service import (
    normalise_email,
    normalise_username,
    validate_password,
)
from app.services.quota import TokenQuota, Usage

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ManagedUser:
    """A user plus what they have spent, which is the pair an admin needs."""

    user: User
    usage: Usage


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_users(self) -> list[ManagedUser]:
        """Every account, newest first, each with its 24-hour usage."""
        found = (
            await self._session.execute(select(User).order_by(User.created_at.desc()))
        ).scalars().all()

        quota = TokenQuota(self._session)
        return [
            ManagedUser(user=user, usage=await quota.usage(user.id, user.daily_token_limit))
            for user in found
        ]

    async def create(
        self,
        *,
        password: str,
        username: str | None = None,
        email: str | None = None,
        display_name: str | None = None,
        role: str = Role.TEACHER.value,
        grade_level: str | None = None,
        daily_token_limit: int | None = None,
    ) -> User:
        """The same rules signup applies, so an admin cannot make an account
        that could never have been made the ordinary way."""
        parsed = _account_role(role)
        username = normalise_username(username) if username else None
        email = normalise_email(email) if email else None
        _require_identifier(parsed, username=username, email=email, grade_level=grade_level)
        validate_password(password)
        _validate_limit(daily_token_limit)
        await self._refuse_duplicates(username=username, email=email)

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            display_name=(display_name or "").strip() or None,
            role=parsed.value,
            grade_level=grade_level if parsed is Role.STUDENT else None,
            preferences={},
            is_active=True,
            daily_token_limit=daily_token_limit,
        )
        self._session.add(user)
        await self._session.flush()
        logger.info("admin created %s %s", parsed.value, user.sign_in_name)
        return user

    async def _refuse_duplicates(self, *, username: str | None, email: str | None) -> None:
        if username and await self._find_by(User.username, username):
            raise ConflictError("That username is taken.")
        if email and await self._find_by(User.email, email):
            raise ConflictError("That email is already registered.")

    async def update(
        self,
        user_id: UUID,
        *,
        acting_admin_id: UUID,
        is_active: bool | None = None,
        is_admin: bool | None = None,
        daily_token_limit: int | None = None,
        clear_limit: bool = False,
        display_name: str | None = None,
        password: str | None = None,
    ) -> User:
        user = await self._session.get(User, user_id)
        if user is None:
            raise NotFoundError("No such user.")

        if is_active is False:
            await self._refuse_self_lockout(user, acting_admin_id, "disable")
        if is_admin is False:
            await self._refuse_self_lockout(user, acting_admin_id, "remove admin from")
        if is_admin and user.is_student:
            raise ValidationError("A student account cannot be made an administrator.")

        if is_active is not None:
            user.is_active = is_active
        if is_admin is not None:
            user.is_admin = is_admin
        if display_name is not None:
            user.display_name = display_name.strip() or None
        if clear_limit:
            user.daily_token_limit = None
        elif daily_token_limit is not None:
            _validate_limit(daily_token_limit)
            user.daily_token_limit = daily_token_limit
        if password is not None:
            validate_password(password)
            user.password_hash = hash_password(password)

        await self._session.flush()
        logger.info("admin updated user %s", user.sign_in_name)
        return user

    async def _refuse_self_lockout(self, user: User, acting_admin_id: UUID, verb: str) -> None:
        if user.id == acting_admin_id:
            raise ValidationError(f"You cannot {verb} your own account.")
        if user.is_admin and await self._active_admin_count() <= 1:
            raise ValidationError(
                f"You cannot {verb} the last administrator — "
                "there would be no way back into this deployment."
            )

    async def _active_admin_count(self) -> int:
        return int(
            await self._session.scalar(
                select(func.count())
                .select_from(User)
                .where(User.is_admin.is_(True), User.is_active.is_(True))
            )
            or 0
        )

    async def _find_by(self, column, value: str) -> User | None:
        return (
            await self._session.execute(select(User).where(column == value))
        ).scalars().first()


def _account_role(role: str) -> Role:
    parsed = parse_role(role)
    if parsed is None:
        raise ValidationError("Role must be admin, teacher or student.")
    return parsed


def _require_identifier(
    role: Role, *, username: str | None, email: str | None, grade_level: str | None
) -> None:
    """Students sign in with a username and belong to a grade; everyone else
    signs in with an email."""
    if role is Role.STUDENT:
        if not username:
            raise ValidationError("A student account needs a username.")
        if not grade_level or not is_grade(grade_level):
            raise ValidationError("A student account needs a grade from the list.")
    elif not email:
        raise ValidationError("A teacher or admin account needs an email.")


def _validate_limit(limit: int | None) -> None:
    if limit is not None and limit < 0:
        raise ValidationError("A token limit cannot be negative.")
