"""Explain why (§28.3.5, Form 1–5): how many reasons a student may still
give today, and one given — screened, judged, and answered in a line."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, SessionDep, SettingsDep, require_capability
from app.core.config import Settings
from app.db.models.user import User
from app.learning.factory import build_model
from app.learning.model import Meter
from app.moderation.gate import ModerationGate
from app.moderation.registry import build_gate
from app.providers.registry import build_provider
from app.services.explain_why import ExplainWhyService
from app.services.rate_limit import Limit, RateLimiter

router = APIRouter(
    prefix="/me", tags=["play"], dependencies=[Depends(require_capability("take_assignments"))]
)


class WhyRequest(BaseModel):
    words: str = Field(min_length=2, max_length=600)


def _service(session: SessionDep, settings: Settings, user: User) -> ExplainWhyService:
    gate = build_gate(
        settings, role=user.role, grade_level=user.grade_level, provider=build_provider(settings)
    )
    return ExplainWhyService(
        session,
        lambda: build_model(settings, Meter()),
        gate or ModerationGate(),
        per_day=settings.explain_why_per_day,
        timezone=settings.default_timezone,
    )


@router.get("/why")
async def why_left(user: CurrentUser, session: SessionDep, settings: SettingsDep) -> dict[str, int]:
    """Reasons the student may still give today: none outside Form 1–5."""
    return {"left": await _service(session, settings, user).left(user)}


@router.post("/attempts/{attempt_id}/items/{item_id}/why")
async def explain_why(
    attempt_id: UUID,
    item_id: str,
    body: WhyRequest,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "explain_why", str(user.id), Limit(settings.rate_limit_explain_why_per_minute)
    )
    judged = await _service(session, settings, user).judge(
        user, attempt_id, item_id[:40], body.words
    )
    return judged.as_dict()
