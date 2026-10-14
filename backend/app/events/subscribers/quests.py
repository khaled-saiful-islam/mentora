"""After every finished attempt (§28.3.4): each skill it asked about moves
through its review boxes, and a quest finished is marked done."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.events.catalog import AttemptCompleted
from app.services.quest_service import QuestService


async def remember(event: AttemptCompleted, session: AsyncSession) -> None:
    await QuestService(session, timezone=get_settings().default_timezone).remember(event)
