"""The learning kinds this build offers. Adding one is one line here."""

from __future__ import annotations

from typing import Any

from app.learning.base import LearningKind
from app.learning.flashcard import FlashcardKind
from app.learning.game import GameKind
from app.learning.quiz import QuizKind
from app.learning.study_guide import StudyGuideKind


def build_learning_kinds() -> dict[str, LearningKind]:
    kinds: list[LearningKind] = [QuizKind(), FlashcardKind(), StudyGuideKind(), GameKind()]
    return {kind.name: kind for kind in kinds}


def switched_on(kind: LearningKind, settings: Any) -> bool:
    """Whether this install offers a kind: one may name the setting that
    turns it off (a game: `games_enabled`)."""
    switch = getattr(kind, "switch", None)
    return not switch or bool(getattr(settings, switch, True))


def leaderboard_mode(kind: str) -> str | None:
    """How a kind's class leaderboard ranks (`quiz.FIRST_TRY`, `quiz.BEST_POINTS`),
    or None for a kind that has none."""
    mode = getattr(build_learning_kinds().get(kind), "leaderboard", None)
    return str(mode) if mode else None


def ranks(kind: str) -> bool:
    return leaderboard_mode(kind) is not None
