"""Everything that can happen, as data.

Each event carries what its subscribers need to react without a lookup —
names as they were at the moment it happened, which is also what a
notification should say even if the class is renamed later.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.events.base import Event


@dataclass(frozen=True, slots=True)
class MembershipRequested(Event):
    membership_id: UUID
    class_id: UUID
    class_name: str
    teacher_id: UUID
    student_id: UUID
    student_name: str
    grade_label: str | None


@dataclass(frozen=True, slots=True)
class MembershipApproved(Event):
    membership_id: UUID
    class_id: UUID
    class_name: str
    teacher_id: UUID
    teacher_name: str
    student_id: UUID


@dataclass(frozen=True, slots=True)
class MembershipRejected(Event):
    membership_id: UUID
    class_id: UUID
    teacher_id: UUID
    student_id: UUID


@dataclass(frozen=True, slots=True)
class MembershipEnded(Event):
    """A student left, or their teacher removed them."""

    membership_id: UUID
    class_id: UUID
    teacher_id: UUID
    student_id: UUID
    how: str  # "revoked" | "left"


@dataclass(frozen=True, slots=True)
class AssignmentShared(Event):
    assignment_id: UUID
    title: str
    kind: str
    class_id: UUID
    class_name: str
    teacher_id: UUID
    teacher_name: str
    student_ids: tuple[UUID, ...]
    due_at: str | None


@dataclass(frozen=True, slots=True)
class AttemptCompleted(Event):
    attempt_id: UUID
    student_id: UUID
    student_name: str
    set_id: UUID
    title: str
    kind: str
    percent: float
    # Null for practice, which nobody else is told about.
    assignment_id: UUID | None = None
    teacher_id: UUID | None = None
    class_name: str | None = None
    audience: tuple[UUID, ...] = ()
    leaderboard: bool = False


@dataclass(frozen=True, slots=True)
class BadgeAwarded(Event):
    student_id: UUID
    badge: str
    name: str
    reason: str


@dataclass(frozen=True, slots=True)
class StudentNeedsSupport(Event):
    """A student said something that suggests they may be at risk."""

    event_id: UUID
    student_id: UUID
    student_name: str
    category: str
