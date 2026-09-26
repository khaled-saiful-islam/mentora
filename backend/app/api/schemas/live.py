"""Shapes of the live-session API."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.db.models.live import LiveSegment, LiveSession, LiveSessionDocument, LiveSessionTemplate
from app.live.settings import Difficulty, SessionSettings
from app.services.live_session_service import SessionView

Line = Annotated[str, StringConstraints(max_length=600)]


class CreateSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_id: UUID
    group_id: UUID
    settings: SessionSettings
    template_id: UUID | None = None


class UpdateSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    settings: SessionSettings


class BreakdownRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    topic: str = Field(min_length=2, max_length=160)
    grade_level: str
    difficulty: Difficulty = "intermediate"
    session_id: UUID | None = None


class BeatEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    say: Line
    show: Annotated[str, StringConstraints(max_length=240)] | None = None
    pause: Literal["short", "breath", "think"] = "breath"


class CheckinEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Annotated[str, StringConstraints(min_length=3, max_length=200)]
    options: list[Annotated[str, StringConstraints(min_length=1, max_length=120)]] = Field(
        min_length=2, max_length=4
    )
    answer: int = Field(ge=0, le=3)
    explanation: Annotated[str, StringConstraints(max_length=240)] = ""


class SegmentEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[str, StringConstraints(min_length=1, max_length=160)] | None = None
    beats: list[BeatEdit] | None = Field(default=None, min_length=1, max_length=20)
    key_points: list[Annotated[str, StringConstraints(max_length=90)]] | None = Field(
        default=None, max_length=5
    )
    checkin: CheckinEdit | None = None
    remove_checkin: bool = False
    remove_image: bool = False


class RewriteSegment(BaseModel):
    instruction: Annotated[str, StringConstraints(max_length=300)] = ""


class ScheduleRequest(BaseModel):
    # None means now.
    at: datetime | None = None


class TemplateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    settings: SessionSettings


class TemplateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(min_length=1, max_length=120)] | None = None
    settings: SessionSettings | None = None


def session_summary(view: SessionView) -> dict[str, Any]:
    live = view.session
    return {
        "id": str(live.id),
        "title": live.title,
        "status": live.status,
        "failure": live.failure,
        "class_id": str(live.class_id),
        "class_name": view.class_name,
        "group_id": str(live.group_id),
        "group_name": view.group_name,
        "students": view.students,
        "parts": view.segments,
        "subject": live.settings.get("subject"),
        "grade_level": live.settings.get("grade_level"),
        "duration_minutes": live.settings.get("duration_minutes"),
        "scheduled_at": live.scheduled_at.isoformat() if live.scheduled_at else None,
        "started_at": live.started_at.isoformat() if live.started_at else None,
        "ended_at": live.ended_at.isoformat() if live.ended_at else None,
        "flagged": live.flagged_at is not None,
        "teacher_name": view.teacher_name,
        "created_at": live.created_at.isoformat(),
    }


def segment_out(segment: LiveSegment) -> dict[str, Any]:
    return {
        "id": str(segment.id),
        "position": segment.position,
        "subtopic": segment.subtopic,
        "skill": segment.skill,
        "title": segment.title,
        "beats": segment.beats,
        "key_points": segment.key_points,
        "checkin": segment.checkin,
        "image": segment.image,
        "target_seconds": segment.target_seconds,
        "status": segment.status,
    }


def document_out(document: LiveSessionDocument) -> dict[str, Any]:
    return {
        "id": str(document.id),
        "filename": document.filename,
        "size_bytes": document.size_bytes,
        "words": len(document.text.split()),
        "created_at": document.created_at.isoformat(),
    }


def template_out(template: LiveSessionTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "name": template.name,
        "settings": template.settings,
        "updated_at": template.updated_at.isoformat(),
    }


def session_detail(
    view: SessionView,
    segments: list[LiveSegment],
    documents: list[LiveSessionDocument],
    voice: dict[str, Any],
) -> dict[str, Any]:
    live: LiveSession = view.session
    return {
        **session_summary(view),
        "settings": live.settings,
        "segments": [segment_out(s) for s in segments],
        "documents": [document_out(d) for d in documents],
        "voice": voice,
    }
