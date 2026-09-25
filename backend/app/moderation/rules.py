"""The fast screens: patterns over the text, no model, every message."""

from __future__ import annotations

from app.moderation.base import Category, Decision, Screening
from app.moderation.lexicon import BLOCK, OUTPUT, PERSONAL, REVIEW, SCHOOLWORK, SUPPORT, Rule

REMOVED = "[removed]"
EVIDENCE_CHARS = 80


def _first(rules: tuple[Rule, ...], text: str, redacted: str) -> Screening | None:
    for rule in rules:
        match = rule.pattern.search(text)
        if match:
            return Screening(
                rule.decision,
                redacted,
                category=rule.category,
                rule=rule.name,
                evidence=match.group(0)[:EVIDENCE_CHARS],
            )
    return None


def redact(text: str) -> tuple[str, list[str]]:
    """The text with phone numbers, IC numbers and emails taken out."""
    found: list[str] = []
    for pattern in PERSONAL:
        found.extend(m.group(0) for m in pattern.finditer(text))
        text = pattern.sub(REMOVED, text)
    return text, found


class InputRules:
    """What a student sends. Support first, then refusals; then words that
    might be schoolwork go to the classifier unless they plainly are."""

    name = "rules"

    def screen(self, text: str) -> Screening:
        redacted, personal = redact(text)
        decided = _first(SUPPORT, text, redacted) or _first(BLOCK, text, redacted)
        if decided:
            return decided
        if not SCHOOLWORK.search(text):
            unsure = _first(REVIEW, text, redacted)
            if unsure:
                return unsure
        if personal:
            return Screening(
                Decision.REDACT,
                redacted,
                category=Category.PERSONAL_INFO,
                rule="personal_info",
                evidence=f"{len(personal)} detail(s) removed",
            )
        return Screening.allow(text)


class OutputRules:
    """What the model answered a student. Only plainly unsafe text."""

    name = "output_rules"

    def screen(self, text: str) -> Screening:
        return _first(OUTPUT, text, text) or Screening.allow(text)
