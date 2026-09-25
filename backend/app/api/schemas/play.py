from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.badges.catalog import CATALOG
from app.services.attempt_service import AnswerResult, AttemptView, Played
from app.services.badge_service import Earned
from app.services.leaderboard_service import Board, Entry
from app.services.play_service import Finished
from app.services.student_home_service import TodoCard


class PlayedResponse(BaseModel):
    item_id: str
    choice: int | None
    knew: bool | None
    correct: bool | None
    reveal: dict[str, Any] | None

    @classmethod
    def of(cls, played: Played) -> PlayedResponse:
        return cls(**{f: getattr(played, f) for f in cls.model_fields})


class AttemptResponse(BaseModel):
    id: UUID
    status: str
    number: int
    title: str
    kind: str
    purpose: str
    feedback_mode: str
    assignment_id: UUID | None
    set_id: UUID
    items: list[dict[str, Any]]
    answered: list[PlayedResponse]
    skills: list[dict[str, Any]]
    score: int
    max_score: int
    percent: float
    best_streak: int
    can_retake: bool
    attempts_used: int
    leaderboard: bool
    due_at: datetime | None

    @classmethod
    def of(cls, view: AttemptView) -> AttemptResponse:
        a = view.attempt
        return cls(
            id=a.id,
            status=a.status,
            number=a.number,
            title=view.title,
            kind=view.kind,
            purpose=view.purpose,
            feedback_mode=view.feedback_mode,
            assignment_id=a.assignment_id,
            set_id=a.set_id,
            items=view.items,
            answered=[PlayedResponse.of(p) for p in view.answered],
            skills=view.skills,
            score=a.score if a.status == "completed" or view.feedback_mode == "instant" else 0,
            max_score=a.max_score,
            percent=float(a.percent),
            best_streak=a.best_streak,
            can_retake=view.can_retake,
            attempts_used=view.attempts_used,
            leaderboard=bool(
                view.assignment and view.assignment.leaderboard_enabled and view.kind == "quiz"
            ),
            due_at=view.assignment.due_at if view.assignment else None,
        )


class AnswerRequest(BaseModel):
    item_id: str = Field(max_length=40)
    choice: int | None = Field(default=None, ge=0, le=9)
    knew: bool | None = None
    time_ms: int = Field(default=0, ge=0)


class AnswerResponse(BaseModel):
    played: PlayedResponse
    streak: int
    answered: int
    total: int

    @classmethod
    def of(cls, result: AnswerResult) -> AnswerResponse:
        return cls(
            played=PlayedResponse.of(result.played),
            streak=result.streak,
            answered=result.answered,
            total=result.total,
        )


class BadgeResponse(BaseModel):
    badge: str
    name: str
    description: str
    reason: str

    @classmethod
    def of(cls, earned: Earned) -> BadgeResponse:
        return cls(
            badge=earned.badge,
            name=earned.name,
            description=earned.description,
            reason=earned.reason,
        )


class EntryResponse(BaseModel):
    rank: int
    student_id: UUID
    name: str
    buddy: str | None
    percent: float
    you: bool

    @classmethod
    def of(cls, entry: Entry) -> EntryResponse:
        return cls(
            rank=entry.rank,
            student_id=entry.student_id,
            name=entry.name,
            buddy=entry.buddy,
            percent=entry.percent,
            you=entry.you,
        )


class FinishResponse(BaseModel):
    attempt: AttemptResponse
    stars: int
    skills: list[dict[str, Any]]
    badges: list[BadgeResponse]
    rank: EntryResponse | None
    ranked: int

    @classmethod
    def of(cls, finished: Finished) -> FinishResponse:
        return cls(
            attempt=AttemptResponse.of(finished.view),
            stars=finished.stars,
            skills=[
                {"slug": s.slug, "label": s.label, "correct": s.correct, "total": s.total}
                for s in finished.skills
            ],
            badges=[BadgeResponse.of(b) for b in finished.badges],
            rank=EntryResponse.of(finished.rank) if finished.rank else None,
            ranked=finished.ranked,
        )


class BoardResponse(BaseModel):
    enabled: bool
    final: bool
    entries: list[EntryResponse]
    you: EntryResponse | None
    total: int

    @classmethod
    def of(cls, board: Board) -> BoardResponse:
        return cls(
            enabled=board.enabled,
            final=board.final,
            entries=[EntryResponse.of(e) for e in board.entries],
            you=EntryResponse.of(board.you) if board.you else None,
            total=board.total,
        )


class TodoResponse(BaseModel):
    assignment_id: UUID
    title: str
    kind: str
    class_id: UUID
    class_name: str
    class_theme: str
    item_count: int
    status: str
    best: float | None
    attempts: int
    due_at: datetime | None
    feedback_mode: str
    shared_at: datetime

    @classmethod
    def of(cls, card: TodoCard) -> TodoResponse:
        a = card.assignment
        return cls(
            assignment_id=a.id,
            title=a.title,
            kind=a.kind,
            class_id=a.class_id,
            class_name=card.class_name,
            class_theme=card.class_theme,
            item_count=card.item_count,
            status=card.status,
            best=card.best,
            attempts=card.attempts,
            due_at=a.due_at,
            feedback_mode=a.feedback_mode,
            shared_at=a.created_at,
        )


class EarnedBadge(BaseModel):
    badge: str
    name: str
    description: str
    reason: str
    awarded_at: datetime


class CatalogBadge(BaseModel):
    badge: str
    name: str
    description: str
    hint: str


class BadgesResponse(BaseModel):
    earned: list[EarnedBadge]
    catalog: list[CatalogBadge]


def catalog() -> list[CatalogBadge]:
    return [
        CatalogBadge(badge=i.key, name=i.name, description=i.description, hint=i.hint)
        for i in CATALOG.values()
    ]
