from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.grades import grade_label
from app.db.models.classroom import ClassInvite
from app.services.class_service import ClassSummary
from app.services.group_service import GroupView
from app.services.invite_service import InvitePreview
from app.services.membership_service import MemberView, StudentClassView


class CreateClassRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    subject: str | None = Field(default=None, max_length=80)
    grade_level: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    theme: str = Field(default="grape", max_length=16)


class UpdateClassRequest(BaseModel):
    """Send only what changes; an explicit null clears an optional field."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    subject: str | None = Field(default=None, max_length=80)
    grade_level: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    theme: str | None = Field(default=None, max_length=16)


class ClassResponse(BaseModel):
    id: UUID
    name: str
    subject: str | None
    grade_level: str | None
    grade_label: str | None
    description: str | None
    theme: str
    archived: bool
    students: int
    pending: int
    groups: int
    created_at: datetime

    @classmethod
    def of(cls, summary: ClassSummary) -> ClassResponse:
        room = summary.classroom
        return cls(
            id=room.id,
            name=room.name,
            subject=room.subject,
            grade_level=room.grade_level,
            grade_label=grade_label(room.grade_level),
            description=room.description,
            theme=room.theme,
            archived=room.archived_at is not None,
            students=summary.students,
            pending=summary.pending,
            groups=summary.groups,
            created_at=room.created_at,
        )


class ClassList(BaseModel):
    items: list[ClassResponse]


class InviteResponse(BaseModel):
    token: str
    code: str
    enabled: bool
    expires_at: datetime | None
    # The path a student opens; the browser prefixes its own origin.
    path: str

    @classmethod
    def of(cls, invite: ClassInvite) -> InviteResponse:
        return cls(
            token=invite.token,
            code=invite.code,
            enabled=invite.enabled,
            expires_at=invite.expires_at,
            path=f"/join/{invite.token}",
        )


class ConfigureInviteRequest(BaseModel):
    enabled: bool | None = None
    expires_at: datetime | None = None
    clear_expiry: bool = False


class MemberResponse(BaseModel):
    membership_id: UUID
    student_id: UUID
    name: str
    username: str | None
    grade_label: str | None
    buddy: str | None
    status: str
    requested_at: datetime

    @classmethod
    def of(cls, view: MemberView) -> MemberResponse:
        return cls(**{field: getattr(view, field) for field in cls.model_fields})


class MemberList(BaseModel):
    items: list[MemberResponse]
    total: int
    limit: int
    offset: int


class ApprovedCount(BaseModel):
    approved: int


class GroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    colour: str = Field(default="sky", max_length=16)


class UpdateGroupRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    colour: str | None = Field(default=None, max_length=16)


class GroupMembersRequest(BaseModel):
    student_ids: list[UUID] = Field(max_length=500)


class GroupResponse(BaseModel):
    id: UUID
    name: str
    colour: str
    member_ids: list[UUID]

    @classmethod
    def of(cls, view: GroupView) -> GroupResponse:
        return cls(
            id=view.group.id,
            name=view.group.name,
            colour=view.group.colour,
            member_ids=view.member_ids,
        )


class GroupList(BaseModel):
    items: list[GroupResponse]


class InvitePreviewResponse(BaseModel):
    class_id: UUID
    class_name: str
    subject: str | None
    grade_label: str | None
    theme: str
    teacher_name: str

    @classmethod
    def of(cls, preview: InvitePreview) -> InvitePreviewResponse:
        return cls(**{field: getattr(preview, field) for field in cls.model_fields})


class JoinResponse(BaseModel):
    # "requested" | "pending" | "member"
    status: str
    invite: InvitePreviewResponse


class StudentClassResponse(BaseModel):
    class_id: UUID
    class_name: str
    subject: str | None
    theme: str
    teacher_name: str
    status: str
    groups: list[str]

    @classmethod
    def of(cls, view: StudentClassView) -> StudentClassResponse:
        return cls(**{field: getattr(view, field) for field in cls.model_fields})


class StudentClassList(BaseModel):
    items: list[StudentClassResponse]
