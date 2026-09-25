"""One student's screens, in order: rules, then the classifier for what the
rules could not decide; and the output rules over the answer.

Every screen is allowed to fail. A screen that throws is logged and skipped —
a broken check is a worse check, not a broken turn.
"""

from __future__ import annotations

import logging

from app.moderation.base import Classifier, Decision, Screen, Screening
from app.moderation.rules import InputRules, OutputRules

logger = logging.getLogger(__name__)

# What a message needs to be kept from the model altogether.
HOLDS = frozenset({Decision.BLOCK, Decision.SUPPORT})


class ModerationGate:
    def __init__(
        self,
        *,
        inputs: tuple[Screen, ...] = (InputRules(),),
        outputs: tuple[Screen, ...] = (OutputRules(),),
        classifier: Classifier | None = None,
        grade_label: str | None = None,
    ) -> None:
        self._inputs = inputs
        self._outputs = outputs
        self._classifier = classifier
        self._grade = grade_label

    async def check_input(self, text: str) -> Screening:
        screening = _run(self._inputs, text)
        if screening.decision is not Decision.REVIEW:
            return screening
        if self._classifier is None:
            return Screening(Decision.ALLOW, screening.text, screening.category, screening.rule)
        try:
            return await self._classifier.classify(screening.text, self._grade)
        except Exception:  # noqa: BLE001 — see the module docstring
            logger.exception("moderation classifier failed")
            return Screening(Decision.ALLOW, screening.text, screening.category, screening.rule)

    def check_output(self, text: str) -> Screening:
        return _run(self._outputs, text)


def _run(screens: tuple[Screen, ...], text: str) -> Screening:
    """The first screen that acts, carrying any redaction forward."""
    current = text
    redaction: Screening | None = None
    for screen in screens:
        try:
            screening = screen.screen(current)
        except Exception:  # noqa: BLE001 — see the module docstring
            logger.exception("moderation screen %s failed", getattr(screen, "name", screen))
            continue
        if screening.decision is Decision.REDACT:
            redaction, current = screening, screening.text
        elif screening.acted:
            return screening
    return redaction or Screening.allow(current)
