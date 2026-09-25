"""A teacher's home screen."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, SessionDep, require_capability
from app.core.grades import grade_label
from app.services.teaching_service import TeachingService

router = APIRouter(
    prefix="/me/teaching",
    tags=["teaching"],
    dependencies=[Depends(require_capability("manage_classes"))],
)


@router.get("")
async def overview(user: CurrentUser, session: SessionDep) -> dict[str, object]:
    home = await TeachingService(session).overview(user.id)
    return {
        "pending": home.pending,
        "live_now": home.live_now,
        "classes": [
            {
                "id": c.classroom.id,
                "name": c.classroom.name,
                "subject": c.classroom.subject,
                "grade_label": grade_label(c.classroom.grade_level),
                "theme": c.classroom.theme,
                "students": c.students,
                "pending": c.pending,
            }
            for c in home.classes
        ],
        "recent": [
            {
                "id": r.assignment.id,
                "title": r.assignment.title,
                "kind": r.assignment.kind,
                "class_id": r.assignment.class_id,
                "class_name": r.class_name,
                "due_at": r.assignment.due_at,
                "closed": r.assignment.closed_at is not None,
                "created_at": r.assignment.created_at,
                "audience": r.audience,
                "completed": r.completed,
                "in_progress": r.in_progress,
                "average": r.average,
            }
            for r in home.recent
        ],
    }
