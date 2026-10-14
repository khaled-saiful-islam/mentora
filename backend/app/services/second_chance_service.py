"""Second chance, at your level (§28.3.7).

After a wrong answer in a quiz that says right or wrong straight away, a
student may see the question explained at their reading level — Simpler,
Just right or Challenge — with a worked example, then try one like it.

- An explanation is written the first time anyone asks for that question,
  year and level, then kept (`item_help`): one model call each, ever.
- "One like it" is a question on the same skill: from the set, if it has one
  the student is not about to meet; else from their other work; else one
  made before; else made now, a few a day at most.
- The second try is kept apart (`second_chances`). The first answer and the
  score stand; right on the second try grows the buddy, a few times a day.
"""

from __future__ import annotations

import logging
import random
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now, zone
from app.core.errors import NotFoundError, ValidationError
from app.core.grades import grade_label
from app.db.models.attempt import AttemptAnswer
from app.db.models.second_chance import ItemHelp, SecondChance
from app.db.models.user import User
from app.growth.rules import SECOND_CHANCES_A_DAY
from app.learning.base import Item
from app.learning.model import JsonModel
from app.services.attempt_service import AttemptService, Loaded, second_chance_for
from app.services.growth_service import GrowthService
from app.services.quest_service import QuestService
from app.services.second_chance_writing import (
    LEVELS,
    item_key,
    write_explanation,
    write_twin,
)

logger = logging.getLogger(__name__)

# Questions made by the model for one student in a day, at most.
MOST_MADE_A_DAY = 10
TWIN = "twin"
NOT_OFFERED = "There is no second chance on this one."


@dataclass(frozen=True, slots=True)
class Missed:
    """A question the student got wrong, in an attempt that offers a second chance."""

    loaded: Loaded
    item: Item

    @property
    def skill(self) -> str:
        return str(self.item.get("skill") or "general")[:64]

    @property
    def grade(self) -> str:
        return self.loaded.learning_set.grade_level or ""

    @property
    def language(self) -> str:
        return self.loaded.learning_set.language or "en"


@dataclass(frozen=True, slots=True)
class Explanation:
    level: str
    why: str
    example: dict[str, Any] | None
    remember: str | None
    # False when the model could not write one: the question's own note instead.
    written: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "level": self.level,
            "why": self.why,
            "example": self.example,
            "remember": self.remember,
            "written": self.written,
        }


@dataclass(frozen=True, slots=True)
class Twin:
    """A question like the one missed: as asked, and — once tried — how it went."""

    prompt: str
    options: list[str]
    choice: int | None = None
    correct: bool | None = None
    answer: int | None = None
    explanation: str | None = None
    # The buddy grew from getting it right.
    grew: bool = False

    @classmethod
    def of(cls, row: SecondChance, *, grew: bool = False) -> Twin:
        tried = row.correct is not None
        return cls(
            prompt=row.question["prompt"],
            options=list(row.question["options"]),
            choice=row.choice,
            correct=row.correct,
            answer=row.question["answer"] if tried else None,
            explanation=row.question.get("explanation") if tried else None,
            grew=grew,
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "prompt": self.prompt,
            "options": self.options,
            "choice": self.choice,
            "correct": self.correct,
            "answer": self.answer,
            "explanation": self.explanation,
            "grew": self.grew,
        }


class SecondChanceService:
    def __init__(
        self,
        session: AsyncSession,
        model: Callable[[], JsonModel],
        *,
        timezone: str = "UTC",
        clock: Clock = utc_now,
    ) -> None:
        self._session = session
        # Built only when something has to be written.
        self._model = model
        self._timezone = timezone
        self._clock = clock

    # --- explaining -------------------------------------------------------------

    async def explain(
        self, student_id: UUID, attempt_id: UUID, item_id: str, level: str
    ) -> Explanation:
        if level not in LEVELS:
            raise ValidationError("The level is simple, core or stretch.")
        missed = await self._missed(student_id, attempt_id, item_id)
        key = item_key(missed.item)
        kept = await self._kept(key, missed.grade, level)
        if kept is None:
            kept = await write_explanation(
                self._model(),
                missed.item,
                level=level,
                grade=grade_label(missed.grade) or "primary school",
                language=missed.language,
            )
            if kept is None:
                # Said plainly, and not kept: the next ask tries again.
                note = str(missed.item.get("explanation") or "")
                return Explanation(level, note, None, None, written=False)
            await self._keep(key, missed.grade, level, kept)
        return Explanation(level, kept["why"], kept["example"], kept.get("remember"))

    # --- one like it ------------------------------------------------------------

    async def twin(self, student_id: UUID, attempt_id: UUID, item_id: str) -> Twin | None:
        """The question like it, the same one each time it is asked for. None
        when there is none to be found and none can be made just now."""
        missed = await self._missed(student_id, attempt_id, item_id)
        row = await self._row(attempt_id, item_id)
        if row is not None:
            return Twin.of(row)
        question = await self._find(student_id, missed) or await self._make(student_id, missed)
        if question is None:
            return None
        row = await self._start(student_id, missed, question)
        return Twin.of(row)

    async def try_twin(self, student_id: UUID, attempt_id: UUID, item_id: str, choice: int) -> Twin:
        """The answer to the question like it. Kept the first time; asked
        again, the same result. Right grows the buddy, a few times a day."""
        await self._missed(student_id, attempt_id, item_id)
        row = await self._row(attempt_id, item_id)
        if row is None:
            raise NotFoundError("Ask for a question like it first.")
        if row.correct is not None:
            return Twin.of(row)
        if not 0 <= choice < len(row.question["options"]):
            raise ValidationError("That is not one of the options.")
        row.choice = choice
        row.correct = choice == row.question["answer"]
        row.answered_at = self._clock()
        await self._session.flush()
        grew = await self._grow(student_id) if row.correct else False
        return Twin.of(row, grew=grew)

    # --- internals ----------------------------------------------------------------

    async def _missed(self, student_id: UUID, attempt_id: UUID, item_id: str) -> Missed:
        loaded = await AttemptService(self._session).loaded(student_id, attempt_id)
        if not second_chance_for(loaded):
            raise ValidationError(NOT_OFFERED)
        item = loaded.by_id.get(item_id)
        if item is None or item_id not in loaded.attempt.plan["order"]:
            raise NotFoundError("That question isn't in this attempt.")
        correct = await self._session.scalar(
            select(AttemptAnswer.correct).where(
                AttemptAnswer.attempt_id == attempt_id, AttemptAnswer.item_id == item_id
            )
        )
        if correct is not False:
            raise ValidationError("A second chance comes after a wrong answer.")
        return Missed(loaded, item)

    async def _row(self, attempt_id: UUID, item_id: str) -> SecondChance | None:
        return await self._session.scalar(
            select(SecondChance).where(
                SecondChance.attempt_id == attempt_id, SecondChance.item_id == item_id
            )
        )

    async def _find(self, student_id: UUID, missed: Missed) -> dict[str, Any] | None:
        """One like it from questions already written, or None."""
        version, attempt = missed.loaded.version, missed.loaded.attempt
        asked = {_words(i.get("prompt")) for i in version.items}
        unseen = [
            i
            for i in version.items
            if i.get("skill") == missed.item.get("skill") and i["id"] not in attempt.plan["order"]
        ]
        pool, source = unseen, "set"
        if not pool:
            pool, source = await self._from_bank(student_id, missed, asked), "bank"
        if not pool:
            return None
        picked = random.Random(f"{attempt.id}:{missed.item['id']}").choice(pool)  # noqa: S311
        return _asked(picked, source, seed=f"{attempt.id}:{missed.item['id']}")

    async def _from_bank(self, student_id: UUID, missed: Missed, asked: set[str]) -> list[Item]:
        student = await self._session.get(User, student_id)
        if student is None:
            return []
        quests = QuestService(self._session)
        same = [
            c
            for c in await quests.bank(student)
            if c.skill == missed.item.get("skill")
            and c.language == missed.language
            and _words(c.item.get("prompt")) not in asked
        ]
        known = await quests.known(student)
        fresh = [c for c in same if (c.set_id, str(c.item.get("id"))) not in known]
        unique = {_words(c.item.get("prompt")): c.item for c in (fresh or same)}
        return list(unique.values())

    async def _make(self, student_id: UUID, missed: Missed) -> dict[str, Any] | None:
        """One like it written by the model: kept for the next student who
        misses this question, and a few a day for each student at most."""
        key = item_key(missed.item)
        kept = await self._kept(key, missed.grade, TWIN)
        if kept is not None:
            return {**kept, "from": "kept"}
        if await self._made_today(student_id) >= MOST_MADE_A_DAY:
            return None
        made = await write_twin(
            self._model(),
            missed.item,
            skill=missed.skill,
            grade=grade_label(missed.grade) or "primary school",
            language=missed.language,
        )
        if made is None:
            return None
        await self._keep(key, missed.grade, TWIN, made)
        return {**made, "from": "made"}

    async def _made_today(self, student_id: UUID) -> int:
        since = self._clock() - timedelta(days=1)
        return int(
            await self._session.scalar(
                select(func.count())
                .select_from(SecondChance)
                .where(
                    SecondChance.student_id == student_id,
                    SecondChance.created_at >= since,
                    SecondChance.question["from"].astext == "made",
                )
            )
            or 0
        )

    async def _start(
        self, student_id: UUID, missed: Missed, question: dict[str, Any]
    ) -> SecondChance:
        attempt_id, item_id = missed.loaded.attempt.id, str(missed.item["id"])
        try:
            async with self._session.begin_nested():
                self._session.add(
                    SecondChance(
                        attempt_id=attempt_id,
                        student_id=student_id,
                        item_id=item_id,
                        skill=missed.skill,
                        question=question,
                    )
                )
        except IntegrityError:
            # Asked twice at once: the first one stands.
            logger.info("second chance for %s/%s started twice at once", attempt_id, item_id)
        row = await self._row(attempt_id, item_id)
        if row is None:  # pragma: no cover - the insert or the other one is there
            raise NotFoundError("That question like it went missing.")
        return row

    async def _kept(self, key: str, grade: str, kind: str) -> dict[str, Any] | None:
        row = await self._session.scalar(
            select(ItemHelp).where(
                ItemHelp.item_key == key, ItemHelp.grade == grade[:32], ItemHelp.kind == kind
            )
        )
        return dict(row.payload) if row else None

    async def _keep(self, key: str, grade: str, kind: str, payload: dict[str, Any]) -> None:
        try:
            async with self._session.begin_nested():
                self._session.add(
                    ItemHelp(item_key=key, grade=grade[:32], kind=kind, payload=payload)
                )
        except IntegrityError:
            # Another student asked at the same moment: theirs is kept.
            logger.info("item help %s was written twice at once", kind)

    async def _grow(self, student_id: UUID) -> bool:
        day = self._clock().astimezone(zone(self._timezone)).date().isoformat()
        growth = GrowthService(self._session)
        for slot in range(SECOND_CHANCES_A_DAY):
            if await growth.award(student_id, "second_chance", f"{day}:{slot}"):
                return True
        return False


def _words(value: Any) -> str:
    return " ".join(str(value or "").split()).lower()


def _asked(item: Item, source: str, *, seed: str) -> dict[str, Any]:
    """A question as kept for a second try, its options in a new order so a
    question met before is not answered from memory of where the answer sat."""
    options = list(item["options"])
    order = list(range(len(options)))
    random.Random(seed).shuffle(order)  # noqa: S311 - variety, not a secret
    return {
        "prompt": item["prompt"],
        "options": [options[i] for i in order],
        "answer": order.index(int(item["answer"])),
        "explanation": str(item.get("explanation") or ""),
        "from": source,
    }
