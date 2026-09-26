"""Practice made for a student from a shared set they found hard.

Only the deciding happens here, inside the attempt's transaction. The making
starts once that transaction commits (`services/after_commit.py`), in its own
task, so finishing a quiz is never slowed by it.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.catalog import AttemptCompleted
from app.services.after_commit import after_commit
from app.services.auto_practice import AutoPracticeService, build_generation, make_practice


async def weak_spots(event: AttemptCompleted, session: AsyncSession) -> None:
    plan = await AutoPracticeService(session).plan(event)
    if plan is None:
        return
    after_commit(session, lambda: make_practice(plan, build_generation()))
