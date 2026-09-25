"""Live pushes that are not notifications — a leaderboard someone has open."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.catalog import AttemptCompleted
from app.services.realtime import push_after_commit


async def leaderboard_changed(event: AttemptCompleted, session: AsyncSession) -> None:
    if not event.leaderboard or event.assignment_id is None:
        return
    message = {"topic": "leaderboard", "assignment_id": str(event.assignment_id)}
    for user_id in {*event.audience, *([event.teacher_id] if event.teacher_id else [])}:
        push_after_commit(session, user_id, message)
