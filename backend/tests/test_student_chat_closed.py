"""Chat is closed to students for now — at the API, not only in the menu.

They make practice sets and take their class's work; every route that is part
of the open-ended chat refuses them. Teachers keep all of it.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.policies.capabilities import capabilities_for

REFUSAL = "Chat isn't open to students yet."


def test_students_do_not_have_chat_and_staff_do() -> None:
    assert capabilities_for("student").use_chat is False
    assert capabilities_for("teacher").use_chat is True
    assert capabilities_for("admin").use_chat is True


def test_students_keep_making_practice_sets() -> None:
    """What stays open, so closing chat is not mistaken for closing learning."""
    caps = capabilities_for("student")
    assert caps.make_practice_sets and caps.take_assignments and caps.join_classes


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/chat/stream"),
        ("GET", f"/api/chat/live/{uuid4()}"),
        ("GET", "/api/conversations"),
        ("POST", "/api/conversations"),
        ("GET", f"/api/conversations/{uuid4()}"),
        ("GET", f"/api/conversations/{uuid4()}/documents"),
        ("GET", "/api/memories"),
    ],
)
async def test_every_chat_route_refuses_a_student(client, student, method, path) -> None:
    async with client(student) as api:
        response = await api.request(method, path, json={})

    assert response.status_code == 403, response.text
    assert response.json()["error"]["message"] == REFUSAL


async def test_a_teacher_still_has_their_conversations(client, teacher) -> None:
    async with client(teacher) as api:
        response = await api.get("/api/conversations")

    assert response.status_code == 200


async def test_the_browser_is_told_so_it_can_hide_the_chat(client, student) -> None:
    async with client(student) as api:
        me = (await api.get("/api/auth/me")).json()

    assert me["capabilities"]["use_chat"] is False
    assert me["capabilities"]["make_practice_sets"] is True
