"""A class's coverage: its syllabus, where what was taught sits, what next,
and the reports a teacher sends home."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.errors import NotFoundError, ValidationError
from app.db.models.classroom import Classroom
from app.db.models.coverage import CoverageLink
from app.events.registry import build_bus
from app.learning.model import Meter
from app.services.attempt_service import AttemptService
from app.services.coverage.matrix import Taught, build, months_for, topic_status
from app.services.coverage.service import CoverageService
from app.services.coverage.syllabus import areas_from
from app.services.play_service import PlayService
from tests.learning_fakes import FakeModel
from tests.play_helpers import ready_set, right_choice, shared

AREAS = [
    {"title": "Living things", "topics": ["Plants", "Animals"]},
    {"title": "Energy", "topics": ["Light", "Heat"]},
]


def _sort_everything_into(topic: str):
    def answer(system: str, user: str) -> dict:
        count = len(re.findall(r"^\d+\. ", user, re.MULTILINE))
        return {"links": [{"item": n, "topic": topic} for n in range(1, count + 1)]}

    return answer


def _model(**answers) -> FakeModel:
    return FakeModel({"coverage.draft": {"areas": AREAS}, **answers}, Meter())


# --- the syllabus as data ------------------------------------------------------


def test_a_syllabus_is_cleaned_and_every_part_gets_an_id() -> None:
    areas = areas_from(
        [
            {"title": "  Living   things ", "topics": ["Plants", "", {"title": "Animals"}]},
            {"title": ""},
            "Energy",
            42,
        ]
    )
    assert [a["title"] for a in areas] == ["Living things", "Energy"]
    assert [a["id"] for a in areas] == ["a1", "a2"]
    assert [t["id"] for t in areas[0]["topics"]] == ["a1t1", "a1t2"]
    assert areas_from("nonsense") == []


def test_ids_survive_an_edit_and_a_moved_topic_is_renumbered() -> None:
    edited = areas_from(
        [
            {"id": "a2", "title": "Energy", "topics": [{"id": "a2t1", "title": "Light"}]},
            {"id": "a1", "title": "Living things", "topics": [{"id": "a2t2", "title": "Heat"}]},
            {"id": "a1", "title": "Duplicate id", "topics": []},
        ]
    )
    assert [a["id"] for a in edited] == ["a2", "a1", "a3"]
    assert edited[0]["topics"][0]["id"] == "a2t1"
    assert edited[1]["topics"][0]["id"].startswith("a1t")


# --- the map as data ------------------------------------------------------------


def _taught(n: int, *, when: datetime, planned: bool = False) -> Taught:
    return Taught("assignment", uuid4(), "quiz", f"Quiz {n}", "t", when, planned)


def test_a_topic_is_secure_taught_or_needs_work_by_its_score() -> None:
    now = datetime(2026, 5, 1, tzinfo=UTC)
    one = [_taught(1, when=now)]
    assert topic_status([], None) == "untouched"
    assert topic_status([_taught(1, when=now, planned=True)], None) == "planned"
    assert topic_status(one, None) == "taught"
    assert topic_status(one, 80) == "secure"
    assert topic_status(one, 40) == "needs_work"
    assert topic_status(one, 60) == "taught"


def test_the_map_places_what_was_taught_and_keeps_the_rest_aside() -> None:
    areas = areas_from(AREAS)
    now = datetime(2026, 5, 1, tzinfo=UTC)
    plants, stray, fresh = (_taught(n, when=now) for n in range(3))
    links = {plants.key: "a1t1", stray.key: None}
    shaped = build(areas, [plants, stray, fresh], links, {"a1t1": 90.0}, ["2026-05"])
    living = shaped["areas"][0]
    assert living["topics"][0]["status"] == "secure"
    assert living["status"] == "started"
    assert [i["title"] for i in shaped["outside"]] == [stray.title]
    assert [i["title"] for i in shaped["unsorted"]] == [fresh.title]
    assert shaped["summary"]["taught"] == 1 and shaped["summary"]["topics"] == 4


def test_the_months_run_from_the_first_lesson_to_the_year_s_end() -> None:
    start = datetime(2026, 1, 5, tzinfo=UTC)
    march = _taught(1, when=datetime(2026, 3, 2, tzinfo=UTC))
    months = months_for([march], start, datetime(2026, 9, 26, tzinfo=UTC))
    assert months[0] == "2026-01" and months[-1] == "2026-12" and len(months) == 12
    long_ago = _taught(2, when=datetime(2025, 2, 1, tzinfo=UTC))
    assert len(months_for([long_ago], start, datetime(2026, 9, 26, tzinfo=UTC))) == 12


# --- the service ----------------------------------------------------------------


async def _classroom(session, assignment) -> Classroom:
    return await session.get(Classroom, assignment.class_id)


async def test_a_drafted_syllabus_is_saved_and_editing_it_is_the_teacher_s(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    service = CoverageService(session, model=_model())
    drafted = await service.draft(room)
    assert [a["title"] for a in drafted] == ["Living things", "Energy"]
    assert (await service.syllabus(room.id)).made_by == "ai"

    await service.save(room, [{"id": "a1", "title": "Living things", "topics": ["Plants"]}])
    assert (await service.syllabus(room.id)).made_by == "teacher"
    with pytest.raises(ValidationError):
        await service.save(room, [])


async def test_what_was_taught_is_sorted_once_and_scored_for_the_class(
    session, teacher, account
) -> None:
    good, poor = await account("student"), await account("student")
    assignment = await shared(session, teacher, [good, poor])
    room = await _classroom(session, assignment)
    for student, right in ((good, True), (poor, False)):
        attempts = AttemptService(session)
        started = await attempts.start(student, assignment.id)
        for item in started.items:
            correct = right_choice(started, item["id"])
            choice = correct if right else (correct + 1) % 4
            await attempts.answer(
                student.id, started.attempt.id, item["id"], {"choice": choice}, 900
            )
        await PlayService(session, build_bus()).finish(student, started.attempt.id)

    model = _model(**{"coverage.sort": _sort_everything_into("a1t1")})
    service = CoverageService(session, model=model)
    await service.draft(room)
    shaped = await service.coverage(room)
    plants = shaped["areas"][0]["topics"][0]
    assert plants["mastery"] == 50.0 and plants["status"] == "taught"
    assert [i["title"] for i in plants["items"]] == [assignment.title]

    # Sorted once: the next look asks the model nothing.
    model.asked.clear()
    await service.coverage(room)
    assert "coverage.sort" not in model.asked

    mine = await service.coverage(room, student_id=good.id)
    assert mine["areas"][0]["topics"][0]["mastery"] == 100.0


async def test_removing_a_topic_sends_what_was_on_it_back_to_be_sorted(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    service = CoverageService(
        session, model=_model(**{"coverage.sort": _sort_everything_into("a1t1")})
    )
    await service.draft(room)
    await service.coverage(room)
    await service.save(
        room, [{"id": "a2", "title": "Energy", "topics": [{"id": "a2t1", "title": "Light"}]}]
    )
    left = await session.scalar(select(CoverageLink).where(CoverageLink.class_id == room.id))
    assert left is None


@pytest.mark.parametrize("said", ["a1t2", "[a1t2]", " A1T2 ", "Animals", "animals"])
async def test_a_topic_is_understood_however_the_model_writes_it(
    session, teacher, student, said
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    service = CoverageService(
        session, model=_model(**{"coverage.sort": _sort_everything_into(said)})
    )
    await service.draft(room)
    shaped = await service.coverage(room)
    animals = shaped["areas"][0]["topics"][1]
    assert [i["title"] for i in animals["items"]] == [assignment.title]


async def test_a_topic_not_on_the_syllabus_is_tried_again_not_filed_outside(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    model = _model(**{"coverage.sort": _sort_everything_into("a9t9")})
    service = CoverageService(session, model=model)
    await service.draft(room)
    shaped = await service.coverage(room)
    assert shaped["outside"] == []
    assert [i["title"] for i in shaped["unsorted"]] == [assignment.title]
    model.asked.clear()
    await service.coverage(room)
    assert "coverage.sort" in model.asked


@pytest.mark.parametrize(
    ("link", "where"),
    [
        ({"closest": "a1t2", "same_subject": True}, "Animals"),
        ({"closest": "[a2t1]", "same_subject": True}, "Light"),
        ({"closest": "a1t2", "same_subject": False}, "outside"),
        ({"closest": "a9t9", "same_subject": True}, "unsorted"),
        ({"same_subject": True}, "unsorted"),
    ],
)
async def test_the_closest_topic_is_used_unless_it_is_another_subject(
    session, teacher, student, link, where
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    model = _model(**{"coverage.sort": {"links": [{"item": 1, **link}]}})
    service = CoverageService(session, model=model)
    await service.draft(room)
    shaped = await service.coverage(room)
    topics = {t["title"]: t for a in shaped["areas"] for t in a["topics"]}
    if where in topics:
        assert [i["title"] for i in topics[where]["items"]] == [assignment.title]
    else:
        assert [i["title"] for i in shaped[where]] == [assignment.title]


async def test_the_prompt_says_something_broad_still_has_a_best_topic(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    seen: dict[str, str] = {}

    def answer(system: str, user: str) -> dict:
        seen["system"], seen["user"] = system, user
        return {"links": [{"item": 1, "topic": "a1t1"}]}

    service = CoverageService(session, model=_model(**{"coverage.sort": answer}))
    await service.draft(room)
    await service.coverage(room)
    assert "There is always a closest topic" in seen["system"]
    assert "same_subject is false only for work from another subject" in seen["system"]


async def test_editing_the_syllabus_gives_what_sat_outside_another_chance(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    model = _model(**{"coverage.sort": _sort_everything_into(None)})
    service = CoverageService(session, model=model)
    await service.draft(room)
    assert [i["title"] for i in (await service.coverage(room))["outside"]] == [assignment.title]

    await service.save(
        room,
        [
            {"id": "a1", "title": "Living things", "topics": [{"id": "a1t1", "title": "Plants"}]},
            {
                "id": "a3",
                "title": "Science skills",
                "topics": [{"id": "a3t1", "title": "Observing"}],
            },
        ],
    )
    model._answers["coverage.sort"] = _sort_everything_into("a3t1")  # noqa: SLF001
    shaped = await service.coverage(room)
    assert shaped["outside"] == []
    assert [i["title"] for i in shaped["areas"][1]["topics"][0]["items"]] == [assignment.title]


async def _unshared(session, teacher, room, *, grade="year_4", title="Leaf quiz"):
    learning_set = await ready_set(session, teacher)
    learning_set.grade_level, learning_set.title = grade, title
    room.grade_level = "year_4"
    await session.flush()
    return learning_set


async def test_a_set_made_for_the_class_s_year_shows_as_ready_to_share(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    await _unshared(session, teacher, room)
    await _unshared(session, teacher, room, grade="form_2", title="Other year")
    model = _model(**{"coverage.sort": _sort_everything_into("a1t2")})
    service = CoverageService(session, model=model)
    await service.draft(room)
    shaped = await service.coverage(room, ready=True)
    animals = shaped["areas"][0]["topics"][1]
    ready = [i for i in animals["items"] if i["source"] == "set"]
    assert [i["title"] for i in ready] == ["Leaf quiz"]
    assert ready[0]["planned"] is True
    assert shaped["summary"]["ready"] == 1 and shaped["summary"]["planned"] == 0
    # A report home, and a student's view, never show what is not shared.
    report = await service.coverage(room, sort=False)
    assert all(
        i["source"] != "set" for a in report["areas"] for t in a["topics"] for i in t["items"]
    )


async def test_a_set_keeps_its_topic_once_it_is_shared(session, teacher, student) -> None:
    from app.events.registry import build_bus as bus
    from app.services.assignment_service import AssignmentService, ShareSettings

    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    waiting = await _unshared(session, teacher, room)
    model = _model(**{"coverage.sort": _sort_everything_into("a2t1")})
    service = CoverageService(session, model=model)
    await service.draft(room)
    await service.coverage(room, ready=True)
    await AssignmentService(session, bus()).share(teacher, waiting.id, room.id, ShareSettings())
    model.asked.clear()
    shaped = await service.coverage(room, ready=True)
    light = shaped["areas"][1]["topics"][0]
    assert [(i["source"], i["title"]) for i in light["items"] if i["title"] == "Leaf quiz"] == [
        ("assignment", "Leaf quiz")
    ]
    assert "coverage.sort" not in model.asked


async def test_a_set_from_another_subject_stays_off_this_class_s_map(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    await _unshared(session, teacher, room)
    model = _model(**{"coverage.sort": {"links": [
        {"item": 1, "closest": "a1t1", "same_subject": True},
        {"item": 2, "closest": "a1t1", "same_subject": False},
    ]}})  # fmt: skip
    service = CoverageService(session, model=model)
    await service.draft(room)
    shaped = await service.coverage(room, ready=True)
    assert all(
        i["title"] != "Leaf quiz" for a in shaped["areas"] for t in a["topics"] for i in t["items"]
    )
    assert shaped["outside"] == []


async def test_the_plan_keeps_only_real_topics_and_known_kinds(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    steps = {
        "steps": [
            {"topic": "a2t1", "kind": "live", "title": "Light and shadows",
             "when": "next week", "why": "Not taught yet."},
            {"topic": "zz", "kind": "quiz", "title": "Made up"},
            {"topic": "a1t2", "kind": "poster", "title": "Animal homes"},
        ]
    }  # fmt: skip
    service = CoverageService(
        session, model=_model(**{"coverage.plan": steps, "coverage.sort": {"links": []}})
    )
    await service.draft(room)
    planned = await service.plan(room)
    assert [(s["topic_id"], s["kind"]) for s in planned] == [("a2t1", "live"), ("a1t2", "quiz")]
    assert planned[0]["area"] == "Energy" and planned[0]["topic"] == "Light"


async def test_planning_needs_a_syllabus(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    with pytest.raises(ValidationError):
        await CoverageService(session, model=_model()).plan(room)


# --- reports home ---------------------------------------------------------------


async def test_a_report_shows_parents_the_map_and_nothing_else(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    service = CoverageService(
        session, model=_model(**{"coverage.sort": _sort_everything_into("a1t1")})
    )
    await service.draft(room)
    await service.coverage(room)

    report = await service.create_report(teacher.id, room, student.id)
    seen = await service.public(report.token)
    assert set(seen) == {
        "class_name", "subject", "grade_label", "teacher_name", "student_name",
        "made_at", "months", "summary", "areas",
    }  # fmt: skip
    item = seen["areas"][0]["topics"][0]["items"][0]
    assert set(item) == {"kind", "title", "month", "planned"}

    await service.revoke(room.id, report.id)
    with pytest.raises(NotFoundError):
        await service.public(report.token)
    with pytest.raises(NotFoundError):
        await service.public("never-existed")


async def test_a_report_is_only_for_a_student_in_the_class(
    session, teacher, student, account
) -> None:
    assignment = await shared(session, teacher, [student])
    room = await _classroom(session, assignment)
    stranger = await account("student")
    with pytest.raises(NotFoundError):
        await CoverageService(session).create_report(teacher.id, room, stranger.id)


# --- over HTTP ------------------------------------------------------------------


async def test_only_the_class_s_teacher_sees_its_map(
    client, session, teacher, student, account
) -> None:
    assignment = await shared(session, teacher, [student])
    other = await account("teacher", "Cikgu Lain")
    async with client(other) as c:
        assert (await c.get(f"/api/classes/{assignment.class_id}/coverage")).status_code == 404
    async with client(student) as c:
        assert (await c.get(f"/api/classes/{assignment.class_id}/coverage")).status_code == 403


async def test_a_parent_link_is_never_indexed_or_cached(client, session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(teacher) as c:
        made = await c.post(f"/api/classes/{assignment.class_id}/coverage/reports", json={})
        assert made.status_code == 201
        token = made.json()["url"].rsplit("/", 1)[1]
        listed = await c.get(f"/api/classes/{assignment.class_id}/coverage/reports")
        assert [r["id"] for r in listed.json()["items"]] == [made.json()["id"]]
    async with client() as c:
        seen = await c.get(f"/api/reports/{token}")
    assert seen.status_code == 200
    assert "noindex" in seen.headers["x-robots-tag"]
    assert seen.headers["cache-control"] == "no-store"
    assert seen.json()["student_name"] is None
