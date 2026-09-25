"""Auth endpoints.

The session token is set as an httpOnly cookie rather than returned in the body,
so a successful XSS cannot read it. The same token is accepted as a bearer
header for scripts and API clients.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import AuthServiceDep, CurrentUser, SessionDep, SettingsDep, limit_auth
from app.api.schemas.admin import UsageResponse
from app.api.schemas.auth import (
    ChangePasswordRequest,
    PreferencesRequest,
    SignInRequest,
    StudentSignUpRequest,
    TeacherSignUpRequest,
    UpdateProfileRequest,
    UsernameStatusResponse,
    UserResponse,
)
from app.core.config import Settings
from app.core.security import create_access_token
from app.services.quota import TokenQuota

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "mentora_session"


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        # SameSite=lax is not sent on cross-site POSTs, which is what makes CSRF
        # tokens unnecessary here: the SPA and API are same-origin behind nginx.
        samesite="lax",
        secure=settings.auth_cookie_secure,
        path="/",
    )


@router.post(
    "/signup/teacher",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth)],
)
async def sign_up_teacher(
    payload: TeacherSignUpRequest,
    auth: AuthServiceDep,
    settings: SettingsDep,
    response: Response,
) -> UserResponse:
    result = await auth.sign_up_teacher(
        name=payload.name, email=payload.email, password=payload.password
    )
    _set_session_cookie(response, result.access_token, settings)
    return UserResponse.of(result.user)


@router.post(
    "/signup/student",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth)],
)
async def sign_up_student(
    payload: StudentSignUpRequest,
    auth: AuthServiceDep,
    settings: SettingsDep,
    response: Response,
) -> UserResponse:
    result = await auth.sign_up_student(
        name=payload.name,
        grade_level=payload.grade_level,
        username=payload.username,
        password=payload.password,
    )
    _set_session_cookie(response, result.access_token, settings)
    return UserResponse.of(result.user)


@router.get(
    "/username-available",
    response_model=UsernameStatusResponse,
    dependencies=[Depends(limit_auth)],
)
async def username_available(u: str, auth: AuthServiceDep) -> UsernameStatusResponse:
    """Rate-limited per address with sign-in, because it says whether an
    account exists — useful to a child choosing a name, and to nobody else in
    bulk."""
    status_ = await auth.username_status(u[:64])
    return UsernameStatusResponse(
        available=status_.available,
        reason=status_.reason,
        suggestions=list(status_.suggestions),
    )


@router.post("/signin", response_model=UserResponse, dependencies=[Depends(limit_auth)])
async def sign_in(
    payload: SignInRequest,
    auth: AuthServiceDep,
    settings: SettingsDep,
    response: Response,
) -> UserResponse:
    result = await auth.sign_in(identifier=payload.identifier, password=payload.password)
    _set_session_cookie(response, result.access_token, settings)
    return UserResponse.of(result.user)


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me/usage", response_model=UsageResponse)
async def my_usage(user: CurrentUser, session: SessionDep) -> UsageResponse:
    """What this account has spent and what it may spend.

    Its own endpoint rather than a field on /me, because it costs a query and
    every page load asks who you are.
    """
    usage = await TokenQuota(session).usage(user.id, user.daily_token_limit)
    return UsageResponse(
        tokens_used_24h=usage.tokens,
        daily_token_limit=usage.limit,
        remaining=usage.remaining,
    )


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser) -> UserResponse:
    return UserResponse.of(user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest, auth: AuthServiceDep, user: CurrentUser
) -> UserResponse:
    updated = await auth.update_profile(
        user.id, display_name=payload.display_name, email=payload.email
    )
    if payload.buddy is not None:
        updated = await auth.choose_buddy(user.id, payload.buddy)
    return UserResponse.of(updated)


@router.patch("/me/preferences", response_model=UserResponse)
async def update_preferences(
    payload: PreferencesRequest, auth: AuthServiceDep, user: CurrentUser
) -> UserResponse:
    # Only the fields that were sent: an explicit null resets, absence keeps.
    patch = payload.model_dump(exclude_unset=True)
    return UserResponse.of(await auth.update_preferences(user.id, patch))


@router.post("/me/onboarded", response_model=UserResponse)
async def finish_onboarding(auth: AuthServiceDep, user: CurrentUser) -> UserResponse:
    return UserResponse.of(await auth.finish_onboarding(user.id))


@router.post(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(limit_auth)],
)
async def change_password(
    payload: ChangePasswordRequest,
    auth: AuthServiceDep,
    user: CurrentUser,
    settings: SettingsDep,
    response: Response,
) -> None:
    await auth.change_password(
        user.id,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    # Re-issue so the session survives the change rather than silently expiring.
    _set_session_cookie(response, create_access_token(user.id), settings)
