"""Practice for these students (§28.3.3): from a red skill on an
assignment's heatmap, one tap makes a short quiz on just that skill, from the
assignment's own sources, and shares it with just the students who found it
hard — as a group of the class, named for the skill.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, SessionDep, limit_generate, require_capability
from app.core.errors import ValidationError
from app.db.models.user import User
from app.events.registry import build_bus
from app.services.after_commit import after_commit
from app.services.assignment_service import AssignmentService, ShareSettings
from app.services.auto_practice import build_generation
from app.services.group_service import GroupService
from app.services.results_service import WEAK, ResultsService
from app.services.skill_practice import begin, build_then, from_set

router = APIRouter(
    prefix="/assignments",
    tags=["assignments"],
    dependencies=[Depends(require_capability("share_learning_sets"))],
)

# A group's name, short enough for a chip: "Practise: Equivalent fractions".
NAME_LENGTH = 60


class PracticeRequest(BaseModel):
    skill: str = Field(min_length=1, max_length=80)


def who_found_it_hard(heat: dict[str, dict[str, float]], slug: str) -> list[UUID]:
    """The students whose share right on this skill is in the red."""
    return [
        UUID(student) for student, skills in heat.items() if skills.get(slug, 1.0) < WEAK
    ]


@router.post(
    "/{assignment_id}/practice",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_generate)],
)
async def practice_for_these(
    assignment_id: UUID, body: PracticeRequest, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    results = await ResultsService(session, build_bus()).for_assignment(user.id, assignment_id)
    students = who_found_it_hard(results.heat, body.skill)
    if not students:
        raise ValidationError("Nobody found this skill hard: no practice is needed.")
    assignment = results.assignment
    plan = await from_set(session, assignment.set_id, assignment.version, body.skill)
    label = plan.skills[0][1]
    groups = GroupService(session)
    name = f"Practise: {label}"[:NAME_LENGTH]
    # Practised before: the same group, now holding whoever is in the red.
    existing = await groups.list(user.id, assignment.class_id)
    found = next((g.group for g in existing if g.group.name == name), None)
    group = found or await groups.create(user.id, assignment.class_id, name=name)
    await groups.set_members(user.id, assignment.class_id, group.id, students)
    generation = build_generation()
    learning_set = await begin(session, user, plan, generation)
    teacher_id, class_id, group_id = user.id, assignment.class_id, group.id

    async def share(db, set_id: UUID, _outcome: dict[str, Any]) -> None:
        teacher = await db.get(User, teacher_id)
        await AssignmentService(db, build_bus()).share(
            teacher, set_id, class_id, ShareSettings(group_ids=(group_id,))
        )

    after_commit(session, lambda: build_then(learning_set.id, plan, generation, share))
    return {
        "set_id": str(learning_set.id),
        "skill": label,
        "students": len(students),
        "group": group.name,
        "status": "making",
    }
