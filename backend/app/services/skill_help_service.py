"""Help at home (§28.3.3): a skill a child finds hard, explained for their
parent in plain words, with one example and a five-minute activity to do
together away from the screen — in English or Malay.

Written by the generation model the first time anyone asks for that skill,
year and language, then kept (`skill_help`). Checked for shape and length
like any generated item; a model that will not answer is said plainly.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UpstreamError, ValidationError
from app.core.grades import grade_for
from app.db.models.skill_help import SkillHelp
from app.learning.base import clean_text
from app.learning.model import GenerationUnavailable, JsonModel

logger = logging.getLogger(__name__)

LANGUAGES = {"en": "English", "ms": "Malay (Bahasa Melayu)"}
LIMITS = {"meaning": 400, "example": 300, "title": 80, "need": 60, "step": 220}
MOST_NEEDS = 5
STEPS = (2, 5)
MINUTES = (3, 10)
UNWRITTEN = "Help at home could not be written just now. Try again soon."

SYSTEM = """You help Malaysian parents help their child at home. Write warmly
and simply for a busy parent who is not a teacher: short sentences, everyday
words, no jargon. Everything must be accurate and suitable for a child.
Reply with one JSON object and nothing else."""

USER = """A child in {grade} finds this skill hard: "{label}" ({subject}).
Write in {language}.

"needs" lists only objects a parent can pick up (a plate, coins, a cup of water,
kuih), never air, time or ideas.

Return:
{{
  "meaning": "what this skill is, in 2 short sentences a parent understands",
  "example": "one worked example with real numbers or words, in 1-2 sentences",
  "activity": {{
    "title": "a short name for something to do together",
    "minutes": 5,
    "needs": ["1 to 4 real things found in any Malaysian home, and every thing the steps use"],
    "steps": ["3 or 4 short steps, each one thing to do or say, with no screen"]
  }}
}}"""


@dataclass(frozen=True, slots=True)
class Help:
    meaning: str
    example: str
    activity: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return {"meaning": self.meaning, "example": self.example, "activity": self.activity}


class SkillHelpService:
    def __init__(self, session: AsyncSession, model: Callable[[], JsonModel]) -> None:
        self._session = session
        # Built only when the help is not kept yet.
        self._model = model

    async def help(
        self, *, subject: str, slug: str, label: str, grade: str | None, language: str
    ) -> Help:
        if language not in LANGUAGES:
            raise ValidationError("Help at home is in English or Malay.")
        key = (subject[:80], slug[:80], (grade or "")[:32], language)
        kept = await self._kept(*key)
        if kept is not None:
            return kept
        written = await self._write(subject=subject, label=label, grade=grade, language=language)
        await self._keep(key, label, written)
        return written

    async def _kept(self, subject: str, slug: str, grade: str, language: str) -> Help | None:
        row = await self._session.scalar(
            select(SkillHelp).where(
                SkillHelp.subject == subject,
                SkillHelp.slug == slug,
                SkillHelp.grade == grade,
                SkillHelp.language == language,
            )
        )
        return Help(row.meaning, row.example, dict(row.activity)) if row else None

    async def _write(self, *, subject: str, label: str, grade: str | None, language: str) -> Help:
        year = grade_for(grade)
        user = USER.format(
            grade=year.label if year else "primary school",
            label=label,
            subject=subject,
            language=LANGUAGES[language],
        )
        try:
            reply = await self._model().ask(
                "help at home", SYSTEM, user, temperature=0.5, max_tokens=900
            )
        except GenerationUnavailable as exc:
            raise UpstreamError(UNWRITTEN) from exc
        found = cleaned(reply)
        if found is None:
            raise UpstreamError(UNWRITTEN)
        return found

    async def _keep(self, key: tuple[str, str, str, str], label: str, written: Help) -> None:
        subject, slug, grade, language = key
        try:
            async with self._session.begin_nested():
                self._session.add(
                    SkillHelp(
                        subject=subject,
                        slug=slug,
                        label=label[:120],
                        grade=grade,
                        language=language,
                        meaning=written.meaning,
                        example=written.example,
                        activity=written.activity,
                    )
                )
        except IntegrityError:
            # Another parent asked at the same moment: theirs is kept.
            logger.info("skill help for %s/%s was written twice at once", subject, slug)


def cleaned(reply: dict[str, Any]) -> Help | None:
    """The help as a parent will read it, or None if the reply will not do."""
    meaning = clean_text(reply.get("meaning"), LIMITS["meaning"])
    example = clean_text(reply.get("example"), LIMITS["example"])
    raw = reply.get("activity") if isinstance(reply.get("activity"), dict) else {}
    title = clean_text(raw.get("title"), LIMITS["title"])
    steps = [s for s in (clean_text(x, LIMITS["step"]) for x in _listed(raw.get("steps"))) if s]
    needs = [n for n in (clean_text(x, LIMITS["need"]) for x in _listed(raw.get("needs"))) if n]
    if not meaning or not example or not title or not STEPS[0] <= len(steps):
        return None
    minutes = raw.get("minutes")
    minutes = minutes if isinstance(minutes, int) and MINUTES[0] <= minutes <= MINUTES[1] else 5
    activity = {
        "title": title,
        "minutes": minutes,
        "needs": needs[:MOST_NEEDS],
        "steps": steps[: STEPS[1]],
    }
    return Help(meaning, example, activity)


def _listed(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []
