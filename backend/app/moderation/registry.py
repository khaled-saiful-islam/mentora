"""Who gets which screens.

Students get the whole gate. Teachers and admins get none: a teacher asking
how to talk to a class about self-harm must be answered, not redirected.
The prompt-injection guard (`guards/`) still runs for everyone.
"""

from __future__ import annotations

from app.core.config import Settings
from app.core.grades import grade_label
from app.core.roles import Role
from app.moderation.classifier import ModelClassifier
from app.moderation.gate import ModerationGate
from app.providers.base import LLMProvider


def build_gate(
    settings: Settings, *, role: str, grade_level: str | None, provider: LLMProvider
) -> ModerationGate | None:
    if not settings.moderation_enabled or role != Role.STUDENT.value:
        return None
    classifier = (
        ModelClassifier(provider, timeout=settings.moderation_classifier_timeout)
        if settings.moderation_classifier_enabled
        else None
    )
    return ModerationGate(classifier=classifier, grade_label=grade_label(grade_level))
