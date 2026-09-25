"""A teacher's classes, their students, groups and invite.

Everything here needs the `manage_classes` capability (the gate is on the
router), and every lookup inside is scoped to the signed-in teacher by the
services — another teacher's class answers 404, never 403.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUser, SessionDep, require_capability
from app.api.schemas.admin import TemporaryPasswordResponse
from app.api.schemas.classes import (
    ApprovedCount,
    ClassList,
    ClassResponse,
    ConfigureInviteRequest,
    CreateClassRequest,
    GroupList,
    GroupMembersRequest,
    GroupRequest,
    GroupResponse,
    InviteResponse,
    MemberList,
    MemberResponse,
    UpdateClassRequest,
    UpdateGroupRequest,
)
from app.events.registry import build_bus
from app.services.class_service import ClassService
from app.services.group_service import GroupService, GroupView
from app.services.invite_service import InviteService
from app.services.membership_service import MembershipService

router = APIRouter(
    prefix="/classes",
    tags=["classes"],
    dependencies=[Depends(require_capability("manage_classes"))],
)

Status = Literal["pending", "approved", "rejected", "revoked", "left"]


# --- classes ------------------------------------------------------------


@router.get("", response_model=ClassList)
async def index(user: CurrentUser, session: SessionDep, archived: bool = False) -> ClassList:
    found = await ClassService(session).list_for(user.id, archived=archived)
    return ClassList(items=[ClassResponse.of(summary) for summary in found])


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
async def create(body: CreateClassRequest, user: CurrentUser, session: SessionDep) -> ClassResponse:
    service = ClassService(session)
    room = await service.create(user, **body.model_dump())
    return ClassResponse.of(await service.summary(user.id, room.id))


@router.get("/{class_id}", response_model=ClassResponse)
async def read(class_id: UUID, user: CurrentUser, session: SessionDep) -> ClassResponse:
    return ClassResponse.of(await ClassService(session).summary(user.id, class_id))


@router.patch("/{class_id}", response_model=ClassResponse)
async def update(
    class_id: UUID, body: UpdateClassRequest, user: CurrentUser, session: SessionDep
) -> ClassResponse:
    service = ClassService(session)
    await service.update(user.id, class_id, **body.model_dump(exclude_unset=True))
    return ClassResponse.of(await service.summary(user.id, class_id))


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive(class_id: UUID, user: CurrentUser, session: SessionDep) -> Response:
    """Archive, not delete: what students earned in a class outlives it."""
    await ClassService(session).archive(user.id, class_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{class_id}/restore", response_model=ClassResponse)
async def restore(class_id: UUID, user: CurrentUser, session: SessionDep) -> ClassResponse:
    service = ClassService(session)
    await service.restore(user.id, class_id)
    return ClassResponse.of(await service.summary(user.id, class_id))


# --- the invite ---------------------------------------------------------


@router.get("/{class_id}/invite", response_model=InviteResponse)
async def invite(class_id: UUID, user: CurrentUser, session: SessionDep) -> InviteResponse:
    return InviteResponse.of(await InviteService(session).for_class(user.id, class_id))


@router.post("/{class_id}/invite/rotate", response_model=InviteResponse)
async def rotate_invite(class_id: UUID, user: CurrentUser, session: SessionDep) -> InviteResponse:
    return InviteResponse.of(await InviteService(session).rotate(user.id, class_id))


@router.patch("/{class_id}/invite", response_model=InviteResponse)
async def configure_invite(
    class_id: UUID, body: ConfigureInviteRequest, user: CurrentUser, session: SessionDep
) -> InviteResponse:
    invite_ = await InviteService(session).configure(
        user.id,
        class_id,
        enabled=body.enabled,
        expires_at=body.expires_at,
        clear_expiry=body.clear_expiry,
    )
    return InviteResponse.of(invite_)


# --- members ------------------------------------------------------------


@router.get("/{class_id}/members", response_model=MemberList)
async def members(
    class_id: UUID,
    user: CurrentUser,
    session: SessionDep,
    status_: Status | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> MemberList:
    page = await _memberships(session).members(
        user.id, class_id, status=status_, q=q, limit=limit, offset=offset
    )
    return MemberList(
        items=[MemberResponse.of(view) for view in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.post("/{class_id}/members/{membership_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve(
    class_id: UUID, membership_id: UUID, user: CurrentUser, session: SessionDep
) -> Response:
    await _memberships(session).approve(user.id, class_id, membership_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{class_id}/members/{membership_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject(
    class_id: UUID, membership_id: UUID, user: CurrentUser, session: SessionDep
) -> Response:
    await _memberships(session).reject(user.id, class_id, membership_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{class_id}/members/approve-all", response_model=ApprovedCount)
async def approve_all(class_id: UUID, user: CurrentUser, session: SessionDep) -> ApprovedCount:
    return ApprovedCount(approved=await _memberships(session).approve_all(user.id, class_id))


@router.post(
    "/{class_id}/members/{membership_id}/password", response_model=TemporaryPasswordResponse
)
async def reset_student_password(
    class_id: UUID, membership_id: UUID, session: SessionDep, user: CurrentUser
) -> TemporaryPasswordResponse:
    """A student forgot their password: a new temporary one to pass on."""
    student, password = await MembershipService(session, build_bus()).reset_password(
        user.id, class_id, membership_id
    )
    return TemporaryPasswordResponse(sign_in_name=student.sign_in_name, password=password)


@router.delete("/{class_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke(
    class_id: UUID, membership_id: UUID, user: CurrentUser, session: SessionDep
) -> Response:
    """Removed from the class and its groups; their past results are kept."""
    await _memberships(session).revoke(user.id, class_id, membership_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- groups -------------------------------------------------------------


@router.get("/{class_id}/groups", response_model=GroupList)
async def groups(class_id: UUID, user: CurrentUser, session: SessionDep) -> GroupList:
    found = await GroupService(session).list(user.id, class_id)
    return GroupList(items=[GroupResponse.of(view) for view in found])


@router.post(
    "/{class_id}/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED
)
async def create_group(
    class_id: UUID, body: GroupRequest, user: CurrentUser, session: SessionDep
) -> GroupResponse:
    group = await GroupService(session).create(
        user.id, class_id, name=body.name, colour=body.colour
    )
    return GroupResponse.of(GroupView(group=group, member_ids=[]))


@router.patch("/{class_id}/groups/{group_id}", response_model=GroupResponse)
async def update_group(
    class_id: UUID,
    group_id: UUID,
    body: UpdateGroupRequest,
    user: CurrentUser,
    session: SessionDep,
) -> GroupResponse:
    service = GroupService(session)
    await service.update(user.id, class_id, group_id, name=body.name, colour=body.colour)
    view = next(v for v in await service.list(user.id, class_id) if v.group.id == group_id)
    return GroupResponse.of(view)


@router.delete("/{class_id}/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    class_id: UUID, group_id: UUID, user: CurrentUser, session: SessionDep
) -> Response:
    await GroupService(session).delete(user.id, class_id, group_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{class_id}/groups/{group_id}/members", response_model=GroupResponse)
async def set_group_members(
    class_id: UUID,
    group_id: UUID,
    body: GroupMembersRequest,
    user: CurrentUser,
    session: SessionDep,
) -> GroupResponse:
    view = await GroupService(session).set_members(user.id, class_id, group_id, body.student_ids)
    return GroupResponse.of(view)


def _memberships(session) -> MembershipService:
    return MembershipService(session, build_bus())
