"""Classes over HTTP: the whole path a class takes from creation to a group."""

from __future__ import annotations

from uuid import uuid4

import pytest


@pytest.fixture
async def room(client, teacher):
    async with client(teacher) as c:
        response = await c.post(
            "/api/classes",
            json={"name": "5 Bestari", "subject": "Science", "grade_level": "year_5"},
        )
    assert response.status_code == 201, response.text
    return response.json()


async def _invite(client, teacher, room) -> dict:
    async with client(teacher) as c:
        return (await c.get(f"/api/classes/{room['id']}/invite")).json()


async def test_a_new_class_comes_back_with_counts_and_a_label(room) -> None:
    assert room["grade_label"] == "Year 5"
    assert (room["students"], room["pending"], room["groups"]) == (0, 0, 0)


async def test_the_invite_has_a_link_and_a_code(client, teacher, room) -> None:
    invite = await _invite(client, teacher, room)
    assert invite["path"] == f"/join/{invite['token']}"
    assert len(invite["code"]) == 6


async def test_anyone_can_preview_an_invite_but_not_a_dead_one(client, teacher, room) -> None:
    invite = await _invite(client, teacher, room)
    async with client() as c:
        live = await c.get(f"/api/invites/{invite['code']}")
        dead = await c.get("/api/invites/NOPE42")
    assert live.status_code == 200
    assert live.json()["teacher_name"] == "Cikgu Aisyah"
    assert dead.status_code == 404
    assert "ask your teacher" in dead.json()["error"]["message"]


async def test_signing_up_through_a_link_asks_to_join_in_one_step(client, teacher, room) -> None:
    invite = await _invite(client, teacher, room)
    async with client() as c:
        response = await c.post(
            "/api/auth/signup/student",
            json={
                "name": "Mei",
                "grade_level": "year_5",
                "username": f"mei-{uuid4().hex[:6]}",
                "password": "hunter2hunter2",
                "invite_token": invite["token"],
            },
        )
    assert response.status_code == 201, response.text
    assert response.json()["join"] == {
        "status": "requested",
        "class_name": "5 Bestari",
        "teacher_name": "Cikgu Aisyah",
    }
    async with client(teacher) as c:
        waiting = (await c.get(f"/api/classes/{room['id']}/members?status=pending")).json()
        bell = (await c.get("/api/notifications")).json()
    assert [m["name"] for m in waiting["items"]] == ["Mei"]
    assert bell["unread"] == 1
    assert bell["items"][0]["type"] == "join_request"


async def test_a_dead_link_at_signup_still_makes_the_account(client) -> None:
    async with client() as c:
        response = await c.post(
            "/api/auth/signup/student",
            json={
                "name": "Ravi",
                "grade_level": "form_1",
                "username": f"ravi-{uuid4().hex[:6]}",
                "password": "hunter2hunter2",
                "invite_token": "no-such-token",
            },
        )
    assert response.status_code == 201
    assert response.json()["join"] == {
        "status": "invalid",
        "class_name": None,
        "teacher_name": None,
    }


async def test_an_existing_student_joins_and_is_approved(client, teacher, student, room) -> None:
    invite = await _invite(client, teacher, room)
    async with client(student) as c:
        joined = await c.post(f"/api/invites/{invite['token']}/join")
    assert joined.json()["status"] == "requested"

    async with client(teacher) as c:
        pending = (await c.get(f"/api/classes/{room['id']}/members?status=pending")).json()
        membership_id = pending["items"][0]["membership_id"]
        approved = await c.post(f"/api/classes/{room['id']}/members/{membership_id}/approve")
    assert approved.status_code == 204

    async with client(student) as c:
        mine = (await c.get("/api/me/classes")).json()["items"]
        bell = (await c.get("/api/notifications")).json()
    assert [(m["class_name"], m["status"]) for m in mine] == [("5 Bestari", "approved")]
    assert bell["items"][0]["type"] == "join_approved"


async def test_groups_hold_admitted_students(client, teacher, student, room) -> None:
    invite = await _invite(client, teacher, room)
    async with client(student) as c:
        await c.post(f"/api/invites/{invite['code']}/join")
    async with client(teacher) as c:
        assert (await c.post(f"/api/classes/{room['id']}/members/approve-all")).json() == {
            "approved": 1
        }
        group = (
            await c.post(
                f"/api/classes/{room['id']}/groups", json={"name": "Readers", "colour": "mint"}
            )
        ).json()
        filled = await c.put(
            f"/api/classes/{room['id']}/groups/{group['id']}/members",
            json={"student_ids": [str(student.id)]},
        )
        listed = (await c.get(f"/api/classes/{room['id']}/groups")).json()["items"]
    assert filled.json()["member_ids"] == [str(student.id)]
    assert listed[0]["name"] == "Readers"


async def test_another_teacher_gets_404_everywhere(client, account, room) -> None:
    stranger = await account("teacher")
    base = f"/api/classes/{room['id']}"
    async with client(stranger) as c:
        for method, path in [
            ("GET", base),
            ("PATCH", base),
            ("GET", f"{base}/invite"),
            ("GET", f"{base}/members"),
            ("GET", f"{base}/groups"),
            ("POST", f"{base}/members/approve-all"),
        ]:
            response = await c.request(method, path, json={})
            assert response.status_code == 404, (method, path, response.status_code)


async def test_students_cannot_run_classes_and_teachers_cannot_join(
    client, teacher, student, room
) -> None:
    invite = await _invite(client, teacher, room)
    async with client(student) as c:
        assert (await c.get("/api/classes")).status_code == 403
    async with client(teacher) as c:
        assert (await c.post(f"/api/invites/{invite['code']}/join")).status_code == 403
        assert (await c.get("/api/me/classes")).status_code == 403


async def test_reading_the_bell(client, teacher, student, room) -> None:
    invite = await _invite(client, teacher, room)
    async with client(student) as c:
        await c.post(f"/api/invites/{invite['code']}/join")
    async with client(teacher) as c:
        note = (await c.get("/api/notifications")).json()["items"][0]
        read = await c.post(f"/api/notifications/{note['id']}/read")
        count = (await c.get("/api/notifications/unread-count")).json()
    assert read.json()["read"] is True
    assert count == {"unread": 0}


async def test_archiving_and_restoring(client, teacher, room) -> None:
    async with client(teacher) as c:
        assert (await c.delete(f"/api/classes/{room['id']}")).status_code == 204
        assert (await c.get("/api/classes")).json()["items"] == []
        restored = await c.post(f"/api/classes/{room['id']}/restore")
    assert restored.json()["archived"] is False


async def test_the_stream_says_ready_then_passes_on_a_push(teacher) -> None:
    """The live stream, driven directly: ready first, then what the hub sends.

    Driven through the generator rather than an HTTP client, because an SSE
    response never ends and ASGITransport would wait for it to.
    """
    import asyncio

    from app.api.routes.notifications import _events
    from app.services.realtime import hub

    events = _events(teacher.id)
    assert (await anext(events))["event"] == "ready"
    pending = asyncio.create_task(anext(events))
    await asyncio.sleep(0)
    hub.publish(teacher.id, {"topic": "notifications"})
    frame = await asyncio.wait_for(pending, 1)
    assert frame["event"] == "notifications"
    await events.aclose()
