"""Explain why (§28.3.5, Form 1–5): after a right answer, sometimes "Tell me
why". The student says or types their reasoning; the model judges it against
the question's own explanation and answers in one line.

- Their words pass the student safety screens first. Words held back are
  logged for a person (`ModerationService`) and answered with a nudge back
  to the question; the model never sees them.
- At most `per_day` judged a day, in the school's day, and one per question
  in an attempt: asked again, the same verdict.
- A model that will not answer gives a kind line, uncounted.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, time
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now, zone
from app.core.errors import ValidationError
from app.core.grades import grade_label
from app.db.models.attempt import AttemptAnswer
from app.db.models.explain_why import WhyGiven
from app.db.models.user import User
from app.events.registry import build_bus
from app.learning.base import clean_text
from app.learning.model import GenerationUnavailable, JsonModel
from app.moderation.base import Decision, Flag
from app.moderation.gate import ModerationGate
from app.services.attempt_service import AttemptService, second_chance_for
from app.services.moderation_service import ModerationService, Where

logger = logging.getLogger(__name__)

VERDICTS = ("spot_on", "nearly", "not_yet")
MOST_WORDS = 400
FEEDBACK_LIMIT = 220
UNCHECKED = "I couldn't check that just now. Saying why out loud is still a great way to learn!"
OFF_TOPIC = "Let's keep to the question: why is that the right answer?"
KEEP_OUT = frozenset({Decision.BLOCK, Decision.SUPPORT, Decision.REVIEW})

SYSTEM = """You are a kind, encouraging tutor for Malaysian secondary school
students. A student answered a question correctly and then explained WHY in
their own words. Judge only their REASONING, against the teacher's
explanation: is the key idea there? Spelling, grammar and length don't
matter. Never give the answer away for other questions; never be harsh.
Reply with one JSON object and nothing else."""

USER = """The question: {prompt}
The right answer: {answer}
The teacher's explanation: {explanation}
The student ({grade}) said: "{words}"

Return:
{{"verdict": "spot_on|nearly|not_yet",
  "feedback": "ONE short sentence to the student, under 30 words: praise what
    is right, and if something is missing, the one idea to add"}}"""


@dataclass(frozen=True, slots=True)
class Judged:
    verdict: str | None
    feedback: str

    def as_dict(self) -> dict[str, Any]:
        return {"verdict": self.verdict, "feedback": self.feedback}


def offered_to(student: User) -> bool:
    """Explain why is for Form 1–5."""
    return (student.grade_level or "").startswith("form_")


class ExplainWhyService:
    def __init__(
        self,
        session: AsyncSession,
        model: Callable[[], JsonModel],
        gate: ModerationGate,
        *,
        per_day: int = 5,
        timezone: str = "UTC",
        clock: Clock = utc_now,
    ) -> None:
        self._session = session
        self._model = model
        self._gate = gate
        self._per_day = per_day
        self._timezone = timezone
        self._clock = clock

    async def left(self, student: User) -> int:
        """How many more the student may give today: none outside Form 1–5."""
        if not offered_to(student):
            return 0
        return max(0, self._per_day - await self._today(student.id))

    async def judge(self, student: User, attempt_id: UUID, item_id: str, words: str) -> Judged:
        item = await self._answered_right(student, attempt_id, item_id)
        kept = await self._session.scalar(
            select(WhyGiven).where(WhyGiven.attempt_id == attempt_id, WhyGiven.item_id == item_id)
        )
        if kept is not None:
            return Judged(kept.verdict, kept.feedback)
        if await self.left(student) <= 0:
            raise ValidationError("That's all the explaining for today. Great thinking!")
        said = " ".join(words.split())[:MOST_WORDS]
        screening = await self._gate.check_input(said)
        if screening.decision in KEEP_OUT:
            await self._flag(student, attempt_id, screening, said)
            return Judged(None, OFF_TOPIC)
        judged = await self._ask(item, screening.text, student.grade_level)
        if judged.verdict is not None:
            self._session.add(
                WhyGiven(
                    student_id=student.id,
                    attempt_id=attempt_id,
                    item_id=item_id,
                    words=screening.text,
                    verdict=judged.verdict,
                    feedback=judged.feedback,
                )
            )
            await self._session.flush()
        return judged

    async def _answered_right(self, student: User, attempt_id: UUID, item_id: str) -> dict:
        if not offered_to(student):
            raise ValidationError("Explaining why is for Form 1 to 5.")
        loaded = await AttemptService(self._session).loaded(student.id, attempt_id)
        item = loaded.by_id.get(item_id)
        if item is None or not second_chance_for(loaded):
            raise ValidationError("There is nothing to explain there.")
        correct = await self._session.scalar(
            select(AttemptAnswer.correct).where(
                AttemptAnswer.attempt_id == attempt_id, AttemptAnswer.item_id == item_id
            )
        )
        if correct is not True:
            raise ValidationError("Explaining why comes after a right answer.")
        return item

    async def _ask(self, item: dict, words: str, grade: str | None) -> Judged:
        options = item.get("options") or []
        answer = item.get("answer")
        right = options[answer] if isinstance(answer, int) and 0 <= answer < len(options) else ""
        user = USER.format(
            prompt=item.get("prompt", ""),
            answer=right,
            explanation=item.get("explanation") or "(none given)",
            grade=grade_label(grade) or "secondary school",
            words=words.replace('"', "'"),
        )
        try:
            reply = await self._model().ask(
                "explain why: judge", SYSTEM, user, temperature=0.2, max_tokens=200
            )
        except GenerationUnavailable:
            logger.info("explain why could not be judged")
            return Judged(None, UNCHECKED)
        verdict = reply.get("verdict")
        feedback = clean_text(reply.get("feedback"), FEEDBACK_LIMIT)
        if verdict not in VERDICTS or not feedback:
            return Judged(None, UNCHECKED)
        return Judged(str(verdict), feedback)

    async def _today(self, student_id: UUID) -> int:
        local = zone(self._timezone)
        start = datetime.combine(self._clock().astimezone(local).date(), time.min, local)
        return int(
            await self._session.scalar(
                select(func.count())
                .select_from(WhyGiven)
                .where(WhyGiven.student_id == student_id, WhyGiven.created_at >= start)
            )
            or 0
        )

    async def _flag(self, student: User, attempt_id: UUID, screening: Any, words: str) -> None:
        kind = "support" if screening.decision is Decision.SUPPORT else "held"
        await ModerationService(self._session, build_bus()).record_quietly(
            [Flag.of(kind, "user_input", screening, words)], Where(user_id=student.id)
        )
        logger.info("explain why: words held back for attempt %s", attempt_id)
