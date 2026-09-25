"""A study guide: a topic taught section by section, each ending in a check.

A section is written three times over — simpler, at the level, and a
stretch — so every reader in a class gets the same ideas at a pace that fits
them. Around the teaching sit what makes it stick: key points, the words to
know (with their Malay), a memory trick, a surprising fact, where it shows up
in real life, and a picture. Each section closes with one multiple-choice
check, graded exactly as a quiz question is, which is how reading a guide
becomes progress a teacher can see.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.learning import prompts
from app.learning.base import Graded, Item, Skill, clean_text, new_id, pick_skill, pick_sources
from app.learning.enrich import Finishing, Pictures
from app.learning.model import JsonModel
from app.learning.quiz import DIFFICULTIES, answer_from, options_from

LEVELS = ("simple", "core", "stretch")
PICTURES_PER_SECTION = 4

# Written into and read out of the prompt, so the two cannot drift.
LIMITS = {
    "heading": 90,
    "simple": 900,
    "core": 1600,
    "stretch": 1600,
    "point": 200,
    "term": 60,
    "meaning": 240,
    "hook": 260,
    "fact": 280,
    "example": 400,
    "image_query": 100,
}


class StudyGuideKind:
    name = "study_guide"
    label = "Study guide"
    item_noun = "section"
    item_noun_plural = "sections"
    default_count = 5
    max_count = 8
    # A section is long: two at a time keeps each call inside its budget.
    batch = 2
    draft_tokens = 4200
    item_tokens = 2600
    # Teachers make these; a student's practice stays quizzes and flashcards.
    for_students = False
    # A picture the teacher chose survives the words being rewritten.
    kept_on_rewrite = ("image", "alternatives")

    # --- the item -----------------------------------------------------------

    def normalise(
        self, raw: dict[str, Any], *, skills: tuple[Skill, ...], source_ids: set[str]
    ) -> Item | None:
        heading = clean_text(raw.get("heading") or raw.get("title"), LIMITS["heading"])
        explain = _levels(raw.get("explain"))
        prompt = clean_text(raw.get("prompt") or raw.get("question"), 300)
        options = options_from(raw.get("options"))
        answer = answer_from(raw.get("answer"), options) if options else None
        if None in (heading, explain, prompt, options, answer):
            return None
        difficulty = raw.get("difficulty")
        image = picture_from(raw.get("image"))
        return {
            "id": raw.get("id") if isinstance(raw.get("id"), str) and raw["id"] else new_id(),
            "heading": heading,
            "explain": explain,
            "points": _texts(raw.get("points"), limit=LIMITS["point"], most=5),
            "terms": _terms(raw.get("terms")),
            "hook": clean_text(raw.get("hook"), LIMITS["hook"]) or "",
            "fact": clean_text(raw.get("fact"), LIMITS["fact"]) or "",
            "example": clean_text(raw.get("example"), LIMITS["example"]) or "",
            "image_query": clean_text(raw.get("image_query"), LIMITS["image_query"]) or heading,
            "image": image,
            "alternatives": _alternatives(raw.get("alternatives"), image),
            "prompt": prompt,
            "options": options,
            "answer": answer,
            "explanation": clean_text(raw.get("explanation"), 500) or "",
            "skill": pick_skill(raw.get("skill"), skills),
            "difficulty": difficulty if difficulty in DIFFICULTIES else "medium",
            "source_ids": pick_sources(raw.get("source_ids"), source_ids),
        }

    def public(self, item: Item) -> dict[str, Any]:
        """Everything to read — the check's answer stays behind until it is
        answered, like a quiz's."""
        hidden = {"answer", "explanation", "image_query", "alternatives"}
        return {key: value for key, value in item.items() if key not in hidden}

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
        return prompts.guide_section_rules(LIMITS)

    def summary(self, item: Item) -> str:
        return item["heading"]

    # --- the finishing stage -----------------------------------------------

    async def illustrate(self, items: list[Item], *, topic: str, pictures: Pictures) -> list[Item]:
        async def one(item: Item) -> Item:
            if item.get("image"):
                return item
            query = f"{item.get('image_query') or item['heading']} {topic}"[:140]
            found = await pictures.pictures(query, limit=PICTURES_PER_SECTION)
            if not found:
                return item
            chosen, *rest = [p.as_dict() for p in found]
            return {**item, "image": chosen, "alternatives": rest}

        return list(await asyncio.gather(*(one(item) for item in items)))

    async def wrap(self, model: JsonModel, finishing: Finishing) -> dict[str, Any]:
        system, user = prompts.wrap_guide(
            title=finishing.title,
            topic=finishing.topic,
            grade=finishing.grade,
            language=finishing.language,
            outline="\n".join(
                f"- {item['heading']}: " + "; ".join(item.get("points", [])[:3])
                for item in finishing.items
            ),
        )
        reply = await model.ask("wrap", system, user, temperature=0.6, max_tokens=900)
        return self.normalise_extras(reply)

    def normalise_extras(self, raw: Any) -> dict[str, Any]:
        raw = raw if isinstance(raw, dict) else {}
        challenge = raw.get("challenge") if isinstance(raw.get("challenge"), dict) else {}
        title = clean_text(challenge.get("title"), 120)
        steps = _texts(challenge.get("steps"), limit=220, most=5)
        return {
            "big_question": clean_text(raw.get("big_question"), 200) or "",
            "intro": clean_paragraphs(raw.get("intro"), 700) or "",
            "summary": _texts(raw.get("summary"), limit=220, most=6),
            "challenge": {"title": title, "steps": steps} if title and steps else None,
        }


# --- cleaning ---------------------------------------------------------------


def clean_paragraphs(value: Any, limit: int) -> str | None:
    """Text kept in its paragraphs — each tidied, blank lines between — or
    None when absent or too long. A wall of text is not a page anyone reads."""
    if not isinstance(value, str):
        return None
    paragraphs = [" ".join(part.split()) for part in value.replace("\r", "").split("\n")]
    text = "\n\n".join(p for p in paragraphs if p)
    return text if text and len(text) <= limit else None


def _levels(value: Any) -> dict[str, str] | None:
    """All three levels, or None without the one at the reader's level. A
    missing easier or harder version falls back to it rather than to nothing."""
    if not isinstance(value, dict):
        return None
    core = clean_paragraphs(value.get("core"), LIMITS["core"])
    if core is None:
        return None
    return {
        "simple": clean_paragraphs(value.get("simple"), LIMITS["simple"]) or core,
        "core": core,
        "stretch": clean_paragraphs(value.get("stretch"), LIMITS["stretch"]) or core,
    }


def _texts(value: Any, *, limit: int, most: int) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = [clean_text(v, limit) for v in value]
    return [text for text in cleaned if text][:most]


def _terms(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    terms: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in value:
        if not isinstance(raw, dict):
            continue
        term = clean_text(raw.get("term"), LIMITS["term"])
        meaning = clean_text(raw.get("meaning"), LIMITS["meaning"])
        if not term or not meaning or term.lower() in seen:
            continue
        seen.add(term.lower())
        translation = clean_text(raw.get("translation") or raw.get("malay"), LIMITS["term"])
        same = translation is not None and translation.lower() == term.lower()
        terms.append(
            {"term": term, "meaning": meaning, "translation": "" if same else translation or ""}
        )
    return terms[:5]


def picture_from(value: Any) -> dict[str, str] | None:
    """A picture an editor or a search gave, or None. https only: a guide is
    shown to children, and an image address is the one thing in it a browser
    fetches from somewhere else."""
    if not isinstance(value, dict):
        return None
    image = value.get("image")
    page = value.get("page")
    if not isinstance(image, str) or not image.startswith("https://"):
        return None
    thumbnail = value.get("thumbnail")
    safe_thumbnail = isinstance(thumbnail, str) and thumbnail.startswith("https://")
    safe_page = isinstance(page, str) and page.startswith(("https://", "http://"))
    return {
        "image": image[:2000],
        "thumbnail": (thumbnail if safe_thumbnail else image)[:2000],  # type: ignore[index]
        "page": page[:2000] if safe_page else "",  # type: ignore[index]
        "source": clean_text(value.get("source"), 120) or "",
        "title": clean_text(value.get("title"), 200) or "",
    }


def _alternatives(value: Any, chosen: dict[str, str] | None) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    kept = [p for p in (picture_from(v) for v in value) if p]
    if chosen:
        kept = [p for p in kept if p["image"] != chosen["image"]]
    return kept[:PICTURES_PER_SECTION]
