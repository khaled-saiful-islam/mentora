from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str | None
    email: str | None
    display_name: str | None
    role: str
    grade_level: str | None
    is_admin: bool
    is_active: bool
    # Null is unlimited, which is the default.
    daily_token_limit: int | None
    # Spent in the last rolling 24 hours, so a limit can be set with some idea
    # of what this account actually uses.
    tokens_used_24h: int
    created_at: datetime


class AdminUserList(BaseModel):
    items: list[AdminUserResponse]


class CreateUserRequest(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=64)
    email: EmailStr | None = None
    # bcrypt sees 72 bytes; the service refuses more by name rather than a 500.
    password: str = Field(min_length=8, max_length=200)
    display_name: str | None = Field(default=None, max_length=120)
    role: Literal["admin", "teacher", "student"] = "teacher"
    # Kept so older clients that only knew the flag still work.
    is_admin: bool = False
    grade_level: str | None = Field(default=None, max_length=32)
    daily_token_limit: int | None = Field(default=None, ge=0)


class UpdateUserRequest(BaseModel):
    """Every field optional: a PATCH that only disables an account should not
    have to restate the rest of it."""

    is_active: bool | None = None
    is_admin: bool | None = None
    display_name: str | None = Field(default=None, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=200)
    daily_token_limit: int | None = Field(default=None, ge=0)
    # Explicit, because `daily_token_limit: null` in a PATCH is indistinguishable
    # from "not mentioned" — and the two mean opposite things here.
    clear_limit: bool = False


class UsageResponse(BaseModel):
    """What the signed-in user is allowed to know about their own allowance."""

    tokens_used_24h: int
    daily_token_limit: int | None
    remaining: int | None
