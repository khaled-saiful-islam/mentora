"""Work a parent sends home: making it, sending it, the child taking it, and
the parent hearing how it went."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db.models.notification import Notification
from app.services.family_service import FamilyService
from tests.play_helpers import ready_set
from tests.test_learning_api import _build, api, scripted  # noqa: F401

SOON = (datetime.now(UTC) + timedelta(days=2)).isoformat()


async def _family(session, account, label: str = "Mum"):
    child = await account("student", "Aina Sofea")
    parent = await account("parent", "Siti Aminah")
    family = FamilyService(session)
    await family.connect(parent, (await family.invite_for(child)).code, label)
    return parent, child


async def _notes(session, user_id, kind: str) -> list[Notification]:
    rows = await session.scalars(
        select(Notification).where(Notification.user_id == user_id, Notification.type == kind)
    )
    return list(rows.all())


async def _play(c, share_id: str) -> str:
    attempt = (await c.post(f"/api/me/from-home/{share_id}/attempts")).json()
    for item in attempt["items"]:
        right = next(n for n, text in enumerate(item["options"]) if text.startswith("Right"))
        await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "choice": right, "time_ms": 700},
        )
    finished = (await c.post(f"/api/me/attempts/{attempt['id']}/complete")).json()
    return finished


async def test_a_parent_makes_things_to_send_home_up_to_a_daily_limit(
    api,  # noqa: F811
    account,
    scripted,  # noqa: F811
) -> None:
    state, _ = scripted
    state["per_day"] = 1
    parent = await account("parent")
    detail = await _build(api, parent)
    assert detail["purpose"] == "family"
    async with api(parent) as c:
        again = await c.post("/api/learning-sets/generate", json={"kind": "quiz", "topic": "rain"})
        makeable = (await c.get("/api/me/makeable")).json()["learning"]
    assert again.status_code == 429
    assert {k["name"] for k in makeable} >= {"quiz", "flashcard", "study_guide"}
    assert {k["purpose"] for k in makeable} == {"family"}


async def test_sent_home_taken_and_heard_back(session, client, account) -> None:
    parent, child = await _family(session, account)
    learning_set = await ready_set(session, parent, purpose="family")
    async with client(parent) as c:
        sent = await c.post(
            "/api/family-shares",
            json={"set_id": str(learning_set.id), "student_ids": [str(child.id)], "due_at": SOON},
        )
    assert sent.status_code == 201
    assert [s["first_name"] for s in sent.json()["items"]] == ["Aina"]
    [told] = await _notes(session, child.id, "family_shared")
    assert told.payload["label"] == "Mum" and told.payload["title"] == learning_set.title

    async with client(child) as c:
        [waiting] = (await c.get("/api/me/home")).json()["from_home"]
        assert (waiting["status"], waiting["label"], waiting["item_count"]) == ("todo", "Mum", 5)
        finished = await _play(c, waiting["share_id"])
        [done] = (await c.get("/api/me/home")).json()["from_home"]
    assert finished["attempt"]["percent"] == 100.0
    assert "perfect_score" in {b["badge"] for b in finished["badges"]}
    assert (done["status"], done["best"]) == ("done", 100.0)

    [heard] = await _notes(session, parent.id, "family_done")
    assert heard.payload["student_name"] == "Aina" and heard.payload["percent"] == 100
    async with client(parent) as c:
        [seen] = (await c.get(f"/api/me/children/{child.id}/work")).json()["from_home"]
    assert seen["review_attempt_id"] == finished["attempt"]["id"]


async def test_only_your_own_set_to_your_own_child(session, client, teacher, account) -> None:
    parent, child = await _family(session, account)
    stranger = await account("parent")
    mine = await ready_set(session, parent, purpose="family")
    for_class = await ready_set(session, teacher)
    body = {"set_id": str(mine.id), "student_ids": [str(child.id)]}
    async with client(stranger) as c:
        assert (await c.post("/api/family-shares", json=body)).status_code == 404
    async with client(parent) as c:
        theirs = {**body, "set_id": str(for_class.id)}
        assert (await c.post("/api/family-shares", json=theirs)).status_code == 404
        late = {**body, "due_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat()}
        assert (await c.post("/api/family-shares", json=late)).status_code == 422
    async with client(child) as c:
        assert (await c.post("/api/family-shares", json=body)).status_code == 403


async def test_sending_again_updates_without_a_second_note(session, client, account) -> None:
    parent, child = await _family(session, account)
    learning_set = await ready_set(session, parent, purpose="family")
    body = {"set_id": str(learning_set.id), "student_ids": [str(child.id)]}
    async with client(parent) as c:
        await c.post("/api/family-shares", json=body)
        again = (await c.post("/api/family-shares", json={**body, "due_at": SOON})).json()
    [share] = again["items"]
    assert share["due_at"] is not None
    assert len(await _notes(session, child.id, "family_shared")) == 1


async def test_disconnecting_takes_back_what_was_sent(session, client, account) -> None:
    parent, child = await _family(session, account)
    learning_set = await ready_set(session, parent, purpose="family")
    async with client(parent) as c:
        sent = await c.post(
            "/api/family-shares",
            json={"set_id": str(learning_set.id), "student_ids": [str(child.id)]},
        )
        share_id = sent.json()["items"][0]["id"]
        await c.delete(f"/api/me/children/{child.id}")
    async with client(child) as c:
        assert (await c.get("/api/me/home")).json()["from_home"] == []
        refused = await c.post(f"/api/me/from-home/{share_id}/attempts")
    assert refused.status_code == 404
