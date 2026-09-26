from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.grades import grade_label
from app.db.models.classroom import ClassInvite
from app.services.class_pulse import NextLive, RecentShare, StudentPulse, TeacherPulse
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


class NextLiveOut(BaseModel):
    id: UUID
    title: str
    scheduled_at: datetime | None
    status: str

    @classmethod
    def of(cls, live: NextLive | None) -> NextLiveOut | None:
        if live is None:
            return None
        return cls(id=live.id, title=live.title, scheduled_at=live.scheduled_at, status=live.status)


class RecentShareOut(BaseModel):
    id: UUID
    title: str
    kind: str
    completed: int
    audience: int
    due_at: datetime | None
    closed: bool

    @classmethod
    def of(cls, share: RecentShare) -> RecentShareOut:
        return cls(
            id=share.id,
            title=share.title,
            kind=share.kind,
            completed=share.completed,
            audience=share.audience,
            due_at=share.due_at,
            closed=share.closed,
        )


class TeacherPulseOut(BaseModel):
    shared: int
    average: float | None
    finished_week: int
    next_live: NextLiveOut | None
    faces: list[str]
    recent: list[RecentShareOut] = []

    @classmethod
    def of(cls, pulse: TeacherPulse) -> TeacherPulseOut:
        return cls(
            shared=pulse.shared,
            average=pulse.average,
            finished_week=pulse.finished_week,
            next_live=NextLiveOut.of(pulse.next_live),
            faces=list(pulse.faces),
            recent=[RecentShareOut.of(r) for r in pulse.recent],
        )


class StudentPulseOut(BaseModel):
    to_do: int
    done: int
    next_live: NextLiveOut | None

    @classmethod
    def of(cls, pulse: StudentPulse) -> StudentPulseOut:
        return cls(to_do=pulse.to_do, done=pulse.done, next_live=NextLiveOut.of(pulse.next_live))


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
    # How it is going: only on the list, where the cards show it.
    pulse: TeacherPulseOut | None = None

    @classmethod
    def of(cls, summary: ClassSummary, pulse: TeacherPulse | None = None) -> ClassResponse:
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
            pulse=TeacherPulseOut.of(pulse) if pulse is not None else None,
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
    # Parents connected to this student, as "Name (Mum)" (§20).
    parents: list[str] = []

    @classmethod
    def of(cls, view: MemberView, parents: list[str] | None = None) -> MemberResponse:
        fields = {f: getattr(view, f) for f in cls.model_fields if f != "parents"}
        return cls(**fields, parents=parents or [])


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
    pulse: StudentPulseOut | None = None

    @classmethod
    def of(cls, view: StudentClassView, pulse: StudentPulse | None = None) -> StudentClassResponse:
        fields = {field: getattr(view, field) for field in cls.model_fields if field != "pulse"}
        return cls(**fields, pulse=StudentPulseOut.of(pulse) if pulse is not None else None)


class StudentClassList(BaseModel):
    items: list[StudentClassResponse]
