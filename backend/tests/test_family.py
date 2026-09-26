"""A child's family: the invitation, the link it makes, and who may see what."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.db.models.notification import Notification
from app.events.registry import build_bus
from app.policies.capabilities import capabilities_for
from app.services.family_service import MAX_PARENTS, FamilyService
from tests.play_helpers import class_with


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 9, 26, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


def test_a_parent_sees_their_children_and_teaches_nobody() -> None:
    parent = capabilities_for("parent")
    assert parent.see_children
    assert not (parent.manage_classes or parent.share_learning_sets or parent.join_classes)
    assert not parent.studio_artifacts
    assert capabilities_for("student").invite_family
    assert not capabilities_for("teacher").invite_family


async def test_an_invitation_lasts_two_weeks_then_renews(session, account) -> None:
    child = await account("student", "Aina Sofea")
    clock = Clock()
    family = FamilyService(session, clock=clock)
    first = await family.invite_for(child)
    assert (await family.invite_for(child)).code == first.code
    old_code = first.code
    clock.now += timedelta(days=15)
    renewed = await family.invite_for(child)
    assert renewed.code != old_code
    assert (await family.preview(renewed.code)).first_name == "Aina"


async def test_a_dead_invitation_says_the_same_thing_every_way(session, account) -> None:
    child = await account("student")
    family = FamilyService(session)
    invite = await family.invite_for(child)
    old_token = invite.token
    await family.rotate(child)
    with pytest.raises(NotFoundError) as rotated:
        await family.preview(old_token)
    await family.set_enabled(child, False)
    with pytest.raises(NotFoundError) as disabled:
        await family.preview((await family.invite_for(child)).code)
    with pytest.raises(NotFoundError) as never:
        await family.preview("NOSUCH")
    assert str(rotated.value) == str(disabled.value) == str(never.value)


async def test_a_parent_connects_once_and_the_child_is_told(session, account) -> None:
    child = await account("student", "Aina")
    parent = await account("parent", "Siti")
    family = FamilyService(session, build_bus())
    code = (await family.invite_for(child)).code
    linked = await family.connect(parent, code.lower(), "Mum")
    again = await family.connect(parent, code, "Ignored")
    assert linked.student.id == again.student.id == child.id
    assert again.label == "Mum"
    [note] = (
        await session.scalars(select(Notification).where(Notification.user_id == child.id))
    ).all()
    assert note.type == "family_linked"
    assert note.payload == {"parent_name": "Siti", "label": "Mum"}
    [seen] = await family.parents(child.id)
    assert (seen.parent.id, seen.label) == (parent.id, "Mum")


async def test_only_a_parent_account_can_connect(session, account) -> None:
    child = await account("student")
    teacher = await account("teacher")
    code = (await FamilyService(session).invite_for(child)).code
    with pytest.raises(ForbiddenError):
        await FamilyService(session).connect(teacher, code)


async def test_a_child_has_at_most_four_parents(session, account) -> None:
    child = await account("student")
    family = FamilyService(session)
    code = (await family.invite_for(child)).code
    for _ in range(MAX_PARENTS):
        await family.connect(await account("parent"), code)
    with pytest.raises(ConflictError):
        await family.connect(await account("parent"), code)


async def test_a_child_not_linked_is_not_found(session, account) -> None:
    child = await account("student")
    stranger = await account("parent")
    with pytest.raises(NotFoundError):
        await FamilyService(session).child(stranger.id, child.id)


async def test_the_parent_can_disconnect(session, account) -> None:
    child = await account("student")
    parent = await account("parent")
    family = FamilyService(session)
    await family.connect(parent, (await family.invite_for(child)).code)
    await family.disconnect(parent.id, child.id)
    assert await family.children(parent.id) == []
    with pytest.raises(NotFoundError):
        await family.disconnect(parent.id, child.id)


# --- over HTTP ----------------------------------------------------------------------


async def test_signing_up_through_an_invitation_connects(client, session, account) -> None:
    child = await account("student", "Hafiz Rahman")
    code = (await FamilyService(session).invite_for(child)).code
    async with client() as c:
        made = await c.post(
            "/api/auth/signup/parent",
            json={"name": "Rahman", "email": "rahman@home.test", "password": "long-enough-1",
                  "invite": code, "label": "Dad"},
        )  # fmt: skip
        assert made.status_code == 201
        assert made.json()["role"] == "parent"
        assert made.json()["connect"] == {"status": "connected", "child_name": "Hafiz"}
        children = (await c.get("/api/me/children")).json()["items"]
    assert [(k["first_name"], k["label"]) for k in children] == [("Hafiz", "Dad")]


async def test_a_dead_invitation_never_blocks_signing_up(client) -> None:
    async with client() as c:
        made = await c.post(
            "/api/auth/signup/parent",
            json={"name": "Mei", "email": "mei@home.test", "password": "long-enough-1",
                  "invite": "NOSUCH"},
        )  # fmt: skip
    assert made.status_code == 201
    assert made.json()["connect"] == {"status": "invalid", "child_name": None}


async def test_a_child_s_family_page_and_what_it_shows_strangers(client, account) -> None:
    child = await account("student", "Aina", buddy="kiko")
    async with client(child) as c:
        mine = (await c.get("/api/me/family")).json()
        assert mine["parents"] == []
        assert mine["invite"]["url"].endswith(mine["invite"]["url"].rsplit("/", 1)[1])
    async with client() as c:
        seen = (await c.get(f"/api/family/invites/{mine['invite']['code']}")).json()
    assert seen == {"first_name": "Aina", "buddy": "kiko"}


async def test_the_parent_sees_the_child_s_classes_and_nobody_else_does(
    client, session, teacher, account
) -> None:
    child = await account("student")
    parent = await account("parent")
    stranger = await account("parent")
    class_id = await class_with(session, teacher, [child])
    family = FamilyService(session)
    await family.connect(parent, (await family.invite_for(child)).code, "Mum")
    async with client(parent) as c:
        classes = (await c.get(f"/api/me/children/{child.id}/classes")).json()["items"]
    assert [k["class_id"] for k in classes] == [str(class_id)]
    async with client(stranger) as c:
        assert (await c.get(f"/api/me/children/{child.id}/classes")).status_code == 404
    async with client(child) as c:
        assert (await c.delete(f"/api/me/children/{child.id}")).status_code == 403
    async with client(teacher) as c:
        members = (await c.get(f"/api/classes/{class_id}/members")).json()["items"]
    assert members[0]["parents"] == [f"{parent.display_name} (Mum)"]
