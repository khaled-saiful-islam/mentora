"""Second chance, at your level (§28.3.7): after a wrong answer, the question
explained at the student's level, and one like it to try.

Only on the student's own attempt, and only where the quiz offers it
(`second_chance_for`): a teacher's test switches it off.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SettingsDep,
    limit_second_chance,
    require_capability,
)
from app.learning.factory import build_model
from app.learning.model import Meter
from app.services.second_chance_service import SecondChanceService

router = APIRouter(
    prefix="/me/attempts/{attempt_id}/items/{item_id}",
    tags=["second chance"],
    dependencies=[Depends(require_capability("take_assignments")), Depends(limit_second_chance)],
)


class TryRequest(BaseModel):
    choice: int = Field(ge=0, le=9)


def _service(session: SessionDep, settings: SettingsDep) -> SecondChanceService:
    return SecondChanceService(
        session,
        lambda: build_model(settings, Meter()),
        timezone=settings.default_timezone,
    )


@router.get("/explain")
async def explain(
    attempt_id: UUID,
    item_id: str,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    level: str = "core",
) -> dict[str, Any]:
    """Why the right answer is right, with a worked example, at a level."""
    found = await _service(session, settings).explain(user.id, attempt_id, item_id[:40], level)
    return found.as_dict()


@router.post("/twin")
async def twin(
    attempt_id: UUID, item_id: str, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    """A question like it, or `{"twin": null}` when there is none just now."""
    found = await _service(session, settings).twin(user.id, attempt_id, item_id[:40])
    return {"twin": found.as_dict() if found else None}


@router.post("/twin/answer")
async def try_twin(
    attempt_id: UUID,
    item_id: str,
    body: TryRequest,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    """The second try: right or not, the answer, and whether the buddy grew."""
    tried = await _service(session, settings).try_twin(
        user.id, attempt_id, item_id[:40], body.choice
    )
    return {"twin": tried.as_dict()}
