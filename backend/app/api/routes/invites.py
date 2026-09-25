"""Opening an invite link or typing a class code.

Looking one up needs no account — a child with a link should see which class
it is before signing up. Joining needs a student account. Both are
rate-limited per address, and every dead invite answers identically.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import SessionDep, limit_invite, require_capability
from app.api.schemas.classes import InvitePreviewResponse, JoinResponse
from app.db.models.user import User
from app.events.registry import build_bus
from app.services.invite_service import InviteService
from app.services.membership_service import MembershipService

router = APIRouter(prefix="/invites", tags=["invites"], dependencies=[Depends(limit_invite)])


@router.get("/{key}", response_model=InvitePreviewResponse)
async def preview(key: str, session: SessionDep) -> InvitePreviewResponse:
    return InvitePreviewResponse.of(await InviteService(session).lookup(key))


@router.post("/{key}/join", response_model=JoinResponse)
async def join(
    key: str,
    session: SessionDep,
    student: User = Depends(require_capability("join_classes")),  # noqa: B008
) -> JoinResponse:
    outcome = await MembershipService(session, build_bus()).request(student, key)
    return JoinResponse(status=outcome.status, invite=InvitePreviewResponse.of(outcome.preview))
