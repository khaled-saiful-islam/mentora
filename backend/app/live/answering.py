"""Answering a raised hand, out loud, for the whole room.

The question is screened first — kept out of the room, never read aloud, if it
cannot be answered there. The answer streams from the model; each sentence is
screened before it is spoken (speech cannot be taken back), an opening
compliment is dropped (the student was already thanked by name), and a model
that fails mid-answer ends on a bridge back to the lesson, never on silence.
"""

from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterator
from typing import Any

from app.core.grades import Grade
from app.live import prompts
from app.live.sentences import SentenceStream
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

ANSWER_MAX_TOKENS = 400
BRIDGE = "So, let's go back to where we were."
# Screened decisions that keep a question out of the room.
KEEP_OUT = frozenset({Decision.BLOCK, Decision.SUPPORT, Decision.REVIEW})

_PRAISE = re.compile(
    r"\b(?:great|good|brilliant|fantastic|excellent|interesting|smart|lovely|wonderful"
    r"|awesome|clever|nice|super|amazing|love|thoughtful|curious)\b"
)
_ABOUT_ASKING = re.compile(
    r"\b(?:question|ask|asked|asking|think|thinking|thought|idea|wonder|point|one)\b"
)


class Answerer:
    def __init__(self, chat: LLMProvider, gate: ModerationGate) -> None:
        self._chat = chat
        self._gate = gate

    async def answer(
        self,
        *,
        question: str,
        student: str,
        topic: str,
        grade: Grade | None,
        taught: list[str],
        redirect: str,
    ) -> AsyncIterator[dict[str, Any]]:
        """Events: `sentence` … then `done`; or `redirect` (with why) then `done`."""
        screening = await self._gate.check_input(question)
        if screening.decision in KEEP_OUT:
            yield {
                "type": "redirect",
                "text": redirect,
                "decision": screening.decision.value,
                "category": screening.category.value,
            }
            yield {"type": "done"}
            return
        request = answer_request(
            self._chat, topic, grade, taught, f"{student} asks: {screening.text}"
        )
        try:
            async for sentence in without_praise(sentences_of(self._chat.stream_chat(request))):
                said = self._screened(sentence)
                if said is None:
                    yield _bridge()
                    break
                yield {"type": "sentence", "text": said}
        except ProviderError:
            logger.warning("live.answer: the model failed mid-answer", exc_info=True)
            yield _bridge()
        yield {"type": "done"}

    async def screen(self, question: str) -> str | None:
        """The question as it may be said in the room, or None if it may not."""
        screening = await self._gate.check_input(question)
        if screening.decision in KEEP_OUT:
            return None
        return speakable(screening.text)

    async def warm(self, *, topic: str, grade: Grade | None, taught: list[str]) -> None:
        """Send the answer's prompt ahead, while a hand is up, so the real question
        meets a warm model. Measured on ILMU: a cold question waited about three
        seconds for its first word, a warm one about a quarter of a second. Only a
        *streamed* request warms it — a one-token `complete` returns at once and
        leaves the next question just as cold — and it takes those three seconds
        itself, which the tutor finishing its sentence and the student typing hide."""
        request = answer_request(self._chat, topic, grade, taught, "Ready?", max_tokens=1)
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


def answer_request(
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


async def without_praise(sentences: AsyncIterator[str]) -> AsyncIterator[str]:
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


async def sentences_of(events: AsyncIterator[Any]) -> AsyncIterator[str]:
    stream = SentenceStream()
    async for event in events:
        if isinstance(event, TokenEvent):
            for sentence in stream.feed(event.text):
                yield sentence
    for sentence in stream.flush():
        yield sentence


def _bridge() -> dict[str, Any]:
    return {"type": "sentence", "text": BRIDGE, "last": True}
