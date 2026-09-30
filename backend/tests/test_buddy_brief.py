"""What a student's buddy knows about them (`services/buddy_brief.py`)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.db.models.live import LiveSession
from app.services.buddy_brief import KindRecord, Waiting, _kinds, in_order
from tests.live_fakes import SETTINGS
from tests.play_helpers import shared


async def _play(c, assignment, *, right_on: str) -> None:
    """Answer every question, right only on the one skill."""
    attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
    for item in attempt["items"]:
        want = "Right" if item["skill"] == right_on else "Wrong"
        choice = next(n for n, text in enumerate(item["options"]) if text.startswith(want))
        await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "choice": choice, "time_ms": 900},
        )
    await c.post(f"/api/me/attempts/{attempt['id']}/complete")


async def test_the_buddy_knows_what_is_waiting_and_how_it_has_gone(
    session, client, teacher, student
) -> None:
    now = datetime.now(UTC)
    soon = await shared(session, teacher, [student], due_at=now + timedelta(hours=20))
    played = await shared(session, teacher, [student], due_at=now + timedelta(days=5))
    async with client(student) as c:
        await _play(c, played, right_on="light")
        brief = (await c.get("/api/me/buddy")).json()

    assert brief["name"] == "Adam"
    assert brief["waiting_count"] == 1
    assert brief["waiting"][0]["title"] == soon.title
    assert (brief["due_soon"], brief["overdue"]) == (1, 0)
    # Three of five right: the three "light" questions.
    assert brief["recent"] == [{"title": played.title, "kind": "quiz", "percent": 60.0}]
    assert brief["kinds"] == [{"kind": "quiz", "average": 60.0, "count": 1}]
    assert brief["strengths"] == ["Light energy"]
    assert brief["practise"] == ["Water"]
    assert brief["streak"] == 1
    assert brief["next_lesson"] is None


async def test_the_buddy_knows_the_next_live_lesson(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    live = LiveSession(
        teacher_id=teacher.id,
        class_id=assignment.class_id,
        group_id=None,
        title="Plants",
        settings=SETTINGS,
        status="scheduled",
        scheduled_at=datetime.now(UTC) + timedelta(hours=3),
    )
    session.add(live)
    await session.commit()
    async with client(student) as c:
        brief = (await c.get("/api/me/buddy")).json()
    assert brief["next_lesson"]["id"] == str(live.id)
    assert brief["next_lesson"]["status"] == "scheduled"


async def test_only_a_student_has_a_buddy_brief(client, teacher) -> None:
    async with client(teacher) as c:
        assert (await c.get("/api/me/buddy")).status_code == 403


def test_each_kind_is_averaged_over_its_latest_tries() -> None:
    scores = [("quiz", 100.0), ("flashcard", 50.0), ("quiz", 50.0)] + [("quiz", 0.0)] * 20
    assert _kinds(scores) == (
        KindRecord(kind="quiz", average=15.0, count=10),
        KindRecord(kind="flashcard", average=50.0, count=1),
    )


def test_what_is_overdue_comes_first_then_what_is_due_soonest() -> None:
    later = Waiting("Later", "quiz", "2026-10-09T00:00:00+00:00", overdue=False)
    undated = Waiting("Whenever", "quiz", None, overdue=False)
    late = Waiting("Late", "quiz", "2026-09-01T00:00:00+00:00", overdue=True)
    sooner = Waiting("Sooner", "quiz", "2026-10-01T00:00:00+00:00", overdue=False)
    order = in_order([undated, later, late, sooner])
    assert [w.title for w in order] == ["Late", "Sooner", "Later", "Whenever"]
