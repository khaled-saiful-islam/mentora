"""What makes every game end well and start its own way (§26.8), whatever
the writer did: a Boss Battle made from the game's own pairs when it wrote
none, an opening picked at random, and a character's name from many — so no
two games open alike, and not every character is called Amir.
"""

from __future__ import annotations

import random
import re
from collections.abc import Sequence
from typing import Any

from app.learning.base import Item, new_id
from app.learning.game_rounds import BOSS_QUESTIONS, CHOICES, rounds_of

# How a game opens: `features/game/openings`.
STARTS = ("comic", "call", "letter", "news", "postcard")
# The years a Boss Battle is too much for.
NO_BOSS = {"year_1", "year_2"}
MOST_QUESTIONS = 6

# A boss for each world: a nuisance, never a fright.
BOSSES = {
    "rainforest": ("The Gloomy Haze", "🌫️"),
    "reef": ("Captain Muddle", "🦑"),
    "kampung": ("The Mischief Monkey", "🐒"),
    "city": ("The Traffic Jam Giant", "🚧"),
    "space": ("The Muddle Meteor", "☄️"),
}
# The words of a boss made from pairs, in the game's language.
WORDS = {
    "en": {
        "ask": 'What goes with "{left}"?',
        "learn": "Everything you learnt on the map, all together.",
        "task": "Beat the boss with everything you learnt!",
        "explanation": "You used every idea on the map to win!",
    },
    "ms": {
        "ask": 'Apakah pasangan "{left}"?',
        "learn": "Semua yang kamu pelajari di peta, bersama-sama.",
        "task": "Kalahkan bos dengan semua yang kamu pelajari!",
        "explanation": "Kamu menggunakan setiap idea di peta untuk menang!",
    },
}
# Names for a game's main character, from across Malaysia: the writer is
# offered a few, so characters are not all called the same.
NAMES = (
    "Aiman", "Nur Aisyah", "Haziq", "Farah", "Pak Hamid", "Mak Cik Rosnah", "Atuk Daud",
    "Cikgu Zainab", "Mei Ling", "Wei Jie", "Uncle Lim", "Auntie Siew Lan", "Kavitha",
    "Arjun", "Uncle Raju", "Priya", "Jaimie", "Dayang", "Awang", "Bah Sali", "Melati",
    "Hui Min", "Nadia", "Ravi", "Iskandar", "Sofea", "Daniel", "Ahmad",
)  # fmt: skip
_WORD = re.compile(r"[a-z0-9]+")
_COMMON = {
    "the", "and", "a", "an", "of", "to", "is", "are", "in", "on", "for", "it", "its", "you",
    "your", "can", "with", "that", "this", "they", "their", "be", "by", "as", "at", "or",
}  # fmt: skip
# Two ideas are one when this share of their words, and at least `SHARED`
# words, are the same: "plants need water" and "plants need light" are two.
SAME_IDEA = 0.7
SHARED = 3


def opening() -> str:
    return random.choice(STARTS)  # noqa: S311 - a game's look, not a secret


def names() -> list[str]:
    return random.sample(NAMES, 4)


def same_idea(one: str, other: str) -> bool:
    """Two islands' ideas said nearly alike: most of their words shared —
    "find a common denominator first", twice."""
    a, b = _content(one), _content(other)
    if not a or not b:
        return False
    return len(a & b) >= SHARED and len(a & b) / len(a | b) >= SAME_IDEA


def _content(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if w not in _COMMON and len(w) > 2}


# Say It is for the youngest readers, in the languages the ear knows (§28.3.5).
SAY_YEARS = {"year_1", "year_2", "year_3"}
SAY_LANGUAGES = {"en", "ms"}


def say_for_young(items: list[Item], *, grade: str | None, language: str, task: str) -> list[Item]:
    """`items`, a Say It played as its Match Up — with `task`, since its own
    asks for reading aloud — where it doesn't belong: past Year 3, in another
    language, or for a year not known."""
    if grade in SAY_YEARS and language in SAY_LANGUAGES:
        return items
    return [
        {**item, "play": "match", "task": task}
        if item.get("play") == "say" and item.get("match")
        else item
        for item in items
    ]


def with_boss(
    items: list[Item], *, world: str, language: str, grade: str | None, plays: Sequence[str],
    most: int,
) -> list[Item]:  # fmt: skip
    """`items` ending with a Boss Battle: theirs if they have one; else one
    made from their pairs — unless the maker left Boss Battles out, the year
    is too young, or there are too few pairs to ask about."""
    wanted = not plays or "boss" in plays
    if any(i.get("play") == "boss" for i in items) or not wanted or grade in NO_BOSS:
        return items
    if len(items) >= most:
        return items
    boss = _boss_from_pairs(items, world=world, language=language)
    return [*items, boss] if boss else items


def _boss_from_pairs(items: list[Item], *, world: str, language: str) -> Item | None:
    pairs = [(item, pair) for item in items for pair in _pairs(item)]
    rights = list(dict.fromkeys(pair["right"] for _, pair in pairs))
    if len(rights) < CHOICES[0]:
        return None
    words = WORDS.get(language, WORDS["en"])
    # Seeded by the islands, so the same game makes the same boss.
    rng = random.Random(" ".join(item["id"] for item in items))  # noqa: S311 - not a secret
    picked = _spread(pairs, MOST_QUESTIONS, rng)
    questions = [_question(pair, rights, words, rng) for _, pair in picked]
    name, icon = BOSSES.get(world, BOSSES["rainforest"])
    boss = rounds_of({"boss": {"name": name, "icon": icon, "questions": questions}}, "")
    if "boss" not in boss or len(boss["boss"]["questions"]) < BOSS_QUESTIONS[0]:
        return None
    return {
        "id": new_id(),
        "learn": words["learn"],
        "icon": icon,
        "play": "boss",
        "task": words["task"],
        "boss": boss["boss"],
        "explanation": words["explanation"],
        "hint": "",
        "skill": items[-1].get("skill", "general"),
        "difficulty": "hard",
        "source_ids": sorted({s for item in items for s in item.get("source_ids", [])})[:4],
    }


def _pairs(item: Item) -> list[dict[str, Any]]:
    match = item.get("match") if isinstance(item.get("match"), dict) else {}
    return [p for p in match.get("pairs", []) if isinstance(p, dict)]


def _spread(pairs: list[tuple[Item, dict[str, Any]]], most: int, rng: random.Random) -> list:
    """Up to `most` pairs, taken from every island in turn."""
    by_island: dict[str, list] = {}
    for item, pair in pairs:
        by_island.setdefault(item["id"], []).append((item, pair))
    queues = [rng.sample(group, len(group)) for group in by_island.values()]
    picked: list = []
    while len(picked) < most and any(queues):
        for queue in queues:
            if queue and len(picked) < most:
                picked.append(queue.pop())
    return picked


def _question(
    pair: dict[str, Any], rights: list[str], words: dict[str, str], rng: random.Random
) -> dict[str, Any]:
    wrong = rng.sample(
        [r for r in rights if r != pair["right"]], min(CHOICES[1] - 1, len(rights) - 1)
    )
    options = rng.sample([pair["right"], *wrong], len(wrong) + 1)
    return {
        "ask": words["ask"].format(left=pair["left"]),
        "options": options,
        "answer": options.index(pair["right"]),
        "why": pair.get("why", ""),
    }
