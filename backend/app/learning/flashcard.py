"""A card: a word or question on the front, what it means on the back."""

from __future__ import annotations

from typing import Any

from app.learning.base import (
    Graded,
    Item,
    Skill,
    clean_text,
    new_id,
    pick_skill,
    pick_sources,
)


class FlashcardKind:
    name = "flashcard"
    label = "Flashcards"
    item_noun = "card"
    item_noun_plural = "cards"
    default_count = 10
    max_count = 40

    def normalise(
        self, raw: dict[str, Any], *, skills: tuple[Skill, ...], source_ids: set[str]
    ) -> Item | None:
        front = clean_text(raw.get("front"), 200)
        back = clean_text(raw.get("back"), 400)
        if front is None or back is None:
            return None
        return {
            "id": raw.get("id") if isinstance(raw.get("id"), str) and raw["id"] else new_id(),
            "front": front,
            "back": back,
            "hint": clean_text(raw.get("hint"), 160) or "",
            "skill": pick_skill(raw.get("skill"), skills),
            "source_ids": pick_sources(raw.get("source_ids"), source_ids),
        }

    def public(self, item: Item) -> dict[str, Any]:
        # A flashcard is self-marked: the student flips it and says whether
        # they knew it, so both sides are theirs to see.
        return {
            "id": item["id"],
            "front": item["front"],
            "back": item["back"],
            "hint": item.get("hint", ""),
            "skill": item["skill"],
        }

    def grade(self, item: Item, response: dict[str, Any]) -> Graded:
        return Graded(correct=response.get("knew") is True, reveal={})

    def writing_rules(self) -> str:
        return (
            "Each card is a JSON object:\n"
            '{"front": "...", "back": "...", "hint": "...", "skill": "<skill slug>", '
            '"source_ids": ["s1"]}\n'
            "- `front` is short: a term, a question or a prompt (under 12 words).\n"
            "- `back` answers it in one or two plain sentences.\n"
            "- `hint` nudges without giving it away, or is empty.\n"
            "- `source_ids` names the sources the back comes from. Use only facts the "
            "sources support."
        )

    def summary(self, item: Item) -> str:
        return item["front"]
