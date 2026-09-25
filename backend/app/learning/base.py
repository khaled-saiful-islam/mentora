"""The contract every learning kind keeps."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

Item = dict[str, Any]


@dataclass(frozen=True, slots=True)
class Skill:
    """A subtopic an item practises. Results are reported per skill, which
    is where "strong at X, keep practising Y" comes from."""

    slug: str
    label: str

    def as_dict(self) -> dict[str, str]:
        return {"slug": self.slug, "label": self.label}


@dataclass(frozen=True, slots=True)
class Graded:
    correct: bool
    # What to show once answered: the right answer and why. Empty for kinds
    # with nothing to reveal.
    reveal: dict[str, Any]


@runtime_checkable
class LearningKind(Protocol):
    name: str
    label: str
    item_noun: str
    item_noun_plural: str
    default_count: int
    max_count: int

    def normalise(
        self, raw: dict[str, Any], *, skills: tuple[Skill, ...], source_ids: set[str]
    ) -> Item | None:
        """A clean item from what a model or an editor wrote, or None when it
        cannot be made into one. Repairs what is safely repairable (an unknown
        skill, a stray source id); refuses what is not (three options)."""
        ...

    def public(self, item: Item) -> dict[str, Any]:
        """What a student sees before answering. Never the answer."""
        ...

    def grade(self, item: Item, response: dict[str, Any]) -> Graded:
        """Mark a response. A malformed one is wrong, never an error."""
        ...

    def writing_rules(self) -> str:
        """For the model: the JSON shape of one item and the rules it obeys."""
        ...

    def summary(self, item: Item) -> str:
        """One line, for de-duplication prompts and logs."""
        ...


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def clean_text(value: Any, limit: int) -> str | None:
    """Whitespace-normalised text within `limit`, or None if absent or too long."""
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    if not text or len(text) > limit:
        return None
    return text


def pick_skill(value: Any, skills: tuple[Skill, ...]) -> str:
    slugs = [s.slug for s in skills]
    if isinstance(value, str):
        wanted = value.strip().lower()
        for skill in skills:
            if wanted in (skill.slug, skill.label.lower()):
                return skill.slug
    return slugs[0] if slugs else "general"


def pick_sources(value: Any, known: set[str]) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if str(v) in known][:4]
