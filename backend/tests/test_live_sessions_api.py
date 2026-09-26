"""Live sessions through the API: a teacher sets one up for a group, the lesson
is written and recorded, and scheduling puts it on exactly that group's
schedule — with a notification — and nobody else's."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import select

from app.api.deps import get_live_plan_service
from app.core.config import get_settings
from app.db.models.notification import Notification
from app.live.audio import AudioCache, Narrator
from app.live.planner import LessonPlanner
from app.services.jobs import jobs
from app.services.live_plan_service import LivePlanService
from tests.learning_fakes import FakeModel
from tests.live_fakes import SETTINGS, answers
from tests.test_learning_api import _admit
from tests.test_live_voice import FakeSpeech


@pytest.fixture
def live(client, session, tmp_path: Path):
    """`live(user)`: a client whose planner and voice are scripted fakes."""
    voice = FakeSpeech()

    @asynccontextmanager
    async def same_session():
        yield session

    def build() -> LivePlanService:
        return LivePlanService(
            settings=get_settings(),
            session_maker=same_session,
            planner_factory=lambda meter: LessonPlanner(FakeModel(answers(), meter), None),
            narrator=Narrator(voice, AudioCache(tmp_path)),
        )

    def make(user):
        c = client(user)
        c._transport.app.dependency_overrides[get_live_plan_service] = build  # noqa: SLF001
        return c

    make.voice = voice
    return make


async def _room(live, session, teacher, members, others=()) -> dict:
    """A class with a group of `members`, and `others` in the class but not the group."""
    async with live(teacher) as c:
        room = (await c.post("/api/classes", json={"name": "5 Bestari"})).json()
        code = (await c.get(f"/api/classes/{room['id']}/invite")).json()["code"]
    await _admit(session, teacher, room["id"], code, [*members, *others])
    async with live(teacher) as c:
        group = (await c.post(f"/api/classes/{room['id']}/groups", json={"name": "Stars"})).json()
        put = await c.put(
            f"/api/classes/{room['id']}/groups/{group['id']}/members",
            json={"student_ids": [str(m.id) for m in members]},
        )
        assert put.status_code == 200, put.text
    return {"class_id": room["id"], "group_id": group["id"]}


async def _made(live, teacher, where: dict) -> dict:
    async with live(teacher) as c:
        made = await c.post("/api/live-sessions", json={**where, "settings": SETTINGS})
    assert made.status_code == 201, made.text
    return made.json()


async def _wait(session_id: str, user) -> None:
    job = jobs.find(UUID(session_id), user.id)
    assert job is not None
    await asyncio.wait_for(job.task, 10)


async def _approved(live, teacher, where: dict) -> dict:
    made = await _made(live, teacher, where)
    async with live(teacher) as c:
        assert (await c.post(f"/api/live-sessions/{made['id']}/plan")).status_code == 202
    await _wait(made["id"], teacher)
    async with live(teacher) as c:
        assert (await c.post(f"/api/live-sessions/{made['id']}/approve")).status_code == 202
    await _wait(made["id"], teacher)
    return made


async def test_a_teacher_sets_up_a_session_for_one_of_their_groups(
    live, session, teacher, account
) -> None:
    kid = await account("student", "Aina Binti Ali")
    where = await _room(live, session, teacher, [kid])
    made = await _made(live, teacher, where)
    assert made["status"] == "draft"
    assert made["title"] == "photosynthesis"
    assert made["students"] == 1
    assert made["group_name"] == "Stars"
    assert made["settings"]["approach"] == "storytelling"


async def test_nobody_else_can_see_or_use_a_teachers_session(
    live, session, teacher, account
) -> None:
    where = await _room(live, session, teacher, [])
    made = await _made(live, teacher, where)
    stranger = await account("teacher")
    student = await account("student")
    async with live(stranger) as c:
        assert (await c.get(f"/api/live-sessions/{made['id']}")).status_code == 404
        assert (await c.post(f"/api/live-sessions/{made['id']}/plan")).status_code == 404
        # Nor make one for someone else's class.
        other = await c.post("/api/live-sessions", json={**where, "settings": SETTINGS})
        assert other.status_code == 404
    async with live(student) as c:
        assert (await c.get("/api/live-sessions")).status_code == 403
        assert (
            await c.post("/api/live-sessions", json={**where, "settings": SETTINGS})
        ).status_code == 403


async def test_a_group_from_another_class_is_refused(live, session, teacher) -> None:
    first = await _room(live, session, teacher, [])
    second = await _room(live, session, teacher, [])
    async with live(teacher) as c:
        mixed = await c.post(
            "/api/live-sessions",
            json={
                "class_id": first["class_id"],
                "group_id": second["group_id"],
                "settings": SETTINGS,
            },
        )
    assert mixed.status_code == 422


async def test_the_lesson_is_written_then_recorded_then_approved(
    live, session, teacher, account
) -> None:
    kid = await account("student", "Aina Binti Ali")
    where = await _room(live, session, teacher, [kid])
    made = await _approved(live, teacher, where)
    async with live(teacher) as c:
        detail = (await c.get(f"/api/live-sessions/{made['id']}")).json()
    assert detail["status"] == "approved"
    assert len(detail["segments"]) == 7
    first = detail["segments"][0]
    assert first["position"] == 0
    assert first["beats"][0]["id"] == "s0b1"
    assert first["beats"][0]["sentences"][0].startswith("Let's imagine")
    # Every sentence of the lesson was voiced, and what Astra says to Aina by name.
    said = live.voice.said
    assert "Let's imagine a little mango tree." in said
    assert any(line.endswith("Aina.") or "Aina" in line for line in said)
    assert len(said) == len(set(said))


async def test_editing_a_part_after_approval_means_recording_again(live, session, teacher) -> None:
    where = await _room(live, session, teacher, [])
    made = await _approved(live, teacher, where)
    async with live(teacher) as c:
        detail = (await c.get(f"/api/live-sessions/{made['id']}")).json()
        segment = detail["segments"][1]
        edited = await c.patch(
            f"/api/live-sessions/{made['id']}/segments/{segment['id']}",
            json={"title": "  Our tree  ", "beats": [{"say": "Water is H₂O.", "pause": "think"}]},
        )
        after = (await c.get(f"/api/live-sessions/{made['id']}")).json()
    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Our tree"
    assert edited.json()["beats"] == [
        {
            "id": "s1b1",
            "say": "Water is H two O.",
            "show": None,
            "pause": "think",
            "sentences": ["Water is H two O."],
        }
    ]
    assert after["status"] == "planned"


async def test_a_part_can_be_rewritten_as_the_teacher_asks(live, session, teacher) -> None:
    where = await _room(live, session, teacher, [])
    made = await _approved(live, teacher, where)
    async with live(teacher) as c:
        segment = (await c.get(f"/api/live-sessions/{made['id']}")).json()["segments"][2]
        rewritten = await c.post(
            f"/api/live-sessions/{made['id']}/segments/{segment['id']}/rewrite",
            json={"instruction": "Use a durian as the example"},
        )
    assert rewritten.status_code == 200, rewritten.text
    assert rewritten.json()["title"] == "Rewritten 0"
    assert rewritten.json()["beats"][0]["id"] == "s2b1"


async def test_scheduling_puts_it_on_the_groups_schedule_only(
    live, session, teacher, account
) -> None:
    inside = await account("student", "Aina")
    outside = await account("student", "Hafiz")
    where = await _room(live, session, teacher, [inside], others=[outside])
    made = await _approved(live, teacher, where)
    at = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    async with live(teacher) as c:
        scheduled = await c.post(f"/api/live-sessions/{made['id']}/schedule", json={"at": at})
    assert scheduled.status_code == 200, scheduled.text
    assert scheduled.json()["status"] == "scheduled"

    async with live(inside) as c:
        mine = (await c.get("/api/me/live-sessions")).json()
        ics = await c.get(f"/api/me/live-sessions/{made['id']}/calendar.ics")
    assert [s["id"] for s in mine["upcoming"]] == [made["id"]]
    assert mine["upcoming"][0]["teacher_name"]
    assert ics.status_code == 200 and "BEGIN:VEVENT" in ics.text and "TRIGGER:-PT15M" in ics.text

    async with live(outside) as c:
        assert (await c.get("/api/me/live-sessions")).json()["upcoming"] == []
        assert (await c.get(f"/api/me/live-sessions/{made['id']}/calendar.ics")).status_code == 404

    # Only this test's students: the database is shared with other test data.
    mine_only = Notification.user_id.in_([inside.id, outside.id])
    query = select(Notification).where(Notification.type == "live_scheduled", mine_only)
    notes = (await session.execute(query)).scalars().all()
    assert [n.user_id for n in notes] == [inside.id]
    assert notes[0].payload["title"] == "photosynthesis"


async def test_only_an_approved_lesson_can_be_scheduled_and_not_in_the_past(
    live, session, teacher
) -> None:
    where = await _room(live, session, teacher, [])
    made = await _made(live, teacher, where)
    async with live(teacher) as c:
        early = await c.post(f"/api/live-sessions/{made['id']}/schedule", json={})
    assert early.status_code == 422
    approved = await _approved(live, teacher, where)
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    async with live(teacher) as c:
        late = await c.post(f"/api/live-sessions/{approved['id']}/schedule", json={"at": past})
        now = await c.post(f"/api/live-sessions/{approved['id']}/schedule", json={})
    assert late.status_code == 422
    assert now.status_code == 200


async def test_cancelling_tells_the_group_and_takes_it_off_their_schedule(
    live, session, teacher, account
) -> None:
    kid = await account("student", "Aina")
    where = await _room(live, session, teacher, [kid])
    made = await _approved(live, teacher, where)
    async with live(teacher) as c:
        await c.post(f"/api/live-sessions/{made['id']}/schedule", json={})
        cancelled = await c.post(f"/api/live-sessions/{made['id']}/cancel")
    assert cancelled.json()["status"] == "cancelled"
    async with live(kid) as c:
        assert (await c.get("/api/me/live-sessions")).json()["upcoming"] == []
    kinds = (
        (await session.execute(select(Notification.type).where(Notification.user_id == kid.id)))
        .scalars()
        .all()
    )
    assert "live_cancelled" in kinds


async def test_reference_files_are_read_into_text(live, session, teacher) -> None:
    where = await _room(live, session, teacher, [])
    made = await _made(live, teacher, where)
    async with live(teacher) as c:
        up = await c.post(
            f"/api/live-sessions/{made['id']}/documents",
            files={"file": ("notes.txt", b"Plants make food from light.", "text/plain")},
        )
        picture = await c.post(
            f"/api/live-sessions/{made['id']}/documents",
            files={"file": ("leaf.png", b"\x89PNG....", "image/png")},
        )
        listed = (await c.get(f"/api/live-sessions/{made['id']}")).json()["documents"]
        gone = await c.delete(f"/api/live-sessions/{made['id']}/documents/{up.json()['id']}")
    assert up.status_code == 201, up.text
    assert up.json()["words"] == 5
    assert picture.status_code == 422
    assert [d["filename"] for d in listed] == ["notes.txt"]
    assert gone.status_code == 204


async def test_a_breakdown_can_be_suggested(live, teacher) -> None:
    async with live(teacher) as c:
        suggested = await c.post(
            "/api/live-sessions/breakdown",
            json={"subject": "Science", "topic": "photosynthesis", "grade_level": "year_5"},
        )
    assert suggested.json()["parts"] == ["What plants need", "Inside a leaf", "Making food"]


async def test_templates_keep_a_setup_to_start_from(live, teacher, account) -> None:
    async with live(teacher) as c:
        made = await c.post(
            "/api/live-templates", json={"name": "Science story", "settings": SETTINGS}
        )
        renamed = await c.patch(
            f"/api/live-templates/{made.json()['id']}", json={"name": "Year 5 science"}
        )
        listed = (await c.get("/api/live-templates")).json()["items"]
    assert made.status_code == 201
    assert renamed.json()["name"] == "Year 5 science"
    assert [t["name"] for t in listed] == ["Year 5 science"]
    other = await account("teacher")
    async with live(other) as c:
        assert (await c.get("/api/live-templates")).json()["items"] == []
        assert (await c.delete(f"/api/live-templates/{made.json()['id']}")).status_code == 404
