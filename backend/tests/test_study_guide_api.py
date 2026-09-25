"""Study guides through the API: made by teachers, edited, extended, shared
and read by a class."""

from __future__ import annotations

from sqlalchemy import select

from app.db.models.notification import Notification
from tests.test_learning_api import _admit, _build, _class_with, api, scripted  # noqa: F401
from tests.test_study_guide import WRAP, section, sections


def _guide_answers(state: dict) -> None:
    state["answers"]["draft"] = sections
    state["answers"]["wrap"] = WRAP


async def _guide(api, teacher, scripted, count: int = 3) -> dict:  # noqa: F811
    state, _ = scripted
    _guide_answers(state)
    return await _build(api, teacher, kind="study_guide", topic="the water cycle", count=count)


async def test_a_teacher_makes_a_study_guide_with_its_opening_and_ending(
    api,  # noqa: F811
    teacher,
    scripted,  # noqa: F811
) -> None:
    detail = await _guide(api, teacher, scripted)
    assert detail["status"] == "ready"
    assert detail["kind"] == "study_guide"
    assert len(detail["items"]) == 3
    assert detail["items"][0]["explain"]["core"]
    assert detail["extras"]["big_question"] == "Where does rain come from?"
    assert detail["extras"]["challenge"]["title"] == "Cloud in a jar"


async def test_a_student_cannot_make_a_study_guide(api, student) -> None:  # noqa: F811
    async with api(student) as c:
        refused = await c.post(
            "/api/learning-sets/generate", json={"kind": "study_guide", "topic": "rain"}
        )
    assert refused.status_code == 403
    assert "teachers" in refused.json()["error"]["message"]


async def test_the_opening_and_ending_can_be_edited_and_are_cleaned(
    api,  # noqa: F811
    teacher,
    scripted,  # noqa: F811
) -> None:
    detail = await _guide(api, teacher, scripted)
    async with api(teacher) as c:
        edited = await c.patch(
            f"/api/learning-sets/{detail['id']}",
            json={"extras": {"big_question": "  Why is the sea salty?  ", "summary": ["One."]}},
        )
    assert edited.status_code == 200, edited.text
    extras = edited.json()["extras"]
    assert extras["big_question"] == "Why is the sea salty?"
    assert extras["summary"] == ["One."]
    assert extras["challenge"] is None
    # The items were not sent, so they are as they were.
    assert edited.json()["items"] == detail["items"]


async def test_a_quiz_keeps_no_extras_whatever_is_sent(api, teacher) -> None:  # noqa: F811
    detail = await _build(api, teacher)
    async with api(teacher) as c:
        edited = await c.patch(
            f"/api/learning-sets/{detail['id']}", json={"extras": {"big_question": "Sneaky?"}}
        )
    assert edited.json()["extras"] == {}


async def test_a_new_section_is_written_on_request_and_not_saved(
    api,  # noqa: F811
    teacher,
    scripted,  # noqa: F811
) -> None:
    state, _ = scripted
    detail = await _guide(api, teacher, scripted, count=2)
    state["answers"]["add"] = {"item": section(7, heading="Rainbows after the rain")}
    async with api(teacher) as c:
        added = await c.post(
            f"/api/learning-sets/{detail['id']}/items", json={"instruction": "a part on rainbows"}
        )
        again = (await c.get(f"/api/learning-sets/{detail['id']}")).json()
    assert added.status_code == 200, added.text
    assert added.json()["item"]["heading"] == "Rainbows after the rain"
    assert len(again["items"]) == 2


async def test_a_rewritten_section_keeps_the_picture_the_teacher_chose(
    api,  # noqa: F811
    teacher,
    scripted,  # noqa: F811
) -> None:
    state, _ = scripted
    detail = await _guide(api, teacher, scripted, count=2)
    chosen = {"image": "https://i.test/chosen.png", "page": "https://p.test", "source": "Mine"}
    items = [{**detail["items"][0], "image": chosen}, detail["items"][1]]
    state["answers"]["rewrite"] = {"item": section(1, heading="Simpler: where rain comes from")}
    async with api(teacher) as c:
        await c.patch(f"/api/learning-sets/{detail['id']}", json={"items": items})
        rewritten = await c.post(
            f"/api/learning-sets/{detail['id']}/items/{items[0]['id']}/rewrite",
            json={"instruction": "simpler"},
        )
    item = rewritten.json()["item"]
    assert item["heading"] == "Simpler: where rain comes from"
    assert item["image"]["image"] == "https://i.test/chosen.png"


async def test_a_class_reads_the_guide_and_answers_its_checks(
    session,
    api,  # noqa: F811
    teacher,
    scripted,  # noqa: F811
    account,
) -> None:
    kid = await account("student")
    made = await _class_with(api, teacher)
    await _admit(session, teacher, made["room"]["id"], made["code"], [kid])
    detail = await _guide(api, teacher, scripted, count=2)
    async with api(teacher) as c:
        shared = (
            await c.post(
                "/api/assignments", json={"set_id": detail["id"], "class_id": made["room"]["id"]}
            )
        ).json()
    assert shared["leaderboard_enabled"] is False

    async with api(kid) as c:
        attempt = (await c.post(f"/api/me/assignments/{shared['id']}/attempts")).json()
        first = attempt["items"][0]
        assert "answer" not in first and first["explain"]["simple"]
        assert attempt["extras"]["big_question"] == "Where does rain come from?"
        right = first["options"].index(next(o for o in first["options"] if o.startswith("The Sun")))
        answered = (
            await c.post(
                f"/api/me/attempts/{attempt['id']}/answers",
                json={"item_id": first["id"], "choice": right},
            )
        ).json()
    assert answered["played"]["correct"] is True
    assert answered["played"]["reveal"]["explanation"]

    told = (
        await session.execute(
            select(Notification.payload).where(
                Notification.type == "assignment_shared",
                Notification.payload["assignment_id"].astext == shared["id"],
            )
        )
    ).scalar_one()
    assert told["kind"] == "study guide"
