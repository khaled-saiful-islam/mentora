"""The Daily Quest (§28.3.4): five questions a day from the student's own
work, review first; skills moving through their boxes; a streak in the
student's day with freezes; a garden; and a class's quest for the week."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.db.models.growth import BuddyGrowth
from app.db.models.quest import DailyQuest, SkillMemory
from app.quests.rules import (
    MOST_FREEZES,
    due_on,
    next_box,
    streak_of,
    week_of,
)
from app.services.quest_service import Candidate, QuestService, pick
from tests.play_helpers import shared

TODAY = date(2026, 10, 14)

# --- the rules -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("box", "share", "to"), [(0, 1.0, 1), (5, 0.9, 5), (3, 0.3, 0), (2, 0.6, 2)]
)
def test_a_skill_moves_up_when_known_and_back_to_the_start_when_hard(
    box: int, share: float, to: int
) -> None:
    assert next_box(box, share) == to


def test_a_skill_comes_back_later_the_better_it_is_known() -> None:
    assert due_on(0, TODAY) == TODAY + timedelta(days=1)
    assert due_on(5, TODAY) == TODAY + timedelta(days=30)


def _days(*offsets: int) -> set[date]:
    return {TODAY - timedelta(days=n) for n in offsets}


def test_a_streak_counts_days_in_a_row_up_to_today() -> None:
    assert streak_of(_days(0, 1, 2), TODAY).days == 3
    # Today not yet: yesterday's streak still stands.
    assert streak_of(_days(1, 2), TODAY).days == 2
    assert streak_of(_days(1, 2), TODAY).today_done is False
    # A day missed with no freeze ends it.
    assert streak_of(_days(0, 2, 3), TODAY).days == 1
    assert streak_of(set(), TODAY).days == 0


def test_a_week_earns_a_freeze_that_covers_a_missed_day() -> None:
    week = _days(*range(2, 9))  # seven days in a row, ending the day before yesterday
    kept = streak_of(week | _days(0), TODAY)  # yesterday missed, today done
    assert (kept.days, kept.freezes) == (8, 0)
    many = streak_of(_days(*range(0, 60)), TODAY)
    assert many.freezes == MOST_FREEZES


def test_a_week_runs_monday_to_sunday() -> None:
    assert week_of(TODAY) == (date(2026, 10, 12), date(2026, 10, 18))


# --- picking a quest ----------------------------------------------------------------


def _candidate(set_id, n: int, skill: str) -> Candidate:
    return Candidate(set_id, {"id": f"q{n}", "skill": skill, "options": ["a", "b"]}, skill, "en")


def test_review_comes_first_and_a_question_got_wrong_before_first_of_all() -> None:
    a, b = uuid4(), uuid4()
    bank = [
        _candidate(a, 1, "light"),
        _candidate(a, 2, "light"),
        _candidate(a, 3, "water"),
        _candidate(b, 4, "soil"),
        _candidate(b, 5, "air"),
        _candidate(b, 6, "seeds"),
    ]
    memory = {
        "light": SkillMemory(skill="light", box=0, due_on=TODAY),
        "water": SkillMemory(skill="water", box=3, due_on=TODAY + timedelta(days=4)),
    }
    known = {(a, "q2"): False, (a, "q1"): True}
    picked, review = pick(bank, memory, known, TODAY, seed="x")
    assert review == 1
    assert picked[0].item["id"] == "q2"
    assert len(picked) == 5
    # New questions on as many different skills as there are.
    assert {c.skill for c in picked[1:]} >= {"soil", "air", "seeds"}


# --- a student's day ------------------------------------------------------------------


async def _play(c, path: str, *, wrong_on: str | None = None) -> str:
    attempt = (await c.post(path)).json()
    for item in attempt["items"]:
        right = next(i for i, text in enumerate(item["options"]) if text.startswith("Right"))
        # The shared quiz's q1, q3… are on light, the rest on water (play_helpers).
        n = int(item["id"][1:]) if item["id"].startswith("q") else 0
        skill = "light" if n % 2 else "water"
        choice = (right + 1) % 4 if skill == wrong_on else right
        await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "choice": choice, "time_ms": 700},
        )
    await c.post(f"/api/me/attempts/{attempt['id']}/complete")
    return attempt["id"]


async def test_a_student_with_no_work_yet_has_no_quest(client, student) -> None:
    async with client(student) as c:
        day = (await c.get("/api/me/day")).json()
    assert day["quest"] is None
    assert day["streak"] == {"days": 0, "freezes": 0, "today_done": False}


async def test_a_quest_is_made_from_the_student_s_own_work_once_a_day(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        await _play(c, f"/api/me/assignments/{assignment.id}/attempts", wrong_on="light")
        first = (await c.get("/api/me/day")).json()
        again = (await c.get("/api/me/day")).json()
        practice = (await c.get("/api/me/practice")).json()["items"]
    quest = first["quest"]
    assert quest is not None and quest["questions"] == 5 and quest["done"] is False
    assert again["quest"]["set_id"] == quest["set_id"]
    # Played from home, never kept as practice.
    assert quest["set_id"] not in [p["id"] for p in practice]
    assert first["streak"]["days"] == 1 and first["streak"]["today_done"] is True
    garden = {p["skill"]: p for p in first["garden"]}
    assert set(garden) == {"light", "water"}
    assert garden["light"]["box"] == 0 and garden["water"]["box"] == 1
    [room] = first["classes"]
    assert (room["done"], room["goal"]) == (0, 3)


async def test_finishing_the_quest_marks_it_done_grows_the_buddy_and_counts_for_the_class(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        await _play(c, f"/api/me/assignments/{assignment.id}/attempts")
        quest = (await c.get("/api/me/day")).json()["quest"]
        await _play(c, f"/api/me/practice/{quest['set_id']}/attempts")
        day = (await c.get("/api/me/day")).json()
    assert day["quest"]["done"] is True
    assert day["classes"][0]["done"] == 1
    sources = (
        await session.execute(
            select(BuddyGrowth.source).where(BuddyGrowth.student_id == student.id)
        )
    ).scalars().all()
    assert "quest" in sources


async def test_a_student_with_history_but_no_memory_gets_review_at_once(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        await _play(c, f"/api/me/assignments/{assignment.id}/attempts", wrong_on="light")
    # As before the quest existed: answers, and nothing remembered.
    for memory in (
        await session.execute(select(SkillMemory).where(SkillMemory.student_id == student.id))
    ).scalars():
        await session.delete(memory)
    await session.flush()
    quests = QuestService(session)
    quest = await quests.quest(student)
    assert quest is not None and quest.review >= 1
    memory = await quests.memory(student)
    assert memory["light"].due_on <= quests.today()


async def test_a_day_is_the_student_s_day(session, client, teacher, student) -> None:
    """17:00 UTC is already tomorrow in Kuala Lumpur."""
    late = datetime(2026, 10, 13, 17, 0, tzinfo=UTC)
    quests = QuestService(session, timezone="Asia/Kuala_Lumpur", clock=lambda: late)
    assert quests.today() == date(2026, 10, 14)
    made = await session.scalar(select(DailyQuest).where(DailyQuest.student_id == student.id))
    assert made is None
