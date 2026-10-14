"""What a second chance asks the model for (§28.3.7): a question explained at
a reading level with one worked example, and — only when no question like it
can be found — one new question on the same skill.

Each reply is checked for shape and length like any generated item. A model
that will not answer gives None, and the caller says so kindly.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from app.learning.base import Item, clean_text
from app.learning.model import GenerationUnavailable, JsonModel
from app.learning.quiz import answer_from, options_from

logger = logging.getLogger(__name__)

LEVELS = ("simple", "core", "stretch")
LANGUAGES = {"en": "English", "ms": "Malay (Bahasa Melayu)"}
LIMITS = {"why": 450, "problem": 260, "step": 220, "answer": 140, "remember": 180, "twin": 500}
STEPS = (2, 4)

HOW = {
    "simple": (
        "Write for a child who found this hard: very short sentences, everyday "
        "words, one idea at a time. Make the example smaller and easier than the question."
    ),
    "core": (
        "Write for a child in {grade}: clear, friendly and short. Make the example "
        "about as hard as the question."
    ),
    "stretch": (
        "Write for a child in {grade} who is ready for more: say briefly why the idea "
        "works, one step deeper than the question, and make the example a little harder."
    ),
}

SYSTEM = """You are a kind, patient tutor for Malaysian school children. A child
just got a question wrong. Help them see why the right answer is right, then
walk through one worked example so they can try again. Never make the child
feel bad. Everything must be accurate and suitable for a child.
Reply with one JSON object and nothing else."""

EXPLAIN = """The question: {prompt}
The options: {options}
The right answer: {answer}
{note}
{how}
Write in {language}. The example must be a NEW one, not the same question.

Return:
{{
  "why": "why the right answer is right, in 1 to 3 short sentences",
  "example": {{
    "problem": "a new example like the question",
    "steps": ["2 to 4 short steps that work it out, without saying the answer"],
    "answer": "the example's answer"
  }},
  "remember": "one short thing to remember next time"
}}"""

TWIN_SYSTEM = """You write multiple-choice questions for Malaysian school
children: accurate, clear and suitable for a child.
Reply with one JSON object and nothing else."""

TWIN = """Write ONE new question that tests the same skill as this one, about
as hard, with different numbers or words and a different right answer: not
the same question reworded.

The question: {prompt}
The options: {options}
The right answer: {answer}
The skill: {skill}
For a child in {grade}. Write in {language}.

Return:
{{"prompt": "...", "options": ["...", "...", "...", "..."], "answer": 0,
  "explanation": "why the right answer is right, in one or two sentences"}}"""


def item_key(item: Item) -> str:
    """The question itself — words, options, answer — so a copy of it in a
    Daily Quest or a later version is the same question."""
    shape = [item.get("prompt"), item.get("options"), item.get("answer")]
    return hashlib.sha256(json.dumps(shape, ensure_ascii=False).encode()).hexdigest()


def _facts(item: Item) -> dict[str, str]:
    options = [str(o) for o in item.get("options") or []]
    answer = item.get("answer")
    right = options[answer] if isinstance(answer, int) and 0 <= answer < len(options) else ""
    return {"prompt": str(item.get("prompt", "")), "options": " | ".join(options), "answer": right}


async def write_explanation(
    model: JsonModel, item: Item, *, level: str, grade: str, language: str
) -> dict[str, Any] | None:
    note = str(item.get("explanation") or "")
    user = EXPLAIN.format(
        **_facts(item),
        note=f"The teacher's note: {note}" if note else "",
        how=HOW[level].format(grade=grade),
        language=LANGUAGES.get(language, LANGUAGES["en"]),
    )
    try:
        reply = await model.ask(
            "second chance: explain", SYSTEM, user, temperature=0.4, max_tokens=700
        )
    except GenerationUnavailable:
        logger.info("no explanation written at level %s", level)
        return None
    return cleaned_explanation(reply)


def cleaned_explanation(reply: dict[str, Any]) -> dict[str, Any] | None:
    why = clean_text(reply.get("why"), LIMITS["why"])
    raw = reply.get("example") if isinstance(reply.get("example"), dict) else {}
    problem = clean_text(raw.get("problem"), LIMITS["problem"])
    answer = clean_text(raw.get("answer"), LIMITS["answer"])
    listed = raw.get("steps") if isinstance(raw.get("steps"), list) else []
    steps = [s for s in (clean_text(x, LIMITS["step"]) for x in listed) if s]
    if not why or not problem or not answer or len(steps) < STEPS[0]:
        return None
    return {
        "why": why,
        "example": {"problem": problem, "steps": steps[: STEPS[1]], "answer": answer},
        "remember": clean_text(reply.get("remember"), LIMITS["remember"]),
    }


async def write_twin(
    model: JsonModel, item: Item, *, skill: str, grade: str, language: str
) -> dict[str, Any] | None:
    user = TWIN.format(
        **_facts(item),
        skill=skill,
        grade=grade,
        language=LANGUAGES.get(language, LANGUAGES["en"]),
    )
    try:
        reply = await model.ask(
            "second chance: one like it", TWIN_SYSTEM, user, temperature=0.7, max_tokens=500
        )
    except GenerationUnavailable:
        logger.info("no question like it was written")
        return None
    return cleaned_twin(reply, not_like=str(item.get("prompt", "")))


def cleaned_twin(reply: dict[str, Any], *, not_like: str) -> dict[str, Any] | None:
    prompt = clean_text(reply.get("prompt") or reply.get("question"), 300)
    options = options_from(reply.get("options"))
    if prompt is None or options is None or prompt.lower() == " ".join(not_like.split()).lower():
        return None
    answer = answer_from(reply.get("answer"), options)
    if answer is None:
        return None
    return {
        "prompt": prompt,
        "options": options,
        "answer": answer,
        "explanation": clean_text(reply.get("explanation"), LIMITS["twin"]) or "",
    }
