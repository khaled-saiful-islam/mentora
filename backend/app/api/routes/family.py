"""A child's family, from three sides:

- `/me/family` — the child: their invitation, and who is connected.
- `/family/…` — a parent with an invitation: what it is, and connecting.
  The look-up is open (a parent may not have an account yet), rate limited,
  and shows a first name and a buddy, nothing more.
- `/me/children` — a parent: their children, and ending a link.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SettingsDep,
    limit_invite,
    require_capability,
)
from app.api.schemas.classes import StudentClassList, StudentClassResponse
from app.core.grades import grade_label
from app.db.models.family import FamilyInvite
from app.events.registry import build_bus
from app.services.class_pulse import ClassPulseService
from app.services.family_service import ChildView, FamilyService, first_name
from app.services.membership_service import MembershipService

student_router = APIRouter(
    prefix="/me/family",
    tags=["family"],
    dependencies=[Depends(require_capability("invite_family"))],
)
public_router = APIRouter(prefix="/family", tags=["family"])
parent_router = APIRouter(
    prefix="/me/children",
    tags=["family"],
    dependencies=[Depends(require_capability("see_children"))],
)


class InviteToggle(BaseModel):
    enabled: bool


class ConnectBody(BaseModel):
    key: str = Field(min_length=6, max_length=128)
    label: str | None = Field(default=None, max_length=24)


# --- the child -------------------------------------------------------------------


@student_router.get("")
async def my_family(
    request: Request, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    family = FamilyService(session)
    invite = await family.invite_for(user)
    parents = await family.parents(user.id)
    return {
        "invite": _invite(invite, request, settings),
        "parents": [
            {
                "name": p.parent.display_name or p.parent.sign_in_name,
                "label": p.label,
                "linked_at": p.linked_at.isoformat(),
            }
            for p in parents
        ],
    }


@student_router.post("/invite/rotate")
async def rotate_invite(
    request: Request, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    return _invite(await FamilyService(session).rotate(user), request, settings)


@student_router.patch("/invite")
async def toggle_invite(
    body: InviteToggle,
    request: Request,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    invite = await FamilyService(session).set_enabled(user, body.enabled)
    return _invite(invite, request, settings)


# --- a parent with an invitation ---------------------------------------------------


@public_router.get("/invites/{key}", dependencies=[Depends(limit_invite)])
async def preview(key: str, response: Response, session: SessionDep) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    found = await FamilyService(session).preview(key)
    return {"first_name": found.first_name, "buddy": found.buddy}


@public_router.post(
    "/connect",
    dependencies=[Depends(limit_invite), Depends(require_capability("see_children"))],
)
async def connect(body: ConnectBody, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    linked = await FamilyService(session, build_bus()).connect(user, body.key, body.label)
    return _child(linked)


# --- the parent --------------------------------------------------------------------


@parent_router.get("")
async def my_children(user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    return {"items": [_child(c) for c in await FamilyService(session).children(user.id)]}


@parent_router.get("/{student_id}/classes", response_model=StudentClassList)
async def child_classes(
    student_id: UUID, user: CurrentUser, session: SessionDep
) -> StudentClassList:
    """The child's classes and their teachers — what the child sees, read-only."""
    child = await FamilyService(session).child(user.id, student_id)
    found = await MembershipService(session, build_bus()).classes_of(child.id)
    pulses = await ClassPulseService(session).for_student(child)
    return StudentClassList(
        items=[
            StudentClassResponse.of(view, pulses.get(view.class_id))
            for view in found
            if view.status == "approved"
        ]
    )


@parent_router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect(student_id: UUID, user: CurrentUser, session: SessionDep) -> Response:
    await FamilyService(session).disconnect(user.id, student_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _invite(invite: FamilyInvite, request: Request, settings) -> dict[str, Any]:
    base = (settings.public_base_url or str(request.base_url)).rstrip("/")
    return {
        "code": invite.code,
        "url": f"{base}/family/{invite.token}",
        "enabled": invite.enabled,
        "expires_at": invite.expires_at.isoformat(),
    }


def _child(view: ChildView) -> dict[str, Any]:
    student = view.student
    return {
        "id": str(student.id),
        "name": student.display_name or student.sign_in_name,
        "first_name": first_name(student),
        "buddy": student.buddy,
        "grade_label": grade_label(student.grade_level),
        "label": view.label,
        "linked_at": _iso(view.linked_at),
    }


def _iso(when: datetime) -> str:
    return when.isoformat()
