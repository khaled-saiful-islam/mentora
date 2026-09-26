"""A parent sending what they made home to their child (PLAN.md §20.4).

The set must be the parent's own, made to send home, and ready; each child
must be linked to them. Anything else is refused or not found — the same
rules as the rest of the family routes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, SessionDep, require_capability
from app.db.models.family import FamilyShare
from app.db.models.user import User
from app.events.registry import build_bus
from app.services.family_service import first_name
from app.services.family_share_service import MAX_CHILDREN_AT_ONCE, FamilyShareService

router = APIRouter(
    prefix="/family-shares",
    tags=["family"],
    dependencies=[Depends(require_capability("make_family_sets"))],
)


class ShareBody(BaseModel):
    set_id: UUID
    student_ids: list[UUID] = Field(min_length=1, max_length=MAX_CHILDREN_AT_ONCE)
    due_at: datetime | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def send_home(body: ShareBody, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    service = FamilyShareService(session, build_bus())
    await service.share(user, body.set_id, body.student_ids, body.due_at)
    return {"items": [_out(s, c) for s, c in await service.of_set(user.id, body.set_id)]}


@router.get("")
async def shared(
    user: CurrentUser, session: SessionDep, set_id: UUID = Query(...)
) -> dict[str, Any]:
    """Who this set has been sent to."""
    found = await FamilyShareService(session).of_set(user.id, set_id)
    return {"items": [_out(s, c) for s, c in found]}


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def take_back(share_id: UUID, user: CurrentUser, session: SessionDep) -> Response:
    await FamilyShareService(session).unshare(user.id, share_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _out(share: FamilyShare, child: User) -> dict[str, Any]:
    return {
        "id": str(share.id),
        "student_id": str(child.id),
        "first_name": first_name(child),
        "version": share.version,
        "due_at": share.due_at.isoformat() if share.due_at else None,
        "shared_at": share.created_at.isoformat(),
    }
