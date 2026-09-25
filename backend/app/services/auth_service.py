"""Signup, login and profile updates.

No FastAPI import appears here, which is enforced by `tests/test_layering.py`.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.buddies import BUDDIES, is_buddy
from app.core.errors import AuthError, ConflictError, NotFoundError, ValidationError
from app.core.grades import is_grade
from app.core.roles import Role
from app.core.security import (
    MAX_PASSWORD_BYTES,
    MIN_PASSWORD_LENGTH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.models.user import User
from app.db.repositories.users import UserRepository
from app.services.preferences import merge_preferences

logger = logging.getLogger(__name__)

USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


MAX_NAME_LENGTH = 120
SUGGESTION_COUNT = 3


@dataclass(frozen=True, slots=True)
class AuthResult:
    user: User
    access_token: str


@dataclass(frozen=True, slots=True)
class UsernameStatus:
    available: bool
    reason: str | None = None
    suggestions: tuple[str, ...] = ()


def normalise_username(raw: str) -> str:
    username = raw.strip().lower()
    if not USERNAME_PATTERN.match(username):
        raise ValidationError(
            "Username must be 2-64 characters, starting with a letter or digit, "
            "and may contain only letters, digits, dots, hyphens and underscores."
        )
    return username


def normalise_email(raw: str) -> str:
    email = raw.strip().lower()
    if not EMAIL_PATTERN.match(email) or len(email) > 320:
        raise ValidationError("That does not look like an email address.")
    return email


def normalise_name(raw: str) -> str:
    name = " ".join(raw.split())
    if not 1 <= len(name) <= MAX_NAME_LENGTH:
        raise ValidationError(f"Name must be 1-{MAX_NAME_LENGTH} characters.")
    return name


def validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValidationError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes.")


SEEN_EVERY = timedelta(minutes=10)


def mark_seen(user: User, now: datetime | None = None) -> bool:
    """Note that this person is about, for "active this week" — at most every
    ten minutes, so an ordinary request does not become a write."""
    now = now or datetime.now(UTC)
    if user.last_seen_at is not None and now - user.last_seen_at < SEEN_EVERY:
        return False
    user.last_seen_at = now
    return True


class AuthService:
    def __init__(self, users: UserRepository) -> None:
        self._users = users

    async def sign_up_teacher(self, *, name: str, email: str, password: str) -> AuthResult:
        """Teachers sign in with their email, so they need no username."""
        name = normalise_name(name)
        email = normalise_email(email)
        validate_password(password)
        if await self._users.get_by_email(email):
            raise ConflictError("That email is already registered.")
        user = await self._create(role=Role.TEACHER, name=name, email=email, password=password)
        logger.info("teacher signed up: %s", email)
        return self._signed_in(user)

    async def sign_up_student(
        self, *, name: str, grade_level: str, username: str, password: str
    ) -> AuthResult:
        """Students have no email: a name, a grade, a username, a password."""
        name = normalise_name(name)
        username = normalise_username(username)
        if not is_grade(grade_level):
            raise ValidationError("Pick your grade from the list.")
        validate_password(password)
        if await self._users.get_by_username(username):
            raise ConflictError("That username is taken — try another one.")
        user = await self._create(
            role=Role.STUDENT,
            name=name,
            username=username,
            password=password,
            grade_level=grade_level,
        )
        logger.info("student signed up: %s", username)
        return self._signed_in(user)

    async def _create(
        self,
        *,
        role: Role,
        name: str,
        password: str,
        email: str | None = None,
        username: str | None = None,
        grade_level: str | None = None,
    ) -> User:
        return await self._users.add(
            User(
                username=username,
                email=email,
                password_hash=hash_password(password),
                display_name=name,
                role=role.value,
                grade_level=grade_level,
                preferences={},
                is_active=True,
            )
        )

    @staticmethod
    def _signed_in(user: User) -> AuthResult:
        return AuthResult(user=user, access_token=create_access_token(user.id))

    async def username_status(self, raw: str) -> UsernameStatus:
        """Whether a username can be had, and a few that can if it cannot.

        Suggestions matter more than the verdict for a nine-year-old whose
        first choice is "adam": a dead end at signup is a lost student.
        """
        try:
            username = normalise_username(raw)
        except ValidationError as error:
            return UsernameStatus(available=False, reason=error.message)
        if await self._users.get_by_username(username) is None:
            return UsernameStatus(available=True)
        return UsernameStatus(
            available=False,
            reason="That username is taken.",
            suggestions=await self._free_variants(username),
        )

    async def _free_variants(self, username: str) -> tuple[str, ...]:
        stem = username[:56].rstrip("._-")
        free: list[str] = []
        for suffix in (*range(1, 10), *range(10, 100, 7)):
            candidate = f"{stem}{suffix}"
            if await self._users.get_by_username(candidate) is None:
                free.append(candidate)
            if len(free) == SUGGESTION_COUNT:
                break
        return tuple(free)

    async def sign_in(self, *, identifier: str, password: str) -> AuthResult:
        """Accepts a username or an email.

        Every failure returns the same message. Distinguishing "no such user"
        from "wrong password" turns the login form into an account enumeration
        oracle.
        """
        lookup = identifier.strip().lower()
        user = await self._users.get_by_username(lookup)
        if user is None and "@" in lookup:
            user = await self._users.get_by_email(lookup)

        if user is None or not verify_password(password, user.password_hash):
            raise AuthError("Incorrect username or password.")
        if not user.is_active:
            raise AuthError("This account has been disabled.")

        return self._signed_in(user)

    async def get_user(self, user_id: UUID) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise AuthError("Your session is no longer valid.")
        mark_seen(user)
        return user

    async def update_profile(
        self,
        user_id: UUID,
        *,
        display_name: str | None = None,
        email: str | None = None,
    ) -> User:
        user = await self._require(user_id)

        if display_name is not None:
            user.display_name = normalise_name(display_name)

        if email is not None:
            normalised = normalise_email(email)
            if normalised != user.email:
                existing = await self._users.get_by_email(normalised)
                if existing is not None and existing.id != user.id:
                    raise ConflictError("That email is already registered.")
                user.email = normalised

        return await self._users.save(user)

    async def change_password(
        self, user_id: UUID, *, current_password: str, new_password: str
    ) -> None:
        user = await self._require(user_id)
        if not verify_password(current_password, user.password_hash):
            raise AuthError("Current password is incorrect.")

        validate_password(new_password)
        user.password_hash = hash_password(new_password)
        await self._users.save(user)
        logger.info("password changed for %s", user.sign_in_name)

    async def update_preferences(self, user_id: UUID, patch: dict[str, Any]) -> User:
        user = await self._require(user_id)
        # A new dict, not an in-place edit: SQLAlchemy only notices a JSONB
        # column changed when the attribute is reassigned.
        user.preferences = merge_preferences(user.preferences or {}, patch)
        return await self._users.save(user)

    async def choose_buddy(self, user_id: UUID, buddy: str) -> User:
        name = buddy.strip().lower()
        if not is_buddy(name):
            choices = ", ".join(BUDDIES)
            raise ValidationError(f"There is no buddy called {buddy!r}. Pick from: {choices}.")
        user = await self._require(user_id)
        user.buddy = name
        return await self._users.save(user)

    async def finish_onboarding(self, user_id: UUID) -> User:
        user = await self._require(user_id)
        if user.onboarded_at is None:
            user.onboarded_at = datetime.now(UTC)
        return await self._users.save(user)

    async def _require(self, user_id: UUID) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return user
