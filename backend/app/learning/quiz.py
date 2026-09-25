"""Multiple choice: one question, four options, one right answer."""

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

OPTIONS = 4
DIFFICULTIES = ("easy", "medium", "hard")


class QuizKind:
    name = "quiz"
    label = "Quiz"
    item_noun = "question"
    item_noun_plural = "questions"
    default_count = 10
    max_count = 30

    def normalise(
        self, raw: dict[str, Any], *, skills: tuple[Skill, ...], source_ids: set[str]
    ) -> Item | None:
        prompt = clean_text(raw.get("prompt") or raw.get("question"), 300)
        options = _options(raw.get("options"))
        if prompt is None or options is None:
            return None
        answer = _answer(raw.get("answer"), options)
        if answer is None:
            return None
        difficulty = raw.get("difficulty")
        return {
            "id": raw.get("id") if isinstance(raw.get("id"), str) and raw["id"] else new_id(),
            "prompt": prompt,
            "options": options,
            "answer": answer,
            "explanation": clean_text(raw.get("explanation"), 500) or "",
            "skill": pick_skill(raw.get("skill"), skills),
            "difficulty": difficulty if difficulty in DIFFICULTIES else "medium",
            "source_ids": pick_sources(raw.get("source_ids"), source_ids),
        }

    def public(self, item: Item) -> dict[str, Any]:
        return {
            "id": item["id"],
            "prompt": item["prompt"],
            "options": list(item["options"]),
            "skill": item["skill"],
            "difficulty": item.get("difficulty", "medium"),
        }

    def grade(self, item: Item, response: dict[str, Any]) -> Graded:
        choice = response.get("choice")
        correct = (
            isinstance(choice, int) and not isinstance(choice, bool) and choice == item["answer"]
        )
        return Graded(
            correct=correct,
            reveal={"answer": item["answer"], "explanation": item.get("explanation", "")},
        )

    def writing_rules(self) -> str:
        return (
            "Each question is a JSON object:\n"
            '{"prompt": "...", "options": ["...", "...", "...", "..."], "answer": 0, '
            '"explanation": "...", "skill": "<skill slug>", "difficulty": "easy|medium|hard", '
            '"source_ids": ["s1"]}\n'
            "- Exactly 4 options, all different, all plausible; exactly one is right.\n"
            "- `answer` is the index (0-3) of the right option. Vary its position.\n"
            "- `explanation` says in one or two sentences why the answer is right.\n"
            "- `source_ids` names the sources the answer comes from. Use only facts "
            "the sources support.\n"
            "- Never 'all of the above' or 'none of the above'. No trick questions."
        )

    def summary(self, item: Item) -> str:
        return item["prompt"]


def _options(value: Any) -> list[str] | None:
    if not isinstance(value, list) or len(value) != OPTIONS:
        return None
    options = [clean_text(v, 160) for v in value]
    if any(o is None for o in options):
        return None
    if len({o.lower() for o in options}) != OPTIONS:  # type: ignore[union-attr]
        return None
    return options  # type: ignore[return-value]


def _answer(value: Any, options: list[str]) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and 0 <= value < OPTIONS:
        return value
    if isinstance(value, str):
        text = value.strip().lower()
        for index, option in enumerate(options):
            if option.lower() == text:
                return index
    return None
