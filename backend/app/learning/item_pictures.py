"""A photograph beside a question, for children still learning to read.

Year 1–3 play with pictures (docs/features/045-question-pictures.md). A
model that can see the answer key writes one short search per item, for a
photo of what the question is *about* — never of the answer, never one that
makes a choice look right — or nothing, when a photo would not help or would
give it away. Each search then goes through the same looked-at pictures a
study guide gets (`JudgedPictures`): only a clear, child-safe fit is kept.
None fits, none is shown.

A question gets two more guards, because a picture that shows the answer
turns a quiz into a picture-matching game: a search that names any of the
choices is refused outright, and the picture found is shown to the vision
model with the question and its right answer, and dropped unless it says the
picture gives nothing away.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any, Protocol

from app.core.grades import Grade
from app.learning import prompts
from app.learning.base import Item
from app.learning.model import JsonModel
from app.learning.picture_check import Pictures
from app.learning.research import Picture, host_of
from app.learning.study_guide import picture_from

logger = logging.getLogger(__name__)

KINDS = ("quiz", "flashcard")
# Pictures looked at per search: a spare, for when the best gives it away.
CANDIDATES = 2
MAX_SEARCH_CHARS = 80
_SEARCH_WORDS = re.compile(r"[^\w\s'-]", re.UNICODE)

_SYSTEM = (
    prompts.VOICE + "\n\nYou choose photographs for young children (Year 1 to 3) who are still "
    "learning to read. A photo beside a question helps them see what it is about.\n"
    "For each item, write one short image search (3 to 7 words, in English) for a "
    "real photograph of the thing the question or card is about — something a "
    "young child would recognise.\n"
    "Rules:\n"
    "- For a question, the photo must not show the right answer or any of the "
    "choices, and the search must not name them. Asked which animal eats grass, "
    "search for a grassy field, not a cow. Asked which living thing in a padi "
    "field is the producer, where the answer is the padi plant, leave it empty: "
    "any padi field photo shows the answer.\n"
    "- For a card, show the front's word or idea.\n"
    '- Leave it empty ("") when a photo would not help — numbers, sums, '
    "spelling, grammar, feelings, ideas you cannot photograph — or when any "
    "fitting photo would give the answer away.\n"
    "- No faces of real people, no brands, no text or labelled diagrams.\n"
    'Reply with JSON only: {"pictures": [{"id": "...", "search": "..."}]}'
)


def item_key(item: Item) -> str:
    """What an item shows, hashed — so an edit that changes it is looked at again."""
    shown = {k: item.get(k) for k in ("prompt", "options", "answer", "front", "back")}
    return hashlib.sha256(json.dumps(shown, sort_keys=True).encode()).hexdigest()


def _line(item: Item) -> str:
    if "options" in item:
        options = item.get("options") or []
        return (
            f"{item['id']} | question: {item.get('prompt', '')} | "
            f"choices: {' / '.join(options)} | right answer: {right_answer(item)}"
        )
    return f"{item['id']} | card front: {item.get('front', '')} | back: {item.get('back', '')}"


_FILLER = frozenset({"the", "and", "with", "from", "that", "this", "all", "none", "both", "above"})


def _singular(word: str) -> str:
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("ies"):
        return f"{word[:-3]}y"
    return word.removesuffix("s")


def _stems(text: str) -> set[str]:
    """Words worth comparing, a plural treated as its singular."""
    return {_singular(w) for w in re.findall(r"[a-z]{3,}", text.lower())} - _FILLER


def names_a_choice(search: str, item: Item) -> bool:
    """Whether a question's search mentions any of its choices."""
    said = _stems(search)
    return any(said & _stems(str(option)) for option in item.get("options") or [])


def right_answer(item: Item) -> str:
    options = item.get("options") or []
    answer = item.get("answer")
    return str(options[answer]) if isinstance(answer, int) and 0 <= answer < len(options) else ""


class Looks(Protocol):
    async def look(self, picture: Picture, question: str) -> str | None: ...


class SpoilerCheck:
    """Asks a vision model whether a picture would help a child pick the
    answer. Anything but a clear "no" counts as yes."""

    def __init__(self, eyes: Looks) -> None:
        self._eyes = eyes

    async def safe(self, picture: Picture, item: Item) -> bool:
        question = (
            "This picture will be shown beside a quiz question for young children.\n"
            f"Question: {item.get('prompt', '')}\n"
            f"Choices: {' / '.join(str(o) for o in item.get('options') or [])}\n"
            f"Right answer: {right_answer(item)}\n\n"
            "Would seeing the picture help a child pick an answer — because it shows "
            "the right answer, or shows one of the choices, or its words name one? "
            'Reply with JSON only: {"gives_away": true or false, "why": "a few words"}'
        )
        reply = await self._eyes.look(picture, question)
        match = re.search(r"\{.*\}", reply or "", re.DOTALL)
        try:
            raw = json.loads(match.group(0)) if match else None
        except json.JSONDecodeError:
            raw = None
        return isinstance(raw, dict) and raw.get("gives_away") is False


def searches_from(raw: Any, ids: set[str]) -> dict[str, str]:
    """The model's reply as one clean search per known item; empty for none."""
    rows = raw.get("pictures") if isinstance(raw, dict) else None
    found: dict[str, str] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict) or row.get("id") not in ids:
            continue
        search = _SEARCH_WORDS.sub(" ", str(row.get("search") or ""))
        found[row["id"]] = " ".join(search.split())[:MAX_SEARCH_CHARS]
    return found


def shown(picture: Picture, query: str) -> dict[str, str] | None:
    """What is kept and later shown: https only (`picture_from`), with the
    search as its description. The page's title and the search's snippet are
    dropped — either can name the answer — so the credit is the site alone."""
    kept = picture_from(picture.as_dict())
    if kept is None:
        return None
    return {
        **kept,
        "title": "",
        "source": host_of(kept["page"]) if kept["page"] else "",
        "alt": query,
    }


class ItemPictureFinder:
    def __init__(
        self, model: JsonModel, pictures: Pictures, spoilers: SpoilerCheck | None = None
    ) -> None:
        self._model = model
        self._pictures = pictures
        self._spoilers = spoilers

    async def searches(
        self, items: list[Item], *, topic: str, grade: Grade | None
    ) -> dict[str, str]:
        user = f"{prompts.audience(grade, 'en')}\nTopic: {topic}\n\nItems:\n" + "\n".join(
            _line(item) for item in items
        )
        reply = await self._model.ask(
            "pictures", _SYSTEM, user, temperature=0.3, max_tokens=60 * len(items) + 200
        )
        return searches_from(reply, {item["id"] for item in items})

    async def picture(self, search: str, item: Item) -> dict[str, str] | None:
        """The best looked-at picture for an item's search, or None."""
        question = "options" in item
        if not search or (question and names_a_choice(search, item)):
            return None
        for found in await self._pictures.pictures(search, limit=CANDIDATES):
            kept = shown(found, search)
            if kept is None:
                continue
            if question and not (self._spoilers and await self._spoilers.safe(found, item)):
                logger.info("picture for %s would give the answer away", item.get("id"))
                continue
            return kept
        return None
