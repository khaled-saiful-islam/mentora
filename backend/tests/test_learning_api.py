"""Making, editing and sharing sets over HTTP, with a scripted model.

The build runs as a real job; its session is this test's rolled-back one, so
nothing it saves outlives the test.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.api.deps import get_generation_service
from app.core.config import get_settings
from app.db.models.moderation import ModerationEvent
from app.db.models.notification import Notification
from app.guards.prompt_injection import PromptInjectionGuard
from app.learning.generator import LearningGenerator
from app.learning.registry import build_learning_kinds
from app.learning.research import Researcher
from app.services.generation_service import GenerationService
from app.services.jobs import jobs
from app.services.quota import TokenQuota
from tests.learning_fakes import GOOD_RESULTS, FakeModel, FakeSearch, happy


@pytest.fixture
def scripted(session):
    """Point the generation service at the scripted model and this session."""
    state = {"answers": happy(), "per_day": 10}

    @asynccontextmanager
    async def same_session():
        yield session

    def build():
        return GenerationService(
            kinds=build_learning_kinds(),
            settings=get_settings().model_copy(
                update={"student_practice_per_day": state["per_day"]}
            ),
            session_maker=same_session,
            generator_factory=lambda kind, meter: LearningGenerator(
                FakeModel(state["answers"], meter),
                Researcher(FakeSearch(GOOD_RESULTS), None, PromptInjectionGuard()),
                kind,
                meter,
            ),
        )

    return state, build


@pytest.fixture
def api(client, scripted):
    """`api(user)`: a client signed in as `user`, with scripted generation."""
    _, build = scripted

    def make(user):
        c = client(user)
        c._transport.app.dependency_overrides[get_generation_service] = build  # noqa: SLF001
        return c

    return make


async def _build(api, user, **body) -> dict:
    payload = {
        "kind": "quiz",
        "topic": "photosynthesis",
        "subject": "Science",
        "grade_level": "year_5",
        "count": 5,
        **body,
    }
    async with api(user) as c:
        started = await c.post("/api/learning-sets/generate", json=payload)
    assert started.status_code == 202, started.text
    made = started.json()
    job = jobs.find(UUID(made["id"]), user.id)
    await asyncio.wait_for(job.task, 5)
    async with api(user) as c:
        return (await c.get(f"/api/learning-sets/{made['id']}")).json()


async def test_a_teacher_makes_a_quiz_and_it_is_ready_with_its_items(api, teacher) -> None:
    detail = await _build(api, teacher)
    assert detail["status"] == "ready"
    assert detail["purpose"] == "assign"
    assert detail["title"] == "Photosynthesis Quest"
    assert len(detail["items"]) == 5
    assert detail["grounded"] is True
    assert {s["host"] for s in detail["sources"]} == {"britannica.com", "example-blog.com"}


async def test_the_stream_replays_the_whole_build(api, teacher) -> None:
    detail = await _build(api, teacher)
    job = jobs.find(UUID(detail["id"]), teacher.id)
    events = [e async for e in job.follow()]
    kinds = [e["type"] for e in events]
    assert kinds[0] == "stage"
    assert "sources" in kinds and "skills" in kinds and "items" in kinds
    assert kinds[-1] == "done"


async def test_a_refused_topic_leaves_a_refused_set_and_a_log_line(
    session, api, teacher, scripted
) -> None:
    state, _ = scripted
    state["answers"] = happy(check={"ok": False, "reason": "Let's choose a school topic!"})
    detail = await _build(api, teacher, topic="video game cheats")
    assert detail["status"] == "refused"
    assert detail["failure"] == "Let's choose a school topic!"
    [logged] = (
        (
            await session.execute(
                select(ModerationEvent).where(ModerationEvent.set_id == UUID(detail["id"]))
            )
        )
        .scalars()
        .all()
    )
    assert (logged.kind, logged.user_id, logged.screen) == (
        "topic_refused",
        teacher.id,
        "topic_check",
    )
    assert "video game cheats" in logged.excerpt


async def test_building_spends_from_the_token_quota(session, api, teacher) -> None:
    before = (await TokenQuota(session).usage(teacher.id, None)).tokens
    await _build(api, teacher)
    assert (await TokenQuota(session).usage(teacher.id, None)).tokens > before


async def test_a_student_makes_private_practice_up_to_a_daily_limit(api, student, scripted) -> None:
    state, _ = scripted
    state["per_day"] = 1
    detail = await _build(api, student)
    assert detail["purpose"] == "practice"
    async with api(student) as c:
        again = await c.post(
            "/api/learning-sets/generate", json={"kind": "flashcard", "topic": "planets"}
        )
    assert again.status_code == 429
    assert "daily limit" in again.json()["error"]["message"]


async def test_editing_an_unshared_set_changes_it_in_place(api, teacher) -> None:
    detail = await _build(api, teacher)
    items = detail["items"]
    items[0] = {**items[0], "prompt": "Which part of the plant absorbs light?"}
    async with api(teacher) as c:
        edited = (
            await c.patch(
                f"/api/learning-sets/{detail['id']}", json={"items": items, "title": "Leaves"}
            )
        ).json()
    assert edited["version"] == 1
    assert edited["title"] == "Leaves"
    assert edited["items"][0]["prompt"] == "Which part of the plant absorbs light?"


async def test_an_incomplete_item_is_refused_by_number(api, teacher) -> None:
    detail = await _build(api, teacher)
    items = detail["items"]
    items[2] = {**items[2], "options": ["only", "three", "options"]}
    async with api(teacher) as c:
        response = await c.patch(f"/api/learning-sets/{detail['id']}", json={"items": items})
    assert response.status_code == 422
    assert "Question 3" in response.json()["error"]["message"]


async def _class_with(api, teacher) -> dict:
    """A class made through the API, and its code."""
    async with api(teacher) as c:
        room = (await c.post("/api/classes", json={"name": "5 Bestari"})).json()
        code = (await c.get(f"/api/classes/{room['id']}/invite")).json()["code"]
    return {"room": room, "code": code}


async def _admit(session, teacher, room_id, code, students) -> None:
    from app.events.registry import build_bus
    from app.services.membership_service import MembershipService

    memberships = MembershipService(session, build_bus())
    for student in students:
        await memberships.request(student, code)
    await memberships.approve_all(teacher.id, UUID(room_id))


async def test_sharing_with_the_whole_class_tells_every_student(
    session, api, teacher, account
) -> None:
    kids = [await account("student") for _ in range(3)]
    made = await _class_with(api, teacher)
    await _admit(session, teacher, made["room"]["id"], made["code"], kids)
    detail = await _build(api, teacher)

    async with api(teacher) as c:
        shared = await c.post(
            "/api/assignments",
            json={"set_id": detail["id"], "class_id": made["room"]["id"], "feedback_mode": "end"},
        )
    assert shared.status_code == 201, shared.text
    body = shared.json()
    assert (body["audience"], body["version"], body["feedback_mode"]) == (3, 1, "end")
    # Scoped to this assignment: the dev database may hold real shares too.
    told = (
        (
            await session.execute(
                select(Notification.user_id).where(
                    Notification.type == "assignment_shared",
                    Notification.payload["assignment_id"].astext == body["id"],
                )
            )
        )
        .scalars()
        .all()
    )
    assert set(told) == {k.id for k in kids}


async def test_sharing_with_a_group_tells_only_the_group(session, api, teacher, account) -> None:
    kids = [await account("student") for _ in range(3)]
    made = await _class_with(api, teacher)
    room_id = made["room"]["id"]
    await _admit(session, teacher, room_id, made["code"], kids)
    async with api(teacher) as c:
        group = (await c.post(f"/api/classes/{room_id}/groups", json={"name": "Readers"})).json()
        await c.put(
            f"/api/classes/{room_id}/groups/{group['id']}/members",
            json={"student_ids": [str(kids[0].id)]},
        )
    detail = await _build(api, teacher)
    async with api(teacher) as c:
        shared = (
            await c.post(
                "/api/assignments",
                json={"set_id": detail["id"], "class_id": room_id, "group_ids": [group["id"]]},
            )
        ).json()
    assert shared["audience"] == 1
    assert shared["group_names"] == ["Readers"]


async def test_editing_a_shared_set_forks_a_new_version(session, api, teacher, account) -> None:
    kid = await account("student")
    made = await _class_with(api, teacher)
    await _admit(session, teacher, made["room"]["id"], made["code"], [kid])
    detail = await _build(api, teacher)
    async with api(teacher) as c:
        await c.post(
            "/api/assignments", json={"set_id": detail["id"], "class_id": made["room"]["id"]}
        )
        items = detail["items"]
        items[0] = {**items[0], "prompt": "Changed after sharing?"}
        edited = (await c.patch(f"/api/learning-sets/{detail['id']}", json={"items": items})).json()
        assignments = (await c.get(f"/api/assignments?class_id={made['room']['id']}")).json()[
            "items"
        ]
    assert edited["version"] == 2
    assert assignments[0]["version"] == 1


@pytest.mark.parametrize(
    ("change", "status"),
    [
        ({"due_at": (datetime.now(UTC) - timedelta(days=1)).isoformat()}, 422),
        ({"feedback_mode": "sometimes"}, 422),
        ({"group_ids": [str(uuid4())]}, 422),
        ({"class_id": str(uuid4())}, 404),
    ],
)
async def test_bad_shares_are_refused(api, teacher, change, status) -> None:
    detail = await _build(api, teacher)
    async with api(teacher) as c:
        room = (await c.post("/api/classes", json={"name": "4 Cerdik"})).json()
        response = await c.post(
            "/api/assignments", json={"set_id": detail["id"], "class_id": room["id"], **change}
        )
    assert response.status_code == status, response.text


async def test_a_practice_set_cannot_be_shared_and_students_cannot_share(
    api, student, teacher
) -> None:
    practice = await _build(api, student)
    async with api(student) as c:
        assert (
            await c.post(
                "/api/assignments", json={"set_id": practice["id"], "class_id": str(uuid4())}
            )
        ).status_code == 403


async def test_another_teacher_cannot_see_or_edit_a_set(api, teacher, account) -> None:
    detail = await _build(api, teacher)
    stranger = await account("teacher")
    async with api(stranger) as c:
        assert (await c.get(f"/api/learning-sets/{detail['id']}")).status_code == 404
        assert (
            await c.patch(f"/api/learning-sets/{detail['id']}", json={"title": "Mine"})
        ).status_code == 404


async def test_rewriting_one_item_keeps_its_place(api, teacher, scripted) -> None:
    state, _ = scripted
    detail = await _build(api, teacher)
    target = detail["items"][1]
    state["answers"]["rewrite"] = {
        "item": {
            "prompt": "An easier question about light?",
            "options": ["Sun", "Moon", "Rock", "Sand"],
            "answer": 0,
            "skill": "light",
            "source_ids": ["s1"],
        }
    }
    async with api(teacher) as c:
        response = await c.post(
            f"/api/learning-sets/{detail['id']}/items/{target['id']}/rewrite",
            json={"instruction": "make it easier"},
        )
    assert response.status_code == 200, response.text
    item = response.json()["item"]
    assert item["id"] == target["id"]
    assert item["prompt"] == "An easier question about light?"


async def test_the_library_lists_and_archives(api, teacher) -> None:
    detail = await _build(api, teacher)
    async with api(teacher) as c:
        listed = (await c.get("/api/learning-sets?kind=quiz")).json()
        assert [s["id"] for s in listed["items"]] == [detail["id"]]
        assert (await c.delete(f"/api/learning-sets/{detail['id']}")).status_code == 204
        assert (await c.get("/api/learning-sets")).json()["items"] == []
        assert (await c.get("/api/learning-sets?archived=true")).json()["total"] == 1


async def test_makeable_lists_the_learning_kinds_for_each_role(api, teacher, student) -> None:
    async with api(teacher) as c:
        staff = (await c.get("/api/me/makeable")).json()["learning"]
    async with api(student) as c:
        kid = (await c.get("/api/me/makeable")).json()["learning"]
    assert {k["name"] for k in staff} == {"quiz", "flashcard", "study_guide"}
    assert {k["purpose"] for k in staff} == {"assign"}
    # Study guides are for teachers to make; a student practises with the rest.
    assert {k["name"] for k in kid} == {"quiz", "flashcard"}
    assert {k["purpose"] for k in kid} == {"practice"}
