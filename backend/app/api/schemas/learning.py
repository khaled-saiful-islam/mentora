from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.grades import grade_label
from app.services.assignment_service import AssignmentView
from app.services.learning_set_service import SetView


class GenerateRequest(BaseModel):
    kind: str = Field(max_length=32)
    topic: str = Field(min_length=2, max_length=200)
    subject: str | None = Field(default=None, max_length=80)
    grade_level: str | None = Field(default=None, max_length=32)
    count: int | None = Field(default=None, ge=1, le=50)
    language: str = Field(default="en", max_length=8)


class SetSummary(BaseModel):
    id: UUID
    kind: str
    purpose: str
    title: str
    subject: str | None
    topic: str
    grade_level: str | None
    grade_label: str | None
    language: str
    status: str
    failure: str | None
    item_count: int
    requested_count: int
    version: int
    grounded: bool
    shares: int
    archived: bool
    updated_at: datetime

    @classmethod
    def of(cls, view: SetView) -> SetSummary:
        s, v = view.learning_set, view.version
        return cls(
            id=s.id,
            kind=s.kind,
            purpose=s.purpose,
            title=s.title,
            subject=s.subject,
            topic=s.topic,
            grade_level=s.grade_level,
            grade_label=grade_label(s.grade_level),
            language=s.language,
            status=s.status,
            failure=s.failure,
            item_count=len(v.items) if v else 0,
            requested_count=s.requested_count,
            version=s.current_version,
            grounded=v.grounded if v else True,
            shares=view.shares,
            archived=s.archived_at is not None,
            updated_at=s.updated_at,
        )


class SetDetail(SetSummary):
    items: list[dict[str, Any]]
    skills: list[dict[str, Any]]
    sources: list[dict[str, Any]]
    extras: dict[str, Any]

    @classmethod
    def of(cls, view: SetView) -> SetDetail:  # type: ignore[override]
        v = view.version
        return cls(
            **SetSummary.of(view).model_dump(),
            items=list(v.items) if v else [],
            skills=list(v.skills) if v else [],
            sources=list(v.sources) if v else [],
            extras=dict(v.extras or {}) if v else {},
        )


class SetList(BaseModel):
    items: list[SetSummary]
    total: int
    limit: int
    offset: int


class EditSetRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    items: list[dict[str, Any]] | None = Field(default=None, max_length=50)
    # A study guide's opening and ending. Cleaned by the kind; ignored by a
    # kind without any.
    extras: dict[str, Any] | None = None


class RewriteRequest(BaseModel):
    instruction: str = Field(default="", max_length=300)


class AddItemRequest(BaseModel):
    instruction: str = Field(min_length=2, max_length=300)


class RewriteResponse(BaseModel):
    item: dict[str, Any]


class ShareRequest(BaseModel):
    set_id: UUID
    class_id: UUID
    group_ids: list[UUID] = Field(default_factory=list, max_length=50)
    feedback_mode: str = Field(default="instant", max_length=16)
    due_at: datetime | None = None
    allow_retakes: bool = False
    max_attempts: int | None = Field(default=None, ge=1, le=20)
    shuffle_questions: bool = False
    shuffle_options: bool = True
    leaderboard_enabled: bool = True


class UpdateAssignmentRequest(BaseModel):
    due_at: datetime | None = None
    clear_due: bool = False
    closed: bool | None = None


class AssignmentResponse(BaseModel):
    id: UUID
    set_id: UUID
    version: int
    class_id: UUID
    class_name: str
    title: str
    kind: str
    group_names: list[str]
    audience: int
    feedback_mode: str
    shuffle_questions: bool
    shuffle_options: bool
    allow_retakes: bool
    max_attempts: int | None
    leaderboard_enabled: bool
    due_at: datetime | None
    closed: bool
    created_at: datetime

    @classmethod
    def of(cls, view: AssignmentView) -> AssignmentResponse:
        a = view.assignment
        return cls(
            id=a.id,
            set_id=a.set_id,
            version=a.version,
            class_id=a.class_id,
            class_name=view.class_name,
            title=a.title,
            kind=a.kind,
            group_names=view.group_names,
            audience=view.audience,
            feedback_mode=a.feedback_mode,
            shuffle_questions=a.shuffle_questions,
            shuffle_options=a.shuffle_options,
            allow_retakes=a.allow_retakes,
            max_attempts=a.max_attempts,
            leaderboard_enabled=a.leaderboard_enabled,
            due_at=a.due_at,
            closed=a.closed_at is not None,
            created_at=a.created_at,
        )


class AssignmentList(BaseModel):
    items: list[AssignmentResponse]
