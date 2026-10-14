"""A battle's questions (§28.3.6): from a quiz's questions, or a game's
pairs and Boss Battle questions — as the revision games make them
(`features/game/revision/questions.ts`). Nothing new is written."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any

MOST_QUESTIONS = 12
LEAST_QUESTIONS = 4
# Wrong options beside the right one, at most.
MOST_WRONG = 3


@dataclass(frozen=True, slots=True)
class Question:
    id: str
    ask: str
    options: tuple[str, ...]
    answer: int
    why: str


def battle_questions(kind: str, items: list[dict[str, Any]], *, seed: str) -> list[Question]:
    """Up to `MOST_QUESTIONS`, each asked once, in a shuffled order."""
    rng = random.Random(seed)  # noqa: S311 - variety, not a secret
    if kind == "quiz":
        found = _from_quiz(items)
    else:
        found = [*_from_pairs(items, rng), *_from_bosses(items)]
    seen: set[str] = set()
    unique = []
    for question in found:
        key = question.ask.strip().lower()
        if len(question.options) < 2 or key in seen:
            continue
        seen.add(key)
        unique.append(question)
    rng.shuffle(unique)
    return unique[:MOST_QUESTIONS]


def _from_quiz(items: list[dict[str, Any]]) -> list[Question]:
    return [
        Question(
            id=str(item["id"]),
            ask=str(item["prompt"]),
            options=tuple(str(o) for o in item["options"]),
            answer=int(item["answer"]),
            why=str(item.get("explanation") or ""),
        )
        for item in items
        if _valid(item.get("options"), item.get("answer")) and item.get("prompt")
    ]


def _from_pairs(items: list[dict[str, Any]], rng: random.Random) -> list[Question]:
    pairs = [(item, pair) for item in items for pair in _pairs(item)]
    rights = list(dict.fromkeys(str(pair["right"]) for _, pair in pairs))
    made = []
    for item, pair in pairs:
        right = str(pair["right"])
        others = [r for r in rights if r.lower() != right.lower()]
        options = [right, *rng.sample(others, min(MOST_WRONG, len(others)))]
        rng.shuffle(options)
        made.append(
            Question(
                id=f"{item['id']}:{pair.get('id', len(made))}",
                ask=str(pair["left"]),
                options=tuple(options),
                answer=options.index(right),
                why=str(pair.get("why") or ""),
            )
        )
    return made


def _from_bosses(items: list[dict[str, Any]]) -> list[Question]:
    boss = [
        (item, q)
        for item in items
        if isinstance(item.get("boss"), dict)
        for q in item["boss"].get("questions", [])
        if isinstance(q, dict) and _valid(q.get("options"), q.get("answer"))
    ]
    return [
        Question(
            id=f"{item['id']}:{q.get('id', n)}",
            ask=str(q.get("ask", "")),
            options=tuple(str(o) for o in q["options"]),
            answer=int(q["answer"]),
            why=str(q.get("why") or ""),
        )
        for n, (item, q) in enumerate(boss)
        if q.get("ask")
    ]


def _pairs(item: dict[str, Any]) -> list[dict[str, Any]]:
    match = item.get("match") if isinstance(item.get("match"), dict) else {}
    pairs = match.get("pairs", [])
    return [p for p in pairs if isinstance(p, dict) and p.get("left") and p.get("right")]


def _valid(options: Any, answer: Any) -> bool:
    return (
        isinstance(options, list)
        and isinstance(answer, int)
        and not isinstance(answer, bool)
        and 0 <= answer < len(options)
    )
