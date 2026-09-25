"""Sharing a set with a class or its groups, and managing what was shared."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, SessionDep, require_capability
from app.api.schemas.learning import (
    AssignmentList,
    AssignmentResponse,
    ShareRequest,
    UpdateAssignmentRequest,
)
from app.events.registry import build_bus
from app.services.assignment_service import AssignmentService, ShareSettings

router = APIRouter(
    prefix="/assignments",
    tags=["assignments"],
    dependencies=[Depends(require_capability("share_learning_sets"))],
)


def _service(session) -> AssignmentService:
    return AssignmentService(session, build_bus())


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def share(body: ShareRequest, user: CurrentUser, session: SessionDep) -> AssignmentResponse:
    settings = ShareSettings(
        group_ids=tuple(body.group_ids),
        feedback_mode=body.feedback_mode,
        due_at=body.due_at,
        allow_retakes=body.allow_retakes,
        max_attempts=body.max_attempts,
        shuffle_questions=body.shuffle_questions,
        shuffle_options=body.shuffle_options,
        leaderboard_enabled=body.leaderboard_enabled,
    )
    view = await _service(session).share(user, body.set_id, body.class_id, settings)
    return AssignmentResponse.of(view)


@router.get("", response_model=AssignmentList)
async def for_class(
    class_id: UUID = Query(), *, user: CurrentUser, session: SessionDep
) -> AssignmentList:
    found = await _service(session).for_class(user.id, class_id)
    return AssignmentList(items=[AssignmentResponse.of(v) for v in found])


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def read(assignment_id: UUID, user: CurrentUser, session: SessionDep) -> AssignmentResponse:
    return AssignmentResponse.of(await _service(session).get(user.id, assignment_id))


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
async def update(
    assignment_id: UUID, body: UpdateAssignmentRequest, user: CurrentUser, session: SessionDep
) -> AssignmentResponse:
    view = await _service(session).update(
        user.id, assignment_id, due_at=body.due_at, clear_due=body.clear_due, closed=body.closed
    )
    return AssignmentResponse.of(view)
