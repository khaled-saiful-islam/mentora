"""How an assignment went, for the teacher who shared it — and its leaderboard,
for them and for the students it was shared with."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, SessionDep, require_capability
from app.api.schemas.play import BoardResponse
from app.events.registry import build_bus
from app.services.leaderboard_service import LeaderboardService
from app.services.results_service import ResultsService

router = APIRouter(tags=["results"])
_TEACHERS = [Depends(require_capability("share_learning_sets"))]


@router.get("/assignments/{assignment_id}/results", dependencies=_TEACHERS)
async def assignment_results(
    assignment_id: UUID,
    user: CurrentUser,
    session: SessionDep,
    group_id: UUID | None = Query(default=None),
) -> dict[str, object]:
    found = await ResultsService(session, build_bus()).for_assignment(
        user.id, assignment_id, group_id
    )
    a = found.assignment
    completed = [s for s in found.students if s.status == "completed"]
    return {
        "assignment": {
            "id": a.id,
            "class_id": a.class_id,
            "title": a.title,
            "kind": a.kind,
            "due_at": a.due_at,
            "closed": a.closed_at is not None,
            "leaderboard": a.leaderboard_enabled,
        },
        "summary": {
            "assigned": len(found.students),
            "completed": len(completed),
            "in_progress": sum(1 for s in found.students if s.status == "in_progress"),
            "not_started": sum(1 for s in found.students if s.status == "not_started"),
            "average": found.average,
            "median": found.median,
            "distribution": found.distribution,
        },
        "students": [
            {
                "student_id": s.student_id,
                "name": s.name,
                "buddy": s.buddy,
                "status": s.status,
                "first": s.first,
                "best": s.best,
                "attempts": s.attempts,
                "late": s.late,
                "completed_at": s.completed_at,
                "answered": s.answered,
                "total": s.total,
                "active_at": s.active_at,
            }
            for s in found.students
        ],
        "questions": [_question(q) for q in found.questions],
        "skills": found.skills,
        "heat": found.heat,
    }


def _question(q) -> dict[str, object]:
    return {
        "item_id": q.item_id,
        "prompt": q.prompt,
        "skill": q.skill,
        "answered": q.answered,
        "correct": q.correct,
        "choices": q.choices,
        "answer": q.answer,
    }


@router.get("/assignments/{assignment_id}/results/students/{student_id}", dependencies=_TEACHERS)
async def student_answers(
    assignment_id: UUID, student_id: UUID, user: CurrentUser, session: SessionDep
) -> dict[str, object]:
    found = await ResultsService(session, build_bus()).student_answers(
        user.id, assignment_id, student_id
    )
    by_attempt: dict[UUID, list] = {}
    for answer in found["answers"]:
        by_attempt.setdefault(answer.attempt_id, []).append(
            {
                "item_id": answer.item_id,
                "response": answer.response,
                "correct": answer.correct,
                "time_ms": answer.time_ms,
            }
        )
    return {
        "items": found["items"],
        "attempts": [
            {
                "id": a.id,
                "number": a.number,
                "status": a.status,
                "percent": float(a.percent),
                "completed_at": a.completed_at,
                "answers": by_attempt.get(a.id, []),
            }
            for a in found["attempts"]
        ],
    }


@router.get("/assignments/{assignment_id}/leaderboard", response_model=BoardResponse)
async def leaderboard(assignment_id: UUID, user: CurrentUser, session: SessionDep) -> BoardResponse:
    """The teacher sees everyone; a student sees the top ten and their own row."""
    return BoardResponse.of(
        await LeaderboardService(session, build_bus()).for_viewer(user, assignment_id)
    )
