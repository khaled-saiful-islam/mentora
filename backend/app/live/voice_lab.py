"""The voice lab: one real part of a lesson and one raised hand, end to end.

Before a single live session is built, the tutor has to *sound like a
teacher* (PLAN.md §19.0). This is where that is judged: the same script
writing, speakability check, beats, recording and answer streaming that a live
session will use, on a topic the teacher picks, so what is heard here is what
students will hear.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from app.core.grades import Grade
from app.learning.model import JsonModel
from app.live import prompts
from app.live.answering import Answerer, is_praise
from app.live.beats import Beat, beats_from, spoken_seconds
from app.live.lines import Lines, lines_for
from app.live.speakability import problems
from app.live.speakable import speakable
from app.moderation.gate import ModerationGate
from app.providers.base import LLMProvider

# Re-exported: the lab's callers and tests reach them here.
__all__ = ["Lesson", "LessonUnavailable", "Lines", "VoiceLab", "is_praise", "lines_for"]

logger = logging.getLogger(__name__)

LESSON_SECONDS = 90


class LessonUnavailable(RuntimeError):
    """The lesson could not be written — the model failed or wrote nothing usable."""


@dataclass(frozen=True, slots=True)
class Lesson:
    title: str
    beats: tuple[Beat, ...]
    recap: str
    seconds: float
    # What the speakability check still found after the repair, if anything.
    problems: tuple[str, ...]


class VoiceLab:
    def __init__(self, model: JsonModel, chat: LLMProvider, gate: ModerationGate) -> None:
        self._model = model
        self._answerer = Answerer(chat, gate)

    async def lesson(self, topic: str, grade: Grade | None, students: list[str]) -> Lesson:
        system = prompts.lesson_system()
        reply = await self._model.ask(
            "live.lesson",
            system,
            prompts.lesson_user(topic, grade, students, LESSON_SECONDS),
            temperature=0.7,
            max_tokens=2200,
        )
        beats = beats_from(reply.get("beats") or [])
        found = problems(beats, target_seconds=LESSON_SECONDS, students=students)
        if found and beats:
            logger.info("live.lesson: repairing %d problems", len(found))
            repaired = await self._model.ask(
                "live.repair",
                system,
                prompts.repair_user(json.dumps(reply, ensure_ascii=False), found),
                temperature=0.5,
                max_tokens=2200,
            )
            better = beats_from(repaired.get("beats") or [])
            if better:
                reply, beats = repaired, better
                found = problems(beats, target_seconds=LESSON_SECONDS, students=students)
        if not beats:
            raise LessonUnavailable("The lesson could not be written. Try again in a moment.")
        return Lesson(
            title=_text(reply.get("title"), topic)[:120],
            beats=tuple(beats),
            recap=speakable(_text(reply.get("recap"), "")),
            seconds=round(spoken_seconds(beats), 1),
            problems=tuple(found),
        )

    async def answer(
        self,
        *,
        question: str,
        student: str,
        topic: str,
        grade: Grade | None,
        taught: list[str],
    ) -> AsyncIterator[dict[str, Any]]:
        """The tutor's spoken answer, one screened sentence at a time."""
        async for event in self._answerer.answer(
            question=question,
            topic=topic,
            grade=grade,
            taught=taught,
            student=student,
            redirect=lines_for(student).redirect,
        ):
            yield event

    async def warm(self, *, topic: str, grade: Grade | None, taught: list[str]) -> None:
        await self._answerer.warm(topic=topic, grade=grade, taught=taught)


def _text(value: Any, fallback: str) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else fallback
