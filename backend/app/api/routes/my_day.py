"""A student's day (§28.3.4): today's quest, streak, skill garden and their
classes' quest this week."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, SessionDep, SettingsDep, require_capability
from app.services.my_day_service import MyDayService

router = APIRouter(
    prefix="/me",
    tags=["my day"],
    dependencies=[Depends(require_capability("take_assignments"))],
)


@router.get("/day")
async def my_day(
    user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, object]:
    """Made on first ask each day: today's quest is picked then."""
    return await MyDayService(session, timezone=settings.default_timezone).day(user)
