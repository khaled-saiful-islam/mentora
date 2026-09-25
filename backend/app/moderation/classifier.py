"""The slower screen: a short model call for text the rules could not decide.

Only text the rules marked REVIEW comes here — "what is sex", "why do people
take drugs" — so most messages never pay for it. It answers in a few tokens,
and when it cannot answer at all the message is allowed: the persona still
keeps the reply suitable, and a failed check must not end a child's turn.
"""

from __future__ import annotations

import asyncio
import logging

from app.artifacts.model import parse_object
from app.moderation.base import Category, Decision, Screening
from app.providers.base import ChatMessage, ChatRequest, LLMProvider, Role

logger = logging.getLogger(__name__)

MAX_CHARS = 1500

PROMPT = """You check messages that a school student ({grade}) sends to a study assistant.
Answer with JSON only: {{"decision": "allow" | "block" | "support", "category": "<one word>"}}

- "support": the student may be at risk — self-harm, abuse, or serious distress.
- "block": sexual content, how to get or use drugs, weapons, gambling, hate, or
  anything else unsafe for a child.
- "allow": everything else, including school topics that mention hard things for
  learning: reproduction in biology, why drugs are harmful, history of wars."""

_DECISIONS = {"allow": Decision.ALLOW, "block": Decision.BLOCK, "support": Decision.SUPPORT}


class ModelClassifier:
    name = "classifier"

    def __init__(self, provider: LLMProvider, *, timeout: float = 4.0) -> None:
        self._provider = provider
        self._timeout = timeout

    async def classify(self, text: str, grade_label: str | None) -> Screening:
        request = ChatRequest(
            messages=(
                ChatMessage(role=Role.SYSTEM, content=PROMPT.format(grade=grade_label or "school")),
                ChatMessage(role=Role.USER, content=text[:MAX_CHARS]),
            ),
            model=self._provider.info.model,
            temperature=0.0,
            max_tokens=40,
            stream=False,
        )
        try:
            completion = await asyncio.wait_for(self._provider.complete(request), self._timeout)
        except Exception:  # noqa: BLE001 — an unanswered check allows; the persona still guards
            logger.warning("moderation classifier unavailable", exc_info=True)
            return Screening(
                Decision.ALLOW, text, Category.SENSITIVE, "unavailable", screen=self.name
            )
        return _parse(completion.text, text)


def _parse(raw: str, text: str) -> Screening:
    found = parse_object(raw)
    decision = _DECISIONS.get(str(found.get("decision", "")).strip().lower(), Decision.ALLOW)
    label = str(found.get("category", "")).strip().lower()
    category = next((c for c in Category if c.value == label), Category.UNSAFE)
    if decision is Decision.ALLOW:
        category = Category.SENSITIVE
    return Screening(decision, text, category, f"classifier:{label or 'none'}", screen="classifier")
