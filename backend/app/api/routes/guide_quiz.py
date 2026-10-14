"""A guide's short quiz (§28.3.8): unlocked by finishing a study guide, made
from the guide itself, and played as the student's own practice."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, SessionDep, require_capability
from app.services.guide_quiz import guide_quiz

router = APIRouter(
    prefix="/me", tags=["play"], dependencies=[Depends(require_capability("take_assignments"))]
)


@router.post("/attempts/{attempt_id}/guide-quiz")
async def quiz_for_guide(
    attempt_id: UUID, user: CurrentUser, session: SessionDep
) -> dict[str, str]:
    """The quiz for the guide this attempt read; the same one each time."""
    quiz = await guide_quiz(session, user, attempt_id)
    return {"set_id": str(quiz.id), "title": quiz.title}
