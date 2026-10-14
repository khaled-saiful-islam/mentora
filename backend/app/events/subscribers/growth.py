"""A buddy grows as its student learns (§28.3.1): finishing work, doing it
well, coming back each day, badges and skills mastered. Written inside the
transaction that caused it, so growth and what earned it land together."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.events.catalog import AttemptCompleted, BadgeAwarded
from app.services.growth_service import GrowthService


def _service(session: AsyncSession) -> GrowthService:
    return GrowthService(session, timezone=get_settings().default_timezone)


async def attempt_completed(event: AttemptCompleted, session: AsyncSession) -> None:
    await _service(session).attempt_completed(event)


async def badge_awarded(event: BadgeAwarded, session: AsyncSession) -> None:
    await _service(session).badge_awarded(event)
