"""The learning kinds this build offers. Adding one is one line here."""

from __future__ import annotations

from app.learning.base import LearningKind
from app.learning.flashcard import FlashcardKind
from app.learning.quiz import QuizKind
from app.learning.study_guide import StudyGuideKind


def build_learning_kinds() -> dict[str, LearningKind]:
    kinds: list[LearningKind] = [QuizKind(), FlashcardKind(), StudyGuideKind()]
    return {kind.name: kind for kind in kinds}
