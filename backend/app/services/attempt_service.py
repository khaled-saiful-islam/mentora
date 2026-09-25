"""Taking a set: start or resume, answer one at a time, finish.

What keeps this honest:

- The answer key never leaves the server before an answer does. A student
  receives each kind's *public* view, with options in their own shuffled
  order; the plan that maps shown positions back to real ones stays here.
- In end-of-quiz mode an answer is only recorded — whether it was right is
  not said until the attempt is finished.
- Answers are stored in the item's own terms (the real option index), so
  results never depend on the order one student happened to see.
- Answering twice is idempotent: a retried request gets the first result.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.db.models.attempt import Attempt, AttemptAnswer
from app.db.models.learning import Assignment, LearningSet, LearningSetVersion
from app.db.models.user import User
from app.events.bus import EventBus
from app.events.catalog import AttemptProgressed
from app.learning.base import Item, LearningKind
from app.learning.registry import build_learning_kinds
from app.policies.access import assignment_for_student


@dataclass(frozen=True, slots=True)
class Played:
    """One answered item, as the student may see it now."""

    item_id: str
    choice: int | None  # in the shown order; None for flashcards
    knew: bool | None
    correct: bool | None  # None while the quiz hides feedback
    reveal: dict[str, Any] | None


@dataclass(frozen=True, slots=True)
class AttemptView:
    attempt: Attempt
    title: str
    kind: str
    purpose: str
    feedback_mode: str
    items: list[dict[str, Any]]
    answered: list[Played]
    skills: list[dict[str, Any]]
    assignment: Assignment | None
    attempts_used: int
    can_retake: bool


@dataclass(frozen=True, slots=True)
class AnswerResult:
    played: Played
    streak: int
    answered: int
    total: int


@dataclass(frozen=True, slots=True)
class Loaded:
    """An attempt with everything needed to show or mark it."""

    attempt: Attempt
    learning_set: LearningSet
    version: LearningSetVersion
    kind: LearningKind
    assignment: Assignment | None
    by_id: dict[str, Item] = field(default_factory=dict)


class AttemptService:
    def __init__(
        self,
        session: AsyncSession,
        kinds: dict[str, LearningKind] | None = None,
        *,
        bus: EventBus | None = None,
    ) -> None:
        self._session = session
        self._kinds = kinds or build_learning_kinds()
        # Optional: with one, starting and answering are announced, so a
        # teacher watching the results sees each step.
        self._bus = bus

    async def _progressed(
        self, loaded_attempt: Attempt, assignment: Assignment | None, answered: int
    ) -> None:
        if self._bus is None or assignment is None:
            return
        await self._bus.publish(
            AttemptProgressed(
                assignment_id=assignment.id,
                teacher_id=assignment.teacher_id,
                student_id=loaded_attempt.student_id,
                answered=answered,
                total=len(loaded_attempt.plan["order"]),
            ),
            self._session,
        )

    # --- starting --------------------------------------------------------

    async def start(self, student: User, assignment_id: UUID) -> AttemptView:
        assignment = await assignment_for_student(self._session, student.id, assignment_id)
        if assignment is None:
            raise NotFoundError("That isn't shared with you.")
        learning_set = await self._session.get(LearningSet, assignment.set_id)
        version = await self._version(assignment.set_id, assignment.version)
        attempts = await self._attempts(student.id, assignment_id=assignment.id)
        running = next((a for a in attempts if a.status == "in_progress"), None)
        if running is not None:
            return await self.view(student.id, running.id)
        if attempts and not _may_retake(assignment, len(attempts)):
            return await self.view(student.id, attempts[-1].id)
        if assignment.closed_at is not None:
            raise ValidationError("Your teacher has closed this one.")
        return await self._create(student, learning_set, version, assignment, len(attempts) + 1)

    async def start_practice(self, student: User, set_id: UUID) -> AttemptView:
        learning_set = (
            await self._session.execute(
                select(LearningSet).where(
                    LearningSet.id == set_id,
                    LearningSet.owner_id == student.id,
                    LearningSet.purpose == "practice",
                )
            )
        ).scalar_one_or_none()
        if learning_set is None or learning_set.status != "ready":
            raise NotFoundError("No such practice set.")
        attempts = await self._attempts(student.id, set_id=set_id)
        running = next((a for a in attempts if a.status == "in_progress"), None)
        if running is not None:
            return await self.view(student.id, running.id)
        version = await self._version(set_id, learning_set.current_version)
        return await self._create(student, learning_set, version, None, len(attempts) + 1)

    async def _create(
        self,
        student: User,
        learning_set: LearningSet,
        version: LearningSetVersion,
        assignment: Assignment | None,
        number: int,
    ) -> AttemptView:
        """A new attempt — or, if another request made it a moment ago (a
        double tap, a retry), that one. The database's unique indexes decide
        who won; the loser joins rather than making a twin."""
        try:
            async with self._session.begin_nested():
                attempt = self._new_attempt(student, learning_set, version, assignment, number)
                await self._session.flush()
        except IntegrityError:
            running = await self._running(student.id, assignment, learning_set.id)
            if running is None:
                raise
            return await self.view(student.id, running.id)
        await self._progressed(attempt, assignment, 0)
        return await self.view(student.id, attempt.id)

    async def _running(
        self, student_id: UUID, assignment: Assignment | None, set_id: UUID
    ) -> Attempt | None:
        scope = (
            Attempt.assignment_id == assignment.id
            if assignment
            else (Attempt.assignment_id.is_(None) & (Attempt.set_id == set_id))
        )
        return (
            await self._session.execute(
                select(Attempt).where(
                    Attempt.student_id == student_id, scope, Attempt.status == "in_progress"
                )
            )
        ).scalar_one_or_none()

    def _new_attempt(
        self,
        student: User,
        learning_set: LearningSet,
        version: LearningSetVersion,
        assignment: Assignment | None,
        number: int,
    ) -> Attempt:
        shuffle_items = bool(assignment and assignment.shuffle_questions)
        shuffle_options = assignment.shuffle_options if assignment else True
        attempt = Attempt(
            student_id=student.id,
            assignment_id=assignment.id if assignment else None,
            set_id=learning_set.id,
            version=version.version,
            kind=learning_set.kind,
            number=number,
            status="in_progress",
            plan=_plan(version.items, shuffle_items=shuffle_items, shuffle_options=shuffle_options),
            max_score=len(version.items),
        )
        self._session.add(attempt)
        return attempt

    # --- reading ---------------------------------------------------------

    async def view(self, student_id: UUID, attempt_id: UUID) -> AttemptView:
        loaded = await self._load(student_id, attempt_id)
        attempt = loaded.attempt
        answers = await self._answers(attempt.id)
        finished = attempt.status == "completed"
        instant = _feedback(loaded) == "instant" or finished
        used = len(
            await self._attempts(
                student_id, assignment_id=attempt.assignment_id, set_id=attempt.set_id
            )
        )
        return AttemptView(
            attempt=attempt,
            title=loaded.learning_set.title,
            kind=loaded.learning_set.kind,
            purpose=loaded.learning_set.purpose,
            feedback_mode=_feedback(loaded),
            items=[self._shown(loaded, item_id) for item_id in attempt.plan["order"]],
            answered=[self._played(loaded, a, reveal=instant) for a in answers],
            skills=list(loaded.version.skills),
            assignment=loaded.assignment,
            attempts_used=used,
            can_retake=finished
            and (loaded.assignment is None or _may_retake(loaded.assignment, used)),
        )

    def _shown(self, loaded: Loaded, item_id: str) -> dict[str, Any]:
        public = loaded.kind.public(loaded.by_id[item_id])
        order = loaded.attempt.plan.get("options", {}).get(item_id)
        if order and "options" in public:
            public = {**public, "options": [public["options"][i] for i in order]}
        return public

    def _played(self, loaded: Loaded, answer: AttemptAnswer, *, reveal: bool) -> Played:
        order = loaded.attempt.plan.get("options", {}).get(answer.item_id)
        choice = answer.response.get("choice")
        shown_choice = (
            order.index(choice) if order and isinstance(choice, int) and choice in order else choice
        )
        item = loaded.by_id.get(answer.item_id, {})
        revealed = None
        if reveal:
            graded = loaded.kind.grade(item, answer.response)
            revealed = dict(graded.reveal)
            if order and isinstance(revealed.get("answer"), int):
                revealed["answer"] = order.index(revealed["answer"])
        return Played(
            item_id=answer.item_id,
            choice=shown_choice if isinstance(shown_choice, int) else None,
            knew=answer.response.get("knew")
            if isinstance(answer.response.get("knew"), bool)
            else None,
            correct=answer.correct if reveal or loaded.kind.name == "flashcard" else None,
            reveal=revealed,
        )

    # --- answering -------------------------------------------------------

    async def answer(
        self,
        student_id: UUID,
        attempt_id: UUID,
        item_id: str,
        response: dict[str, Any],
        time_ms: int,
    ) -> AnswerResult:
        loaded = await self._load(student_id, attempt_id)
        attempt = loaded.attempt
        if attempt.status != "in_progress":
            raise ValidationError("This attempt is already finished.")
        if item_id not in loaded.by_id or item_id not in attempt.plan["order"]:
            raise NotFoundError("That question isn't in this attempt.")
        answers = await self._answers(attempt.id)
        existing = next((a for a in answers if a.item_id == item_id), None)
        if existing is None:
            existing = await self._record(loaded, item_id, response, time_ms)
            answers.append(existing)
        streak = _streak(answers)
        attempt.best_streak = max(attempt.best_streak, streak)
        await self._session.flush()
        await self._progressed(attempt, loaded.assignment, len(answers))
        instant = _feedback(loaded) == "instant"
        return AnswerResult(
            played=self._played(loaded, existing, reveal=instant),
            streak=streak if instant else 0,
            answered=len(answers),
            total=len(attempt.plan["order"]),
        )

    async def _record(
        self, loaded: Loaded, item_id: str, response: dict[str, Any], time_ms: int
    ) -> AttemptAnswer:
        stored = _in_item_terms(response, loaded.attempt.plan.get("options", {}).get(item_id))
        graded = loaded.kind.grade(loaded.by_id[item_id], stored)
        answer = AttemptAnswer(
            attempt_id=loaded.attempt.id,
            item_id=item_id,
            skill=str(loaded.by_id[item_id].get("skill", "general"))[:64],
            response=stored,
            correct=graded.correct,
            time_ms=max(0, min(int(time_ms), 3_600_000)),
        )
        self._session.add(answer)
        if graded.correct:
            loaded.attempt.score += 1
        await self._session.flush()
        return answer

    # --- finishing -------------------------------------------------------

    async def complete(self, student_id: UUID, attempt_id: UUID) -> Loaded:
        """Mark the attempt finished. Returns what the caller needs to award
        badges and tell people; idempotent for an already-finished attempt."""
        loaded = await self._load(student_id, attempt_id)
        attempt = loaded.attempt
        if attempt.status == "completed":
            return loaded
        now = datetime.now(UTC)
        answers = await self._answers(attempt.id)
        attempt.score = sum(1 for a in answers if a.correct)
        attempt.max_score = len(attempt.plan["order"])
        attempt.percent = (
            round(100 * attempt.score / attempt.max_score, 2) if attempt.max_score else 0
        )
        attempt.status = "completed"
        attempt.completed_at = now
        attempt.duration_ms = int((now - attempt.started_at).total_seconds() * 1000)
        due = loaded.assignment.due_at if loaded.assignment else None
        attempt.is_late = due is not None and now > due
        await self._session.flush()
        return loaded

    # --- internals -------------------------------------------------------

    async def _load(self, student_id: UUID, attempt_id: UUID) -> Loaded:
        attempt = (
            await self._session.execute(
                select(Attempt).where(Attempt.id == attempt_id, Attempt.student_id == student_id)
            )
        ).scalar_one_or_none()
        if attempt is None:
            raise NotFoundError("No such attempt.")
        learning_set = await self._session.get(LearningSet, attempt.set_id)
        version = await self._version(attempt.set_id, attempt.version)
        assignment = (
            await self._session.get(Assignment, attempt.assignment_id)
            if attempt.assignment_id
            else None
        )
        return Loaded(
            attempt=attempt,
            learning_set=learning_set,
            version=version,
            kind=self._kinds[attempt.kind],
            assignment=assignment,
            by_id={item["id"]: item for item in version.items},
        )

    async def _version(self, set_id: UUID, number: int) -> LearningSetVersion:
        version = (
            await self._session.execute(
                select(LearningSetVersion).where(
                    LearningSetVersion.set_id == set_id, LearningSetVersion.version == number
                )
            )
        ).scalar_one_or_none()
        if version is None:
            raise NotFoundError("That set isn't ready.")
        return version

    async def _attempts(
        self, student_id: UUID, *, assignment_id: UUID | None = None, set_id: UUID | None = None
    ) -> list[Attempt]:
        query = select(Attempt).where(Attempt.student_id == student_id)
        if assignment_id is not None:
            query = query.where(Attempt.assignment_id == assignment_id)
        else:
            query = query.where(Attempt.set_id == set_id, Attempt.assignment_id.is_(None))
        return list((await self._session.execute(query.order_by(Attempt.number))).scalars().all())

    async def _answers(self, attempt_id: UUID) -> list[AttemptAnswer]:
        return list(
            (
                await self._session.execute(
                    select(AttemptAnswer)
                    .where(AttemptAnswer.attempt_id == attempt_id)
                    .order_by(AttemptAnswer.answered_at)
                )
            )
            .scalars()
            .all()
        )

    async def completed_count(self, student_id: UUID, purpose: str) -> int:
        return int(
            await self._session.scalar(
                select(func.count())
                .select_from(Attempt)
                .join(LearningSet, LearningSet.id == Attempt.set_id)
                .where(
                    Attempt.student_id == student_id,
                    Attempt.status == "completed",
                    LearningSet.purpose == purpose,
                )
            )
            or 0
        )


def _plan(items: list[Item], *, shuffle_items: bool, shuffle_options: bool) -> dict[str, Any]:
    rng = random.SystemRandom()
    order = [item["id"] for item in items]
    if shuffle_items:
        rng.shuffle(order)
    options: dict[str, list[int]] = {}
    for item in items:
        if "options" in item:
            positions = list(range(len(item["options"])))
            if shuffle_options:
                rng.shuffle(positions)
            options[item["id"]] = positions
    return {"order": order, "options": options}


def _in_item_terms(response: dict[str, Any], order: list[int] | None) -> dict[str, Any]:
    """The response with a shown choice translated to the real option index."""
    if "choice" in response:
        shown = response.get("choice")
        valid = isinstance(shown, int) and not isinstance(shown, bool) and order is not None
        return {"choice": order[shown] if valid and 0 <= shown < len(order) else None}
    if "knew" in response:
        return {"knew": response.get("knew") is True}
    return {}


def _streak(answers: list[AttemptAnswer]) -> int:
    streak = 0
    for answer in reversed(answers):
        if not answer.correct:
            break
        streak += 1
    return streak


def _feedback(loaded: Loaded) -> str:
    if loaded.kind.name != "quiz":
        return "instant"
    return loaded.assignment.feedback_mode if loaded.assignment else "instant"


def _may_retake(assignment: Assignment, used: int) -> bool:
    if not assignment.allow_retakes:
        return False
    return assignment.max_attempts is None or used < assignment.max_attempts
