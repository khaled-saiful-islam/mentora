"""A student's buddy growing as they learn, and the buddies they have met
(§28.3.1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, SessionDep, SettingsDep, require_capability
from app.services.growth_service import GrowthService

router = APIRouter(
    prefix="/me",
    tags=["growth"],
    dependencies=[Depends(require_capability("take_assignments"))],
)


@router.get("/growth")
async def growth(
    user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, object]:
    """How grown the buddy is, how far to the next stage, what is not yet
    celebrated, and the buddies met and still to meet."""
    service = GrowthService(session, timezone=settings.default_timezone)
    return (await service.growth(user)).as_dict()


@router.post("/growth/seen")
async def seen(
    user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, object]:
    """The arrival and every stage so far celebrated: not shown again."""
    service = GrowthService(session, timezone=settings.default_timezone)
    return (await service.seen(user)).as_dict()
