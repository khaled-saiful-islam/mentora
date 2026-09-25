"""Things about the signed-in person that depend on who they are.

Separate from `/auth`, which is about identity: this is about what the
interface should offer them. Each answer comes from the same capability that
the API enforces, so the two cannot disagree.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import CurrentUser, SessionDep, SettingsDep, require_capability
from app.api.schemas.classes import StudentClassList, StudentClassResponse
from app.artifacts.registry import build_kinds
from app.db.models.user import User
from app.events.registry import build_bus
from app.policies.capabilities import capabilities_for
from app.services.membership_service import MembershipService

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/makeable")
async def makeable(user: CurrentUser, settings: SettingsDep) -> dict[str, object]:
    """The studio artifacts this person may make, straight from the registry.

    Empty for a student — not a 403 — because asking "what can I make?" is a
    fair question with an honest answer of "none of these".
    """
    studio = capabilities_for(user.role).studio_artifacts
    kinds = build_kinds(settings).values() if studio else ()
    return {
        "studio": [
            {"name": kind.name, "label": kind.label, "description": kind.description}
            for kind in kinds
        ],
    }


@router.get("/classes", response_model=StudentClassList)
async def my_classes(
    session: SessionDep,
    student: User = Depends(require_capability("join_classes")),  # noqa: B008
) -> StudentClassList:
    """The classes a student is in, waiting for, or has left."""
    found = await MembershipService(session, build_bus()).classes_of(student.id)
    return StudentClassList(items=[StudentClassResponse.of(view) for view in found])


@router.post("/classes/{class_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_class(
    class_id: UUID,
    session: SessionDep,
    student: User = Depends(require_capability("join_classes")),  # noqa: B008
) -> Response:
    await MembershipService(session, build_bus()).leave(student.id, class_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
