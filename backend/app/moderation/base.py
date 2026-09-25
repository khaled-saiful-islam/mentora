"""What a screen decides, and the protocol a screen implements.

A screen reads a piece of text and says what should happen to it. It does not
act: the chat decides what a block looks like and who is told, which is what
lets the same screens run over a student's message, the model's answer, and
a topic someone asked to make a quiz on.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol, runtime_checkable


class Decision(StrEnum):
    ALLOW = "allow"
    # Allowed, with personal details taken out first.
    REDACT = "redact"
    # Could be either — a school question or not. The classifier decides.
    REVIEW = "review"
    BLOCK = "block"
    # A student who may be at risk. Answered with care, and flagged for a person.
    SUPPORT = "support"


class Category(StrEnum):
    NONE = "none"
    SELF_HARM = "self_harm"
    ABUSE = "abuse"
    BULLYING = "bullying"
    SEXUAL = "sexual"
    WEAPONS = "weapons"
    VIOLENCE = "violence"
    DRUGS = "drugs"
    GAMBLING = "gambling"
    PROFANITY = "profanity"
    PERSONAL_INFO = "personal_info"
    SENSITIVE = "sensitive"
    UNSAFE = "unsafe"


SEVERITY: dict[Decision, str] = {
    Decision.SUPPORT: "high",
    Decision.BLOCK: "medium",
    Decision.REVIEW: "low",
    Decision.REDACT: "low",
    Decision.ALLOW: "none",
}


@dataclass(frozen=True, slots=True)
class Screening:
    decision: Decision
    # The text to use from here on: the input, or the input with personal
    # details removed.
    text: str
    category: Category = Category.NONE
    rule: str = ""
    # What matched, truncated — so a person reviewing can judge it.
    evidence: str = ""
    screen: str = "rules"

    @classmethod
    def allow(cls, text: str) -> Screening:
        return cls(Decision.ALLOW, text)

    @property
    def severity(self) -> str:
        return SEVERITY[self.decision]

    @property
    def acted(self) -> bool:
        return self.decision is not Decision.ALLOW


EXCERPT_CHARS = 500


@dataclass(frozen=True, slots=True)
class Flag:
    """One thing a check did, ready to be logged."""

    kind: str  # held | support | redacted | retracted | injection | topic_refused
    source: str  # user_input | model_output | web_search | document | generation
    severity: str
    category: str = Category.NONE.value
    rule: str = ""
    screen: str = ""
    excerpt: str = ""
    findings: tuple[dict[str, str], ...] = ()

    @classmethod
    def of(cls, kind: str, source: str, screening: Screening, excerpt: str) -> Flag:
        return cls(
            kind=kind,
            source=source,
            severity="low" if screening.severity == "none" else screening.severity,
            category=screening.category.value,
            rule=screening.rule,
            screen=screening.screen,
            excerpt=excerpt[:EXCERPT_CHARS],
            findings=({"rule": screening.rule, "evidence": screening.evidence},),
        )


KIND_FOR: dict[Decision, str] = {
    Decision.BLOCK: "held",
    Decision.SUPPORT: "support",
    Decision.REDACT: "redacted",
}


@runtime_checkable
class Screen(Protocol):
    """Fast and local: patterns, lists. Runs on every message."""

    name: str

    def screen(self, text: str) -> Screening: ...


@runtime_checkable
class Classifier(Protocol):
    """Slower and smarter: asked only about text a Screen could not decide."""

    name: str

    async def classify(self, text: str, grade_label: str | None) -> Screening: ...
