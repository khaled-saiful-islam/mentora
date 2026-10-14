"""A buddy that grows as its student learns, and the buddies a student meets
by earning badges (§28.3.1)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.badges.base import SkillTally
from app.db.models.attempt import StudentBadge
from app.db.models.growth import BuddyGrowth
from app.events.catalog import AttemptCompleted, BadgeAwarded
from app.growth.rules import (
    POINTS,
    badges_for_next,
    buddies_allowed,
    mastered,
    next_at,
    stage_for,
)
from app.services import growth_service
from app.services.family_service import FamilyService
from app.services.growth_service import GrowthService
from tests.play_helpers import shared

# --- the rules ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("points", "stage", "following"),
    [
        (0, 0, 40),
        (39, 0, 40),
        (40, 1, 200),
        (199, 1, 200),
        (200, 2, 600),
        (600, 3, None),
        (9999, 3, None),
    ],
)
def test_a_buddy_grows_through_four_stages(points: int, stage: int, following: int | None) -> None:
    assert stage_for(points) == stage
    assert next_at(points) == following


@pytest.mark.parametrize(
    ("badges", "allowed", "more"),
    [(0, 1, 3), (2, 1, 1), (3, 2, 3), (5, 2, 1), (6, 3, 3), (12, 5, None), (40, 5, None)],
)
def test_a_new_buddy_is_met_every_three_badges(badges: int, allowed: int, more: int | None) -> None:
    assert buddies_allowed(badges, 5) == allowed
    assert badges_for_next(badges, 5) == more


def test_a_skill_is_mastered_as_the_skill_master_badge_says() -> None:
    assert mastered(SkillTally("fractions", correct=8, total=10, sets=3))
    assert not mastered(SkillTally("fractions", correct=8, total=10, sets=2))
    assert not mastered(SkillTally("fractions", correct=5, total=7, sets=3))
    assert not mastered(SkillTally("general", correct=10, total=10, sets=5))


# --- growing --------------------------------------------------------------------


async def _play(c, assignment_id) -> None:
    attempt = (await c.post(f"/api/me/assignments/{assignment_id}/attempts")).json()
    for item in attempt["items"]:
        right = next(n for n, text in enumerate(item["options"]) if text.startswith("Right"))
        await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "choice": right, "time_ms": 800},
        )
    await c.post(f"/api/me/attempts/{attempt['id']}/complete")


async def _sources(session, student) -> list[str]:
    rows = await session.execute(
        select(BuddyGrowth.source).where(BuddyGrowth.student_id == student.id)
    )
    return sorted(rows.scalars().all())


async def test_finishing_work_well_grows_the_buddy_once(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], max_attempts=2)
    async with client(student) as c:
        before = (await c.get("/api/me/growth")).json()
        await _play(c, assignment.id)
        after = (await c.get("/api/me/growth")).json()
    assert (before["points"], before["stage"], before["arrived"]) == (0, 0, False)
    badges = after["badges"]
    assert after["points"] == POINTS["finished"] + POINTS["day"] + POINTS["stars"] + 3 * badges
    assert after["grew"] is (after["stage"] > 0)
    counted = await _sources(session, student)
    # The same set again the same day earns no more for finishing it.
    async with client(student) as c:
        await _play(c, assignment.id)
    again = await _sources(session, student)
    assert [s for s in again if s != "badge"] == [s for s in counted if s != "badge"]


async def test_a_badge_grows_the_buddy_once(session, student) -> None:
    service = GrowthService(session)
    event = BadgeAwarded(
        student_id=student.id, badge="perfect_score", name="Perfect", reason="", scope="a1"
    )
    await service.badge_awarded(event)
    await service.badge_awarded(event)
    await service.badge_awarded(
        BadgeAwarded(student_id=student.id, badge="perfect_score", name="P", reason="", scope="a2")
    )
    assert (await service.growth(student)).points == 2 * POINTS["badge"]


async def test_a_mastered_skill_grows_the_buddy_once_and_general_never(
    session, student, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def tallies(_session, _student_id):
        return (
            SkillTally("fractions", 9, 10, 3),
            SkillTally("decimals", 4, 10, 3),
            SkillTally("general", 10, 10, 9),
        )

    monkeypatch.setattr(growth_service, "skill_tallies", tallies)
    service = GrowthService(session)
    event = AttemptCompleted(
        attempt_id=uuid4(),
        student_id=student.id,
        student_name="Adam",
        set_id=uuid4(),
        title="Fractions",
        kind="quiz",
        percent=50.0,
    )
    await service.attempt_completed(event)
    await service.attempt_completed(event)
    growth = await service.growth(student)
    assert growth.skills_mastered == 1
    assert growth.points == POINTS["finished"] + POINTS["day"] + POINTS["skill"]


async def test_a_day_is_the_student_s_day_not_the_server_s(session, student) -> None:
    # 17:00 UTC is already tomorrow in Kuala Lumpur.
    late = datetime(2026, 10, 13, 17, 0, tzinfo=UTC)
    service = GrowthService(session, timezone="Asia/Kuala_Lumpur", clock=lambda: late)
    event = AttemptCompleted(
        attempt_id=uuid4(),
        student_id=student.id,
        student_name="Adam",
        set_id=uuid4(),
        title="x",
        kind="quiz",
        percent=10.0,
    )
    await service.attempt_completed(event)
    day = await session.scalar(
        select(BuddyGrowth.source_id).where(
            BuddyGrowth.student_id == student.id, BuddyGrowth.source == "day"
        )
    )
    assert day == "2026-10-14"


async def test_the_arrival_and_growth_are_celebrated_once(session, client, student) -> None:
    await GrowthService(session).badge_awarded(
        BadgeAwarded(student_id=student.id, badge="b", name="B", reason="", scope="")
    )
    async with client(student) as c:
        first = (await c.get("/api/me/growth")).json()
        seen = (await c.post("/api/me/growth/seen")).json()
    assert (first["arrived"], first["seen_points"]) == (False, 0)
    assert (seen["arrived"], seen["seen_points"], seen["grew"]) == (True, first["points"], False)


async def test_teachers_and_parents_keep_grown_buddies(session, teacher, account) -> None:
    parent = await account("parent", "Siti")
    for grown_up in (teacher, parent):
        growth = await GrowthService(session).growth(grown_up)
        assert (growth.stage, growth.grew, growth.arrived) == (3, False, True)


# --- meeting a new buddy -----------------------------------------------------------


async def _badges(session, student, n: int) -> None:
    for i in range(n):
        session.add(StudentBadge(student_id=student.id, badge=f"b{i}", scope="", detail={}))
    await session.flush()


async def test_a_new_buddy_is_earned_with_badges(session, client, account) -> None:
    student = await account("student", "Mei", buddy="kiko")
    async with client(student) as c:
        # Kiko has arrived: the baby was met, so the next buddy is earned.
        await c.post("/api/me/growth/seen")
        locked = await c.patch("/api/auth/me", json={"buddy": "momo"})
        assert locked.status_code == 403
        assert "3 more badges to meet Momo" in locked.json()["error"]["message"]
        await _badges(session, student, 3)
        met = await c.patch("/api/auth/me", json={"buddy": "momo"})
        assert met.status_code == 200 and met.json()["buddy"] == "momo"
        # Back to one already met: always free.
        assert (await c.patch("/api/auth/me", json={"buddy": "kiko"})).status_code == 200
        # A third needs three more badges.
        assert (await c.patch("/api/auth/me", json={"buddy": "rimau"})).status_code == 403
        growth = (await c.get("/api/me/growth")).json()
    assert growth["met"] == ["kiko", "momo"]
    assert (growth["may_meet"], growth["badges_for_next"]) == (0, 3)


async def test_a_student_s_first_buddy_is_theirs_to_pick_and_pick_again(
    session, client, account
) -> None:
    student = await account("student", "Ali")
    async with client(student) as c:
        assert (await c.patch("/api/auth/me", json={"buddy": "rimau"})).status_code == 200
        # "Pick again" on the welcome screen: still free, before any learning.
        assert (await c.patch("/api/auth/me", json={"buddy": "ollie"})).status_code == 200
        growth = (await c.get("/api/me/growth")).json()
        # Once the baby has arrived, a new one is earned.
        await c.post("/api/me/growth/seen")
        assert (await c.patch("/api/auth/me", json={"buddy": "kiko"})).status_code == 403
    assert growth["met"] == ["ollie"]


async def test_a_teacher_picks_any_buddy(client, teacher) -> None:
    async with client(teacher) as c:
        for buddy in ("ollie", "tompok"):
            assert (await c.patch("/api/auth/me", json={"buddy": buddy})).status_code == 200


# --- a parent sees it ------------------------------------------------------------------


async def test_a_parent_sees_how_grown_their_child_s_buddy_is(
    session, client, account
) -> None:
    child = await account("student", "Aina", buddy="momo")
    parent = await account("parent", "Siti")
    family = FamilyService(session)
    await family.connect(parent, (await family.invite_for(child)).code, "Mum")
    for i in range(14):
        await GrowthService(session).badge_awarded(
            BadgeAwarded(student_id=child.id, badge="b", name="B", reason="", scope=str(i))
        )
    async with client(parent) as c:
        children = (await c.get("/api/me/children")).json()["items"]
        overview = (await c.get(f"/api/me/children/{child.id}/overview")).json()
    assert [k["buddy_stage"] for k in children] == [1]
    assert (overview["growth"]["stage"], overview["growth"]["points"]) == (1, 42)
