"""Live tutoring sessions: a teacher's lesson for one group, taught aloud by the
AI tutor (PLAN.md §19).

A session is set up, its lesson written and reviewed part by part, its voice
recorded, and then scheduled — which is when the group's students see it.
The settings are a frozen copy of what the teacher chose, so a template
edited later never changes a session already made from it.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at, uuid_pk

# draft → planning → planned → recording → approved → scheduled → lobby → live → ended
# (or failed while planning; cancelled at any point before it ends).
SESSION_STATUSES = (
    "draft",
    "planning",
    "planned",
    "failed",
    "recording",
    "approved",
    "scheduled",
    "lobby",
    "live",
    "ended",
    "cancelled",
)
# What the students of the group can see: it is on their schedule.
VISIBLE_TO_STUDENTS = ("scheduled", "lobby", "live", "ended")


def _fk(target: str, ondelete: str = "CASCADE", nullable: bool = False) -> Mapped[Any]:
    return mapped_column(
        PGUUID(as_uuid=True), ForeignKey(target, ondelete=ondelete), nullable=nullable
    )


class LiveSession(Base):
    __tablename__ = "live_sessions"

    id: Mapped[uuid.UUID] = uuid_pk()
    teacher_id: Mapped[uuid.UUID] = _fk("users.id")
    class_id: Mapped[uuid.UUID] = _fk("classes.id")
    group_id: Mapped[uuid.UUID] = _fk("class_groups.id")
    template_id: Mapped[uuid.UUID | None] = _fk(
        "live_session_templates.id", ondelete="SET NULL", nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    # Why planning failed, in words a teacher can act on.
    failure: Mapped[str | None] = mapped_column(Text)
    # Where the lesson is: {"segment": n, "beat": n, "sentence": n}. Written as
    # it moves, so a restart resumes rather than starting over.
    position: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The reminders already sent, by name, so none is ever sent twice.
    reminders_sent: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The quiz made from the lesson afterwards, and its sharing with the group.
    quiz_set_id: Mapped[uuid.UUID | None] = _fk(
        "learning_sets.id", ondelete="SET NULL", nullable=True
    )
    assignment_id: Mapped[uuid.UUID | None] = _fk(
        "assignments.id", ondelete="SET NULL", nullable=True
    )
    # A student reported something; the teacher and admins can see it.
    flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (
        Index("ix_live_sessions_teacher", "teacher_id", "created_at"),
        Index("ix_live_sessions_group", "group_id", "scheduled_at"),
        Index("ix_live_sessions_due", "status", "scheduled_at"),
    )


class LiveSessionDocument(Base):
    """A teacher's reference file. Kept as its text, like a chat's files."""

    __tablename__ = "live_session_documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = _fk("live_sessions.id")
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at()

    __table_args__ = (Index("ix_live_session_documents_session", "session_id"),)


class LiveSegment(Base):
    """One part of the lesson, a minute or two long, said as beats."""

    __tablename__ = "live_segments"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = _fk("live_sessions.id")
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    subtopic: Mapped[str] = mapped_column(String(160), nullable=False)
    # The subtopic as a skill, so the quiz's results land under it.
    skill: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    # [{id, say, show, pause, sentences}] — see app/live/beats.py.
    beats: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    key_points: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    # A quick question for the room at the end of the part, or none.
    checkin: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # A picture on screen while the part is taught: {image, thumbnail, page, source, title}.
    image: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    target_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (UniqueConstraint("session_id", "position", name="uq_live_segments_position"),)


class LiveSessionTemplate(Base):
    """A teacher's setup, kept to start the next session from."""

    __tablename__ = "live_session_templates"

    id: Mapped[uuid.UUID] = uuid_pk()
    teacher_id: Mapped[uuid.UUID] = _fk("users.id")
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    __table_args__ = (Index("ix_live_session_templates_teacher", "teacher_id"),)


class LiveParticipant(Base):
    """A student in the room: when they first came, when last seen, how long."""

    __tablename__ = "live_participants"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    first_joined_at: Mapped[datetime] = created_at()
    last_seen_at: Mapped[datetime] = created_at()
    seconds_present: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Taken out of the room by the teacher; they cannot come back in.
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LiveHand(Base):
    """A raised hand, and what became of it."""

    __tablename__ = "live_hands"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = _fk("live_sessions.id")
    student_id: Mapped[uuid.UUID] = _fk("users.id")
    # queued · called · answered · redirected · dismissed · lowered · missed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    via: Mapped[str] = mapped_column(String(8), nullable=False, default="text")
    question: Mapped[str | None] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    raised_at: Mapped[datetime] = created_at()
    called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_live_hands_session", "session_id", "raised_at"),)


class LiveTranscriptLine(Base):
    """What was said, in order: the tutor's sentences and students' questions."""

    __tablename__ = "live_transcript"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = _fk("live_sessions.id")
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    # tutor · student · system
    speaker: Mapped[str] = mapped_column(String(8), nullable=False)
    student_id: Mapped[uuid.UUID | None] = _fk("users.id", ondelete="SET NULL", nullable=True)
    segment_id: Mapped[uuid.UUID | None] = _fk(
        "live_segments.id", ondelete="SET NULL", nullable=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[datetime] = created_at()

    __table_args__ = (Index("ix_live_transcript_session", "session_id", "seq"),)


class LiveCheckinAnswer(Base):
    """One student's answer to a quick check."""

    __tablename__ = "live_checkin_answers"

    segment_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("live_segments.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    session_id: Mapped[uuid.UUID] = _fk("live_sessions.id")
    choice: Mapped[int] = mapped_column(Integer, nullable=False)
    correct: Mapped[bool] = mapped_column(nullable=False)
    answered_at: Mapped[datetime] = created_at()
