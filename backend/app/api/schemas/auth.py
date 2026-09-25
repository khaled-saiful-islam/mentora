from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.grades import grade_label
from app.db.models.user import User
from app.policies.capabilities import capabilities_for
from app.services.preferences import effective_preferences


class TeacherSignUpRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=72)


class StudentSignUpRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    grade_level: str = Field(max_length=32)
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=72)
    # From a class invite link: signing up through one also asks to join.
    invite_token: str | None = Field(default=None, max_length=128)


class SignInRequest(BaseModel):
    # Username or email; the service works out which.
    identifier: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=72)


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=320)
    buddy: str | None = Field(default=None, max_length=24)


class PreferencesRequest(BaseModel):
    """Send only what changes. An explicit `null` resets one to the default."""

    text_scale: int | None = None
    font_style: str | None = Field(default=None, max_length=16)
    motion: str | None = Field(default=None, max_length=16)
    sound: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class UsernameStatusResponse(BaseModel):
    available: bool
    reason: str | None
    suggestions: list[str]


class JoinAtSignUp(BaseModel):
    """What happened to the invite a student signed up through."""

    # "requested" | "pending" | "member" | "invalid"
    status: str
    class_name: str | None = None
    teacher_name: str | None = None


class UserResponse(BaseModel):
    """What the browser is allowed to know about a user. No password hash.

    Capabilities travel with the user so the interface can shape itself from
    the same decisions the API enforces — never instead of them.
    """

    id: UUID
    username: str | None
    email: str | None
    display_name: str | None
    role: str
    is_admin: bool
    grade_level: str | None
    grade_label: str | None
    buddy: str | None
    preferences: dict[str, Any]
    onboarded: bool
    capabilities: dict[str, bool]
    created_at: datetime

    @classmethod
    def of(cls, user: User) -> UserResponse:
        return cls(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_admin=user.is_admin,
            grade_level=user.grade_level,
            grade_label=grade_label(user.grade_level),
            buddy=user.buddy,
            preferences=effective_preferences(user.role, user.preferences).as_dict(),
            onboarded=user.onboarded_at is not None,
            capabilities=capabilities_for(user.role).as_dict(),
            created_at=user.created_at,
        )


class StudentSignUpResponse(UserResponse):
    join: JoinAtSignUp | None = None
