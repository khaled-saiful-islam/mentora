"""A student's streak (§28.3.4): days in a row with something finished, in
the school's time zone — so a Malaysian child's day starts at midnight, not
at 8 in the morning — with freezes that cover a missed day."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import zone
from app.db.models.attempt import Attempt
from app.quests.rules import Streak, streak_of

# Far enough back for any streak worth counting.
LOOK_BACK_DAYS = 400


async def streak_for(
    session: AsyncSession, student_id: UUID, *, timezone: str, today: date
) -> Streak:
    since = datetime.combine(today - timedelta(days=LOOK_BACK_DAYS), time.min, tzinfo=UTC)
    finished = (
        await session.execute(
            select(Attempt.completed_at).where(
                Attempt.student_id == student_id,
                Attempt.status == "completed",
                Attempt.completed_at >= since,
            )
        )
    ).scalars()
    local = zone(timezone)
    return streak_of({m.astimezone(local).date() for m in finished if m is not None}, today)
