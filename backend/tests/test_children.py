"""A parent's view of their child: what the child sees, and nobody else's."""

from __future__ import annotations

from uuid import uuid4

from app.events.catalog import BadgeAwarded
from app.events.subscribers import realtime as live
from app.services import realtime
from app.services.family_service import FamilyService
from tests.play_helpers import ready_set, shared

PAGES = ("overview", "work", "results", "practice", "schedule")


async def _linked(session, account, child):
    parent = await account("parent", "Siti")
    family = FamilyService(session)
    await family.connect(parent, (await family.invite_for(child)).code, "Mum")
    return parent


async def _play(c, assignment_id) -> str:
    attempt = (await c.post(f"/api/me/assignments/{assignment_id}/attempts")).json()
    for item in attempt["items"]:
        right = next(n for n, text in enumerate(item["options"]) if text.startswith("Right"))
        await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "choice": right, "time_ms": 800},
        )
    await c.post(f"/api/me/attempts/{attempt['id']}/complete")
    return attempt["id"]


async def test_a_parent_sees_the_work_the_child_did(
    session, client, teacher, student, account
) -> None:
    assignment = await shared(session, teacher, [student])
    parent = await _linked(session, account, student)
    async with client(parent) as c:
        before = (await c.get(f"/api/me/children/{student.id}/overview")).json()
    assert [t["assignment_id"] for t in before["todo"]] == [str(assignment.id)]
    async with client(student) as c:
        attempt_id = await _play(c, assignment.id)
    async with client(parent) as c:
        base = f"/api/me/children/{student.id}"
        overview = (await c.get(f"{base}/overview")).json()
        work = (await c.get(f"{base}/work")).json()["items"]
        results = (await c.get(f"{base}/results")).json()
        review = (await c.get(f"{base}/attempts/{attempt_id}")).json()
    assert overview["todo"] == [] and overview["streak"] == 1
    assert [row["percent"] for row in overview["latest"]] == [100.0]
    assert [(w["status"], w["review_attempt_id"]) for w in work] == [("done", attempt_id)]
    assert results["attempts"][0]["attempt_id"] == attempt_id
    assert review["status"] == "completed" and review["answered"]


async def test_the_child_s_own_practice_with_its_best_score(
    session, client, student, account
) -> None:
    await ready_set(session, student, purpose="practice")
    parent = await _linked(session, account, student)
    async with client(parent) as c:
        items = (await c.get(f"/api/me/children/{student.id}/practice")).json()["items"]
    assert [(i["purpose"], i["best"], i["tries"], i["made_for_you"]) for i in items] == [
        ("practice", None, 0, False)
    ]


async def test_nobody_else_sees_the_child(session, client, teacher, student, account) -> None:
    await shared(session, teacher, [student])
    attempt_id = uuid4()
    stranger = await account("parent")
    async with client(stranger) as c:
        for page in PAGES:
            assert (await c.get(f"/api/me/children/{student.id}/{page}")).status_code == 404
        gone = await c.get(f"/api/me/children/{student.id}/attempts/{attempt_id}")
        assert gone.status_code == 404
    for who in (teacher, student):
        async with client(who) as c:
            refused = await c.get(f"/api/me/children/{student.id}/overview")
            assert refused.status_code == 403


async def test_another_child_s_try_is_not_found(session, client, teacher, student, account) -> None:
    other = await account("student")
    assignment = await shared(session, teacher, [student, other])
    parent = await _linked(session, account, student)
    async with client(other) as c:
        theirs = await _play(c, assignment.id)
    async with client(parent) as c:
        refused = await c.get(f"/api/me/children/{student.id}/attempts/{theirs}")
    assert refused.status_code == 404


async def test_the_coverage_of_the_child_s_class_only(
    session, client, teacher, student, account
) -> None:
    assignment = await shared(session, teacher, [student])
    parent = await _linked(session, account, student)
    elsewhere = await shared(session, teacher, [await account("student")])
    async with client(parent) as c:
        base = f"/api/me/children/{student.id}/classes"
        report = (await c.get(f"{base}/{assignment.class_id}/coverage")).json()
        refused = await c.get(f"{base}/{elsewhere.class_id}/coverage")
    assert report["student_name"] == student.display_name
    assert report["class_name"] == "5 Bestari"
    assert refused.status_code == 404


async def test_an_empty_schedule_and_notes_for_no_lesson(session, client, student, account) -> None:
    parent = await _linked(session, account, student)
    async with client(parent) as c:
        schedule = (await c.get(f"/api/me/children/{student.id}/schedule")).json()
        notes = await c.get(f"/api/me/children/{student.id}/schedule/{uuid4()}/notes")
    assert schedule == {"upcoming": [], "past": []}
    assert notes.status_code == 404


async def test_the_parents_hear_as_the_child_works(session, account) -> None:
    child = await account("student")
    loner = await account("student")
    parent = await _linked(session, account, child)
    session.info.pop(realtime._PENDING, None)
    for student in (child, loner):
        event = BadgeAwarded(student_id=student.id, badge="gold", name="Gold", reason="")
        await live.child_did(event, session)
    pushed = session.info.get(realtime._PENDING, [])
    assert pushed == [(parent.id, {"topic": "child", "student_id": str(child.id)})]
