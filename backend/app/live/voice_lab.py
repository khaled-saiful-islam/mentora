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
import random
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from app.core.grades import Grade
from app.learning.model import JsonModel
from app.live import prompts
from app.live.beats import Beat, beats_from, spoken_seconds
from app.live.sentences import SentenceStream
from app.live.speakability import problems
from app.live.speakable import speakable
from app.moderation.base import Decision
from app.moderation.gate import ModerationGate
from app.providers.base import (
    ChatMessage,
    ChatRequest,
    LLMProvider,
    ProviderError,
    Role,
    TokenEvent,
)

logger = logging.getLogger(__name__)

LESSON_SECONDS = 90
ANSWER_MAX_TOKENS = 400
# Screened decisions that keep a question out of the room.
_KEEP_OUT = frozenset({Decision.BLOCK, Decision.SUPPORT, Decision.REVIEW})


_PRAISE = re.compile(
    r"\b(?:great|good|brilliant|fantastic|excellent|interesting|smart|lovely|wonderful"
    r"|awesome|clever|nice|super|amazing|love|thoughtful|curious)\b"
)
_ABOUT_ASKING = re.compile(
    r"\b(?:question|ask|asked|asking|think|thinking|thought|idea|wonder|point|one)\b"
)


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


@dataclass(frozen=True, slots=True)
class Lines:
    """What the tutor says to one student, recorded before anyone asks."""

    call: str
    thanks: str
    redirect: str


def lines_for(name: str, *, rng: random.Random | None = None) -> Lines:
    pick = (rng or random).choice
    return Lines(
        call=pick(prompts.CALL_ON).format(name=name),
        thanks=pick(prompts.THANKS).format(name=name),
        redirect=prompts.REDIRECT.format(name=name),
    )


class VoiceLab:
    def __init__(self, model: JsonModel, chat: LLMProvider, gate: ModerationGate) -> None:
        self._model = model
        self._chat = chat
        self._gate = gate

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
        screening = await self._gate.check_input(question)
        if screening.decision in _KEEP_OUT:
            yield {"type": "redirect", "text": lines_for(student).redirect}
            yield {"type": "done"}
            return
        request = _answer_request(
            self._chat, topic, grade, taught, f"{student} asks: {screening.text}"
        )
        try:
            async for sentence in _without_praise(_sentences(self._chat.stream_chat(request))):
                said = self._screened(sentence)
                if said is None:
                    yield _bridge()
                    break
                yield {"type": "sentence", "text": said}
        except ProviderError:
            logger.warning("live.answer: the model failed mid-answer", exc_info=True)
            yield _bridge()
        yield {"type": "done"}

    async def warm(self, *, topic: str, grade: Grade | None, taught: list[str]) -> None:
        """Send the answer's prompt ahead, while a hand is up, so the real question
        meets a warm model. Measured on ILMU: a cold question waited about three
        seconds for its first word, a warm one about a quarter of a second. Only a
        *streamed* request warms it — a one-token `complete` returns at once and
        leaves the next question just as cold — and it takes those three seconds
        itself, which the tutor finishing its sentence and the student typing hide."""
        request = _answer_request(self._chat, topic, grade, taught, "Ready?", max_tokens=1)
        try:
            async for _ in self._chat.stream_chat(request):
                pass
        except ProviderError:
            # Only ever an optimisation; the answer will simply start slower.
            logger.info("live.warm: the model could not be warmed", exc_info=True)

    def _screened(self, sentence: str) -> str | None:
        # Speech cannot be taken back, so each sentence is checked before it
        # is recorded, not after the answer has been heard.
        screening = self._gate.check_output(sentence)
        if screening.decision is not Decision.ALLOW:
            logger.info("live.answer: a sentence was held back (%s)", screening.category)
            return None
        return speakable(sentence)


def _answer_request(
    chat: LLMProvider,
    topic: str,
    grade: Grade | None,
    taught: list[str],
    question: str,
    *,
    max_tokens: int = ANSWER_MAX_TOKENS,
) -> ChatRequest:
    # The system prompt is the same for every question in a lesson, so the
    # warm-up and the answer share a prefix the provider can cache.
    return ChatRequest(
        messages=(
            ChatMessage(Role.SYSTEM, prompts.answer_system(topic, grade, "\n".join(taught))),
            ChatMessage(Role.USER, question),
        ),
        model=chat.info.model,
        temperature=0.6,
        max_tokens=max_tokens,
        stream=True,
    )


async def _without_praise(sentences: AsyncIterator[str]) -> AsyncIterator[str]:
    """Drop an opening "What a brilliant question!" — the student has already
    been thanked by name, and a second compliment sounds like a script."""
    first = True
    async for sentence in sentences:
        if first and is_praise(sentence):
            first = False
            continue
        first = False
        yield sentence


def is_praise(sentence: str) -> bool:
    lowered = sentence.lower()
    return (
        len(lowered.split()) <= 16
        and bool(_PRAISE.search(lowered))
        and bool(_ABOUT_ASKING.search(lowered))
    )


async def _sentences(events: AsyncIterator[Any]) -> AsyncIterator[str]:
    stream = SentenceStream()
    async for event in events:
        if isinstance(event, TokenEvent):
            for sentence in stream.feed(event.text):
                yield sentence
    for sentence in stream.flush():
        yield sentence


def _bridge() -> dict[str, Any]:
    return {"type": "sentence", "text": "Okay, let's get back to where we were.", "last": True}


def _text(value: Any, fallback: str) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else fallback
