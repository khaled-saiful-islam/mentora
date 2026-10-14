"""Today's Quest (§28.3.4): five quick questions a day, picked from work the
student already has — up to three on skills due for review, the rest new to
them — so it costs no model call and is always on their syllabus.

It is a practice set the student owns (`choices.daily_quest` is its day),
played in the ordinary quiz player. Finishing it marks the quest done and
grows the buddy; every finished attempt also moves each skill it asked about
through its review boxes (`skill_memory`).
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now, zone
from app.db.models.attempt import Attempt, AttemptAnswer
from app.db.models.family import FamilyShare
from app.db.models.learning import Assignment, LearningSet, LearningSetVersion
from app.db.models.quest import DailyQuest, SkillMemory
from app.db.models.user import User
from app.events.catalog import AttemptCompleted
from app.policies.access import visible_to
from app.quests.rules import (
    NO_SKILL,
    QUEST_SIZE,
    REVIEW_SIZE,
    SMALLEST_QUEST,
    due_on,
    next_box,
)
from app.services.growth_service import GrowthService

QUEST_TITLE = "Today's Quest"
QUEST_KEY = "daily_quest"


@dataclass(frozen=True, slots=True)
class Candidate:
    """A question the student may be asked, and where it came from."""

    set_id: UUID
    item: dict[str, Any]
    label: str
    language: str

    @property
    def skill(self) -> str:
        return str(self.item.get("skill") or "")


class QuestService:
    def __init__(
        self, session: AsyncSession, *, timezone: str = "UTC", clock: Clock = utc_now
    ) -> None:
        self._session = session
        self._timezone = timezone
        self._clock = clock

    def today(self) -> date:
        return self._clock().astimezone(zone(self._timezone)).date()

    # --- after every attempt ---------------------------------------------------

    async def remember(self, event: AttemptCompleted) -> None:
        """Each skill this attempt asked about moves through its boxes; a
        quest finished is marked done, and grows the buddy."""
        today = self.today()
        rows = await self._session.execute(
            select(AttemptAnswer.skill, AttemptAnswer.correct).where(
                AttemptAnswer.attempt_id == event.attempt_id
            )
        )
        tally: dict[str, list[int]] = {}
        for skill, correct in rows.all():
            if skill in NO_SKILL:
                continue
            counts = tally.setdefault(skill, [0, 0])
            counts[0] += 1 if correct else 0
            counts[1] += 1
        for skill, (right, seen) in tally.items():
            await self._move(event.student_id, skill, right, seen, today)
        quest = await self._session.scalar(
            select(DailyQuest).where(
                DailyQuest.set_id == event.set_id, DailyQuest.student_id == event.student_id
            )
        )
        if quest is not None and quest.done_at is None:
            quest.done_at = self._clock()
            await GrowthService(self._session).award(event.student_id, "quest", str(quest.day))

    async def _move(
        self, student_id: UUID, skill: str, right: int, seen: int, today: date
    ) -> None:
        memory = await self._session.get(SkillMemory, (student_id, skill))
        if memory is None:
            memory = SkillMemory(student_id=student_id, skill=skill, box=0, seen=0, right=0)
            self._session.add(memory)
        memory.box = next_box(memory.box or 0, right / seen)
        memory.due_on = due_on(memory.box, today)
        memory.seen = (memory.seen or 0) + seen
        memory.right = (memory.right or 0) + right
        await self._session.flush()

    # --- today's quest ---------------------------------------------------------

    async def quest(self, student: User) -> DailyQuest | None:
        """Today's quest: as made earlier today, or made now. None when there
        is not enough work yet to make one."""
        today = self.today()
        made = await self._session.scalar(
            select(DailyQuest).where(
                DailyQuest.student_id == student.id, DailyQuest.day == today
            )
        )
        if made is not None:
            return made
        memory = await self.memory(student)
        bank = await self.bank(student)
        known = await self.known(student)
        picked, review = pick(bank, memory, known, today, seed=f"{student.id}:{today}")
        if len(picked) < SMALLEST_QUEST:
            return None
        learning_set = await self._make_set(student, picked, today)
        quest = DailyQuest(
            student_id=student.id,
            day=today,
            set_id=learning_set.id,
            review=review,
            fresh=len(picked) - review,
        )
        self._session.add(quest)
        await self._session.flush()
        return quest

    async def memory(self, student: User) -> dict[str, SkillMemory]:
        """What the student remembers of each skill. The first time, worked
        out from everything they have answered, so review starts at once."""
        found = (
            await self._session.execute(
                select(SkillMemory).where(SkillMemory.student_id == student.id)
            )
        ).scalars().all()
        if found:
            return {m.skill: m for m in found}
        today = self.today()
        for skill, (right, seen) in (await self._history(student.id)).items():
            box = next_box(0, right / seen)
            # Found hard: due today. Known: due when its box says.
            when = today if box == 0 else due_on(box - 1, today)
            self._session.add(
                SkillMemory(
                    student_id=student.id,
                    skill=skill,
                    box=box,
                    due_on=when,
                    seen=seen,
                    right=right,
                )
            )
        await self._session.flush()
        return {
            m.skill: m
            for m in (
                await self._session.execute(
                    select(SkillMemory).where(SkillMemory.student_id == student.id)
                )
            ).scalars()
        }

    async def _history(self, student_id: UUID) -> dict[str, tuple[int, int]]:
        rows = await self._session.execute(
            select(AttemptAnswer.skill, AttemptAnswer.correct)
            .join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
            .where(Attempt.student_id == student_id, Attempt.status == "completed")
        )
        tally: dict[str, list[int]] = {}
        for skill, correct in rows.all():
            if skill in NO_SKILL:
                continue
            counts = tally.setdefault(skill, [0, 0])
            counts[0] += 1 if correct else 0
            counts[1] += 1
        return {skill: (right, seen) for skill, (right, seen) in tally.items()}

    async def known(self, student: User) -> dict[tuple[UUID, str], bool]:
        """Each question answered before, by set and item: last time right?"""
        rows = await self._session.execute(
            select(Attempt.set_id, AttemptAnswer.item_id, AttemptAnswer.correct)
            .join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
            .where(Attempt.student_id == student.id)
            .order_by(AttemptAnswer.answered_at)
        )
        return {(set_id, item_id): correct for set_id, item_id, correct in rows.all()}

    async def bank(self, student: User) -> list[Candidate]:
        """Every quiz question the student can see: their classes' work, what
        was sent home, and practice made for them — never another quest."""
        pairs: set[tuple[UUID, int]] = set()
        for query in (
            select(Assignment.set_id, Assignment.version)
            .join(LearningSet, LearningSet.id == Assignment.set_id)
            .where(visible_to(student.id), LearningSet.kind == "quiz"),
            select(FamilyShare.set_id, FamilyShare.version)
            .join(LearningSet, LearningSet.id == FamilyShare.set_id)
            .where(FamilyShare.student_id == student.id, LearningSet.kind == "quiz"),
            select(LearningSet.id, LearningSet.current_version).where(
                LearningSet.owner_id == student.id,
                LearningSet.purpose == "practice",
                LearningSet.kind == "quiz",
                LearningSet.status == "ready",
                ~LearningSet.choices.has_key(QUEST_KEY),
            ),
        ):
            pairs.update((s, v) for s, v in (await self._session.execute(query)).all())
        if not pairs:
            return []
        rows = await self._session.execute(
            select(LearningSetVersion, LearningSet.language)
            .join(LearningSet, LearningSet.id == LearningSetVersion.set_id)
            .where(tuple_(LearningSetVersion.set_id, LearningSetVersion.version).in_(pairs))
        )
        bank: list[Candidate] = []
        for version, language in rows.all():
            labels = {s["slug"]: s["label"] for s in version.skills}
            for item in version.items:
                if isinstance(item.get("options"), list) and item.get("skill") not in NO_SKILL:
                    label = labels.get(str(item.get("skill")), str(item.get("skill")))
                    bank.append(Candidate(version.set_id, item, label, language or "en"))
        return bank

    async def _make_set(self, student: User, picked: list[Candidate], today: date) -> LearningSet:
        skills = list({c.skill: {"slug": c.skill, "label": c.label} for c in picked}.values())
        languages = [c.language for c in picked]
        learning_set = LearningSet(
            owner_id=student.id,
            purpose="practice",
            kind="quiz",
            title=QUEST_TITLE,
            topic="Today's quest",
            grade_level=student.grade_level,
            language=max(set(languages), key=languages.count),
            status="ready",
            requested_count=len(picked),
            current_version=1,
            web_sources=False,
            choices={QUEST_KEY: today.isoformat()},
        )
        self._session.add(learning_set)
        await self._session.flush()
        self._session.add(
            LearningSetVersion(
                set_id=learning_set.id,
                version=1,
                # Ids anew: two sets can each have a "q1".
                items=[{**c.item, "id": f"d{n}"} for n, c in enumerate(picked, start=1)],
                skills=skills,
                sources=[],
                extras={},
            )
        )
        await self._session.flush()
        return learning_set


def pick(
    bank: list[Candidate],
    memory: dict[str, SkillMemory],
    known: dict[tuple[UUID, str], bool],
    today: date,
    *,
    seed: str,
) -> tuple[list[Candidate], int]:
    """Today's questions, and how many are review. Review first: one question
    for each skill due, weakest first, a question once got wrong before any
    other; then new — skills not met yet, then questions not answered yet."""
    rng = random.Random(seed)  # noqa: S311 - variety, not a secret
    pool = list(bank)
    rng.shuffle(pool)
    due = sorted(
        (m for m in memory.values() if m.due_on <= today),
        key=lambda m: (m.box, m.due_on),
    )
    chosen: list[Candidate] = []
    taken: set[tuple[UUID, str]] = set()

    def take(c: Candidate) -> None:
        chosen.append(c)
        taken.add((c.set_id, str(c.item.get("id"))))

    def fresh(c: Candidate) -> bool:
        return (c.set_id, str(c.item.get("id"))) not in taken

    for memory_of in due:
        if len(chosen) >= REVIEW_SIZE:
            break
        on_skill = [c for c in pool if c.skill == memory_of.skill and fresh(c)]
        on_skill.sort(key=lambda c: known.get((c.set_id, str(c.item.get("id")))) is not False)
        if on_skill:
            take(on_skill[0])
    review = len(chosen)
    unmet = [c for c in pool if c.skill not in memory and fresh(c)]
    unanswered = [c for c in pool if (c.set_id, str(c.item.get("id"))) not in known and fresh(c)]
    rest = [c for c in pool if fresh(c)]
    # New questions on as many different skills as there are.
    for group in (unmet, unanswered, rest):
        for c in group:
            if len(chosen) >= QUEST_SIZE:
                return chosen, review
            if fresh(c) and c.skill not in {x.skill for x in chosen[review:]}:
                take(c)
    # Short of distinct skills: any question left, to make five.
    for c in rest:
        if len(chosen) >= QUEST_SIZE:
            break
        if fresh(c):
            take(c)
    return chosen, review
