"""Account management, for administrators.

Every route here is behind `AdminUser`, which is a dependency rather than a
check inside each handler — a check you have to remember is a check someone
will forget on the one route that matters.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AdminUser, SessionDep, current_admin
from app.api.schemas.admin import (
    AdminUserPage,
    AdminUserResponse,
    CreateUserRequest,
    FootprintResponse,
    TemporaryPasswordResponse,
    UpdateUserRequest,
)
from app.services.admin_service import AdminService, ManagedUser
from app.services.quota import TokenQuota, Usage

router = APIRouter(prefix="/admin/users", tags=["admin"], dependencies=[Depends(current_admin)])


def _response(managed: ManagedUser) -> AdminUserResponse:
    user = managed.user
    return AdminUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        grade_level=user.grade_level,
        is_admin=user.is_admin,
        is_active=user.is_active,
        daily_token_limit=user.daily_token_limit,
        tokens_used_24h=managed.usage.tokens,
        created_at=user.created_at,
    )


@router.get("", response_model=AdminUserPage)
async def index(
    session: SessionDep,
    admin: AdminUser,
    q: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None, pattern="^(admin|teacher|student)$"),
    status_: str | None = Query(default=None, alias="status", pattern="^(active|suspended)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> AdminUserPage:
    page = await AdminService(session).page(
        q=q, role=role, status=status_, offset=offset, limit=limit
    )
    return AdminUserPage(items=[_response(m) for m in page.items], total=page.total)


@router.post("", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: CreateUserRequest, session: SessionDep, admin: AdminUser
) -> AdminUserResponse:
    user = await AdminService(session).create(
        username=body.username,
        email=str(body.email) if body.email else None,
        password=body.password,
        display_name=body.display_name,
        role="admin" if body.is_admin else body.role,
        grade_level=body.grade_level,
        daily_token_limit=body.daily_token_limit,
    )
    # Freshly created, so nothing has been spent yet.
    return _response(ManagedUser(user=user, usage=Usage(tokens=0, limit=user.daily_token_limit)))


@router.patch("/{user_id}", response_model=AdminUserResponse)
async def update(
    user_id: UUID, body: UpdateUserRequest, session: SessionDep, admin: AdminUser
) -> AdminUserResponse:
    service = AdminService(session)
    user = await service.update(
        user_id,
        acting_admin_id=admin.id,
        is_active=body.is_active,
        is_admin=body.is_admin,
        display_name=body.display_name,
        password=body.password,
        daily_token_limit=body.daily_token_limit,
        clear_limit=body.clear_limit,
    )
    usage = await TokenQuota(session).usage(user.id, user.daily_token_limit)
    return _response(ManagedUser(user=user, usage=usage))


@router.get("/{user_id}/footprint", response_model=FootprintResponse)
async def footprint(user_id: UUID, session: SessionDep, admin: AdminUser) -> FootprintResponse:
    """What deleting this account would take with it — shown before asking."""
    found = await AdminService(session).footprint(user_id)
    return FootprintResponse(
        classes=found.classes,
        learning_sets=found.learning_sets,
        conversations=found.conversations,
        attempts=found.attempts,
        students=found.students,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    user_id: UUID,
    session: SessionDep,
    admin: AdminUser,
    confirm: str = Query(min_length=1, max_length=320),
) -> None:
    await AdminService(session).delete(user_id, acting_admin_id=admin.id, confirm=confirm)


@router.post("/{user_id}/password", response_model=TemporaryPasswordResponse)
async def reset_password(
    user_id: UUID, session: SessionDep, admin: AdminUser
) -> TemporaryPasswordResponse:
    user, password = await AdminService(session).reset_password(user_id, acting_admin_id=admin.id)
    return TemporaryPasswordResponse(sign_in_name=user.sign_in_name, password=password)
