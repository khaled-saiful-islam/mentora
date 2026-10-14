"""Help at home (§28.3.3): from a skill a child finds hard, what it means and
something to do together, a challenge sent home, and cheers.

All under the parent's own view of their child, so a parent reaches only a
child linked to them (`FamilyService.child`).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, SessionDep, SettingsDep, limit_generate, require_capability
from app.events.registry import build_bus
from app.learning.factory import build_model
from app.learning.model import Meter
from app.services.after_commit import after_commit
from app.services.auto_practice import build_generation
from app.services.cheer_service import CHEERS, send_cheer
from app.services.family_service import FamilyService
from app.services.family_share_service import FamilyShareService
from app.services.rate_limit import Limit, RateLimiter
from app.services.skill_help_service import SkillHelpService
from app.services.skill_practice import begin, build_then, from_child_work

router = APIRouter(
    prefix="/me/children/{student_id}",
    tags=["help at home"],
    dependencies=[Depends(require_capability("see_children"))],
)

# Cheers a parent may send one child in an hour: plenty to be kind, too few to flood.
CHEERS_PER_HOUR = 10


class ChallengeRequest(BaseModel):
    skill: str = Field(min_length=1, max_length=80)


class CheerRequest(BaseModel):
    cheer: str = Field(min_length=1, max_length=24)


@router.get("/skills/{slug}/help")
async def skill_help(
    student_id: UUID,
    slug: str,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    subject: str = "General",
    label: str = "",
    language: str = "en",
) -> dict[str, Any]:
    """What the skill means, one example, and five minutes to do at home."""
    child = await FamilyService(session).child(user.id, student_id)
    service = SkillHelpService(session, lambda: build_model(settings, Meter()))
    found = await service.help(
        subject=subject,
        slug=slug,
        label=label or slug.replace("-", " "),
        grade=child.grade_level,
        language=language,
    )
    return found.as_dict()


@router.post(
    "/challenges",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_capability("make_family_sets")), Depends(limit_generate)],
)
async def challenge(
    student_id: UUID, body: ChallengeRequest, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    """A short quiz on just this skill, made now and sent home when ready."""
    child = await FamilyService(session).child(user.id, student_id)
    plan = await from_child_work(session, child, body.skill)
    generation = build_generation()
    learning_set = await begin(session, user, plan, generation)
    parent_id, child_id = user.id, child.id

    async def send_home(db, set_id: UUID, _outcome: dict[str, Any]) -> None:
        parent = await db.get(type(user), parent_id)
        await FamilyShareService(db, build_bus()).share(parent, set_id, [child_id])

    after_commit(session, lambda: build_then(learning_set.id, plan, generation, send_home))
    return {"set_id": str(learning_set.id), "skill": plan.skills[0][1], "status": "making"}


@router.get("/cheers")
async def cheers(student_id: UUID) -> dict[str, Any]:
    """The cheers there are to send."""
    return {
        "items": [
            {"key": key, "sticker": c.sticker, "line": c.line} for key, c in CHEERS.items()
        ]
    }


@router.post("/cheers", status_code=status.HTTP_201_CREATED)
async def cheer(
    student_id: UUID,
    body: CheerRequest,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    """A sticker and a line for the child, which their buddy acts out."""
    family = FamilyService(session)
    child = await family.child(user.id, student_id)
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "cheer", f"{user.id}:{child.id}", Limit(CHEERS_PER_HOUR, seconds=3600)
    )
    label = next((v.label for v in await family.children(user.id) if v.student.id == child.id), "")
    sent = await send_cheer(session, user, child, body.cheer, label)
    return {"sticker": sent.sticker, "line": sent.line}
