"""What the attempts add up to — for a teacher, and for the student themselves.

A teacher sees an assignment by student, by question and by skill, filtered
to a group if they like. A student sees their own history and, across
everything they have done, which skills are strong and which to practise.
The score that counts for a class is each student's *first* completed
attempt; retakes show as the best score beside it.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models.attempt import Attempt, AttemptAnswer
from app.db.models.classroom import ClassGroup, GroupMember
from app.db.models.learning import Assignment, LearningSet, LearningSetVersion
from app.db.models.user import User
from app.events.bus import EventBus
from app.services.assignment_service import AssignmentService

STRONG = 0.8
WEAK = 0.5
MIN_ANSWERS = 2


@dataclass(frozen=True, slots=True)
class StudentRow:
    student_id: UUID
    name: str
    buddy: str | None
    status: str  # not_started | in_progress | completed
    first: float | None
    best: float | None
    attempts: int
    late: bool
    completed_at: Any
    latest_attempt_id: UUID | None


@dataclass(frozen=True, slots=True)
class QuestionRow:
    item_id: str
    prompt: str
    skill: str
    answered: int
    correct: int
    choices: list[int]  # how many chose each original option (quizzes)
    answer: int | None


@dataclass(frozen=True, slots=True)
class AssignmentResults:
    assignment: Assignment
    students: list[StudentRow]
    questions: list[QuestionRow]
    skills: list[dict[str, Any]]
    heat: dict[str, dict[str, float]]  # student id -> skill -> mastery
    distribution: list[int]  # ten buckets of 10 points
    average: float | None
    median: float | None


class ResultsService:
    def __init__(self, session: AsyncSession, bus: EventBus) -> None:
        self._session = session
        self._bus = bus

    # --- teachers -----------------------------------------------------------

    async def for_assignment(
        self, teacher_id: UUID, assignment_id: UUID, group_id: UUID | None = None
    ) -> AssignmentResults:
        assignment = await self._owned(teacher_id, assignment_id)
        version = await self._version(assignment.set_id, assignment.version)
        students = await self._audience(assignment, group_id)
        attempts = await self._attempts_by_student(assignment.id)
        rows = [_row(user, attempts.get(user.id, [])) for user in students]
        firsts = {r.student_id: r.first for r in rows if r.first is not None}
        firsts_ids = [
            a.id for s in students for a in attempts.get(s.id, [])[:1] if a.status == "completed"
        ]
        answers = await self._answers(firsts_ids)
        by_student = {a.id: a.student_id for s in students for a in attempts.get(s.id, [])}
        return AssignmentResults(
            assignment=assignment,
            students=sorted(rows, key=lambda r: (r.status != "completed", -(r.first or 0), r.name)),
            questions=_questions(version.items, answers),
            skills=list(version.skills),
            heat=_heat(answers, by_student),
            distribution=_buckets(list(firsts.values())),
            average=round(statistics.fmean(firsts.values()), 1) if firsts else None,
            median=round(statistics.median(firsts.values()), 1) if firsts else None,
        )

    async def student_answers(
        self, teacher_id: UUID, assignment_id: UUID, student_id: UUID
    ) -> dict[str, Any]:
        """One student's attempts at an assignment, every answer, for the
        teacher's drill-down."""
        assignment = await self._owned(teacher_id, assignment_id)
        attempts = (await self._attempts_by_student(assignment.id)).get(student_id, [])
        audience = await AssignmentService(self._session, self._bus).audience(assignment)
        if not attempts and student_id not in audience:
            raise NotFoundError("That student isn't in this assignment.")
        version = await self._version(assignment.set_id, assignment.version)
        answers = await self._answers([a.id for a in attempts])
        return {"attempts": attempts, "items": version.items, "answers": list(answers)}

    # --- students -----------------------------------------------------------

    async def history(self, student_id: UUID, limit: int = 50) -> list[tuple[Attempt, LearningSet]]:
        rows = await self._session.execute(
            select(Attempt, LearningSet)
            .join(LearningSet, LearningSet.id == Attempt.set_id)
            .where(Attempt.student_id == student_id, Attempt.status == "completed")
            .order_by(Attempt.completed_at.desc())
            .limit(limit)
        )
        return [(a, s) for a, s in rows.all()]

    async def insights(self, student_id: UUID) -> dict[str, Any]:
        rows = await self._session.execute(
            select(
                AttemptAnswer.skill,
                AttemptAnswer.correct,
                LearningSet.subject,
                LearningSetVersion.skills,
            )
            .join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
            .join(LearningSet, LearningSet.id == Attempt.set_id)
            .join(
                LearningSetVersion,
                (LearningSetVersion.set_id == Attempt.set_id)
                & (LearningSetVersion.version == Attempt.version),
            )
            .where(Attempt.student_id == student_id, Attempt.status == "completed")
        )
        tally: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])
        labels: dict[str, str] = {}
        for skill, correct, subject, skills in rows.all():
            labels.update({s["slug"]: s["label"] for s in skills})
            counts = tally[(subject or "General", skill)]
            counts[1] += 1
            counts[0] += 1 if correct else 0
        return _insights(tally, labels)

    # --- internals ----------------------------------------------------------

    async def _owned(self, teacher_id: UUID, assignment_id: UUID) -> Assignment:
        found = (
            await self._session.execute(
                select(Assignment).where(
                    Assignment.id == assignment_id, Assignment.teacher_id == teacher_id
                )
            )
        ).scalar_one_or_none()
        if found is None:
            raise NotFoundError("No such assignment.")
        return found

    async def _version(self, set_id: UUID, number: int) -> LearningSetVersion:
        return (
            await self._session.execute(
                select(LearningSetVersion).where(
                    LearningSetVersion.set_id == set_id, LearningSetVersion.version == number
                )
            )
        ).scalar_one()

    async def _audience(self, assignment: Assignment, group_id: UUID | None) -> list[User]:
        ids = await AssignmentService(self._session, self._bus).audience(assignment)
        # Students who did it and have since left stay in the results.
        done = select(Attempt.student_id).where(Attempt.assignment_id == assignment.id)
        query = select(User).where(User.id.in_(ids) | User.id.in_(done))
        if group_id is not None:
            in_group = (
                select(GroupMember.student_id)
                .join(ClassGroup, ClassGroup.id == GroupMember.group_id)
                .where(ClassGroup.id == group_id, ClassGroup.class_id == assignment.class_id)
            )
            query = query.where(User.id.in_(in_group))
        return list((await self._session.execute(query)).scalars().all())

    async def _attempts_by_student(self, assignment_id: UUID) -> dict[UUID, list[Attempt]]:
        found = (
            (
                await self._session.execute(
                    select(Attempt)
                    .where(Attempt.assignment_id == assignment_id)
                    .order_by(Attempt.number)
                )
            )
            .scalars()
            .all()
        )
        grouped: dict[UUID, list[Attempt]] = defaultdict(list)
        for attempt in found:
            grouped[attempt.student_id].append(attempt)
        return grouped

    async def _answers(self, attempt_ids: list[UUID]) -> list[AttemptAnswer]:
        if not attempt_ids:
            return []
        return list(
            (
                await self._session.execute(
                    select(AttemptAnswer).where(AttemptAnswer.attempt_id.in_(attempt_ids))
                )
            )
            .scalars()
            .all()
        )


def _row(user: User, attempts: list[Attempt]) -> StudentRow:
    completed = [a for a in attempts if a.status == "completed"]
    first = next((a for a in attempts if a.number == 1 and a.status == "completed"), None)
    status = "completed" if completed else "in_progress" if attempts else "not_started"
    latest = attempts[-1] if attempts else None
    return StudentRow(
        student_id=user.id,
        name=user.display_name or user.sign_in_name,
        buddy=user.buddy,
        status=status,
        first=float(first.percent) if first else None,
        best=max(float(a.percent) for a in completed) if completed else None,
        attempts=len(completed),
        late=bool(first and first.is_late),
        completed_at=first.completed_at if first else None,
        latest_attempt_id=latest.id if latest else None,
    )


def _questions(items: list[dict[str, Any]], answers: list[AttemptAnswer]) -> list[QuestionRow]:
    by_item: dict[str, list[AttemptAnswer]] = defaultdict(list)
    for answer in answers:
        by_item[answer.item_id].append(answer)
    rows = []
    for item in items:
        mine = by_item.get(item["id"], [])
        choices = [0] * len(item.get("options", []))
        for answer in mine:
            choice = answer.response.get("choice")
            if isinstance(choice, int) and 0 <= choice < len(choices):
                choices[choice] += 1
        rows.append(
            QuestionRow(
                item_id=item["id"],
                prompt=item.get("prompt") or item.get("front", ""),
                skill=item.get("skill", "general"),
                answered=len(mine),
                correct=sum(1 for a in mine if a.correct),
                choices=choices,
                answer=item.get("answer"),
            )
        )
    return rows


def _heat(
    answers: list[AttemptAnswer], by_attempt: dict[UUID, UUID]
) -> dict[str, dict[str, float]]:
    tally: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for answer in answers:
        student = str(by_attempt.get(answer.attempt_id))
        counts = tally[student][answer.skill]
        counts[1] += 1
        counts[0] += 1 if answer.correct else 0
    return {
        s: {k: round(c / t, 3) for k, (c, t) in skills.items() if t} for s, skills in tally.items()
    }


def _buckets(percents: list[float]) -> list[int]:
    buckets = [0] * 10
    for percent in percents:
        buckets[min(9, int(percent // 10))] += 1
    return buckets


def _insights(tally: dict[tuple[str, str], list[int]], labels: dict[str, str]) -> dict[str, Any]:
    skills = []
    for (subject, slug), (correct, total) in tally.items():
        mastery = correct / total if total else 0.0
        level = (
            "strong"
            if total >= MIN_ANSWERS and mastery >= STRONG
            else "practise"
            if total >= MIN_ANSWERS and mastery < WEAK
            else "growing"
        )
        skills.append(
            {
                "subject": subject,
                "slug": slug,
                "label": labels.get(slug, slug),
                "correct": correct,
                "total": total,
                "mastery": round(mastery, 3),
                "level": level,
            }
        )
    skills.sort(key=lambda s: (-s["mastery"], -s["total"]))
    return {
        "skills": skills,
        "strengths": [s for s in skills if s["level"] == "strong"][:5],
        "practise": sorted(
            [s for s in skills if s["level"] == "practise"], key=lambda s: s["mastery"]
        )[:5],
    }
