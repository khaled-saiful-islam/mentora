from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class SkillTally:
    skill: str
    correct: int
    total: int
    sets: int


@dataclass(frozen=True, slots=True)
class Context:
    """Everything a rule may look at, gathered once after an attempt."""

    kind: str
    purpose: str  # assign | practice
    percent: float
    best_streak: int
    number: int
    first_percent: float | None
    completed_at: datetime
    due_at: datetime | None
    scope: str  # the assignment id, or the set id for practice
    practice_completed: int
    skills: tuple[SkillTally, ...] = field(default_factory=tuple)
    assignment_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class Award:
    badge: str
    scope: str
    reason: str


class BadgeRule(Protocol):
    key: str
    name: str
    description: str
    hint: str

    def evaluate(self, ctx: Context) -> Award | None: ...
