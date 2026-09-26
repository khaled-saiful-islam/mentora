"""Practice made for a student from what they found hard in a shared set."""

from __future__ import annotations

import asyncio

from sqlalchemy import select, text

from app.core.config import get_settings
from app.db.models.learning import AutoPractice
from app.db.session import SessionFactory
from app.events.catalog import AttemptCompleted
from app.events.registry import build_bus
from app.services.after_commit import after_commit
from app.services.attempt_service import AttemptService
from app.services.auto_practice import (
    PER_DAY,
    AutoPracticeService,
    practice_topic,
    weak_skills,
)
from app.services.play_service import PlayService
from tests.play_helpers import ready_set, right_choice, shared

LABELS = {"light": "Light energy", "water": "Water"}


def test_weak_spots_are_the_skills_answered_mostly_wrong_weakest_first() -> None:
    answers = [
        ("light", True), ("light", True), ("light", False),
        ("water", False), ("water", False),
        ("soil", True), ("soil", False),
        ("air", False),
    ]  # fmt: skip
    assert weak_skills(answers, LABELS) == (
        ("air", "air"),
        ("water", "Water"),
        ("soil", "soil"),
    )
    assert weak_skills([("light", True)], LABELS) == ()


def test_the_practice_is_named_for_what_it_practises() -> None:
    assert practice_topic((("w", "Water"),), "Plants") == "Water, from Plants"
    two = (("w", "Water"), ("l", "Light energy"))
    assert practice_topic(two, "Plants") == "Water and Light energy, from Plants"


async def _finish(session, student, assignment, *, water_right: bool) -> AttemptCompleted:
    attempts = AttemptService(session)
    started = await attempts.start(student, assignment.id)
    for item in started.items:
        right = right_choice(started, item["id"])
        is_water = int(item["id"][1:]) % 2 == 0
        choice = right if (water_right or not is_water) else (right + 1) % 4
        await attempts.answer(student.id, started.attempt.id, item["id"], {"choice": choice}, 800)
    await PlayService(session, build_bus()).finish(student, started.attempt.id)
    return AttemptCompleted(
        attempt_id=started.attempt.id,
        student_id=student.id,
        student_name="x",
        set_id=assignment.set_id,
        title=assignment.title,
        kind="quiz",
        percent=60.0,
        assignment_id=assignment.id,
    )


async def test_a_hard_shared_quiz_plans_practice_on_just_the_weak_spots(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    event = await _finish(session, student, assignment, water_right=False)

    plan = await AutoPracticeService(session).plan(event)
    assert plan is not None
    assert plan.skills == (("water", "Water"),)
    assert plan.kind == "quiz"
    assert plan.topic == "Water, from plants"
    assert plan.from_title == assignment.title


async def test_nothing_weak_nothing_made(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    event = await _finish(session, student, assignment, water_right=True)
    assert await AutoPracticeService(session).plan(event) is None


async def test_own_practice_is_never_followed_up(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    event = await _finish(session, student, assignment, water_right=False)
    from dataclasses import replace

    assert await AutoPracticeService(session).plan(replace(event, assignment_id=None)) is None


async def test_one_per_assignment_and_a_few_a_day(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    event = await _finish(session, student, assignment, water_right=False)
    session.add(AutoPractice(student_id=student.id, assignment_id=assignment.id, skills=[]))
    await session.flush()
    assert await AutoPracticeService(session).plan(event) is None

    others = [await shared(session, teacher, [student]) for _ in range(PER_DAY)]
    for other in others:
        session.add(AutoPractice(student_id=student.id, assignment_id=other.id, skills=[]))
    await session.flush()
    fresh = await shared(session, teacher, [student])
    fresh_event = await _finish(session, student, fresh, water_right=False)
    assert await AutoPracticeService(session).plan(fresh_event) is None


async def test_made_for_you_lists_what_is_ready_and_whether_it_is_done(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    practice = await ready_set(session, student, purpose="practice")
    session.add(
        AutoPractice(
            student_id=student.id,
            assignment_id=assignment.id,
            set_id=practice.id,
            skills=[{"slug": "water", "label": "Water"}],
            status="ready",
        )
    )
    await session.flush()
    [made] = await AutoPracticeService(session).made_for(student.id)
    assert (made.set_id, made.skills, made.done) == (practice.id, ("Water",), False)
    assert made.from_title == assignment.title


async def test_practice_made_for_them_is_not_their_allowance(session, teacher, student) -> None:
    from app.services.learning_set_service import LearningSetService

    assignment = await shared(session, teacher, [student])
    gift = await ready_set(session, student, purpose="practice")
    session.add(AutoPractice(student_id=student.id, assignment_id=assignment.id, set_id=gift.id))
    await session.flush()
    await ready_set(session, student, purpose="practice")
    assert await LearningSetService(session).practice_made_today(student.id) == 1


async def test_making_waits_for_the_commit_and_never_happens_on_a_rollback() -> None:
    ran: list[str] = []

    async def start() -> None:
        ran.append("made")

    # As in a request: the work is queued inside a transaction under way.
    async with SessionFactory() as db:
        await db.execute(text("SELECT 1"))
        after_commit(db, start)
        await db.rollback()
        await db.commit()
    await asyncio.sleep(0)
    assert ran == []

    async with SessionFactory() as db:
        await db.execute(text("SELECT 1"))
        after_commit(db, start)
        await db.commit()
    await asyncio.sleep(0)
    assert ran == ["made"]


async def test_the_bell_says_whose_buddy_made_it(session, student) -> None:
    from app.db.models.notification import Notification
    from app.events.catalog import PracticeMade

    await build_bus().publish(
        PracticeMade(
            student_id=student.id,
            set_id=student.id,
            kind="quiz",
            title="Water",
            skills=("Water",),
            count=5,
            from_title="Plants quiz",
            buddy="kiko",
        ),
        session,
    )
    note = await session.scalar(select(Notification).where(Notification.user_id == student.id))
    assert note.type == "practice_ready"
    assert note.payload["buddy"] == "kiko" and note.payload["skills"] == ["Water"]


def test_settings_still_limit_students_own_practice() -> None:
    assert get_settings().student_practice_per_day >= 1
