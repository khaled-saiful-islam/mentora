"""Second chance, at your level (§28.3.7): a wrong answer explained at the
student's level, written once and kept; a question like it, found before it
is made; a second try that never changes the score; and a teacher's test
that switches it all off."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.api.routes import second_chance as second_chance_route
from app.core.errors import NotFoundError, ValidationError
from app.db.models.growth import BuddyGrowth
from app.db.models.learning import LearningSet, LearningSetVersion
from app.db.models.second_chance import ItemHelp
from app.events.registry import build_bus
from app.learning.model import GenerationUnavailable, Meter
from app.services import second_chance_service
from app.services.assignment_service import AssignmentService, ShareSettings
from app.services.attempt_service import AttemptService
from app.services.second_chance_service import SecondChanceService
from app.services.second_chance_writing import cleaned_explanation, cleaned_twin, item_key
from tests.learning_fakes import FakeModel
from tests.play_helpers import SKILLS, quiz_items, right_choice, shared

EXPLAINED = {
    "why": "Light lets us see things.",
    "example": {
        "problem": "Why can we see the moon?",
        "steps": ["The sun shines on the moon.", "The light bounces to our eyes."],
        "answer": "Sunlight bounces off it.",
    },
    "remember": "No light, no seeing.",
}
TWIN = {
    "prompt": "Which one gives off its own light?",
    "options": ["The sun", "The moon", "A mirror", "A book"],
    "answer": 0,
    "explanation": "The sun makes its own light.",
}
EXPLAIN = "second chance: explain"
LIKE_IT = "second chance: one like it"


def _model(**answers) -> FakeModel:
    return FakeModel({EXPLAIN: EXPLAINED, LIKE_IT: TWIN, **answers}, Meter())


async def _missed(session, student, assignment, item_id: str = "q1"):
    """An attempt with `item_id` answered wrong."""
    attempts = AttemptService(session)
    view = await attempts.start(student, assignment.id)
    wrong = (right_choice(view, item_id) + 1) % 4
    await attempts.answer(student.id, view.attempt.id, item_id, {"choice": wrong}, 900)
    return view


# --- what the model writes ------------------------------------------------------------


def test_an_explanation_needs_a_reason_and_a_worked_example() -> None:
    assert cleaned_explanation(EXPLAINED) is not None
    assert cleaned_explanation({**EXPLAINED, "why": ""}) is None
    one_step = {**EXPLAINED, "example": {**EXPLAINED["example"], "steps": ["Only one."]}}
    assert cleaned_explanation(one_step) is None


def test_a_question_like_it_is_a_new_question_with_four_options() -> None:
    assert cleaned_twin(TWIN, not_like="Something else?") is not None
    assert cleaned_twin(TWIN, not_like="Which one  gives off its own light?") is None
    assert cleaned_twin({**TWIN, "options": ["a", "b"]}, not_like="x") is None


def test_a_question_is_the_same_question_wherever_it_is_copied() -> None:
    item = {"id": "q1", "prompt": "P?", "options": ["a", "b", "c", "d"], "answer": 0}
    assert item_key(item) == item_key({**item, "id": "d3"})
    assert item_key(item) != item_key({**item, "answer": 1})


# --- explained at their level -----------------------------------------------------------


async def test_an_explanation_is_written_once_for_each_question_and_level(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], grade_level="year_4")
    view = await _missed(session, student, assignment)
    model = _model()
    service = SecondChanceService(session, lambda: model)
    first = await service.explain(student.id, view.attempt.id, "q1", "core")
    again = await service.explain(student.id, view.attempt.id, "q1", "core")
    assert first == again and first.example["answer"] == "Sunlight bounces off it."
    assert model.asked == [EXPLAIN]
    await service.explain(student.id, view.attempt.id, "q1", "simple")
    assert model.asked == [EXPLAIN, EXPLAIN]
    with pytest.raises(ValidationError):
        await service.explain(student.id, view.attempt.id, "q1", "hardest")


async def test_a_model_that_will_not_answer_gives_the_question_s_own_note(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    view = await _missed(session, student, assignment)
    down = _model(**{EXPLAIN: GenerationUnavailable("down")})
    found = await SecondChanceService(session, lambda: down).explain(
        student.id, view.attempt.id, "q1", "core"
    )
    assert found.written is False and found.why == "Because 1."
    # Not kept: the next ask tries the model again.
    kept = await session.scalar(
        select(ItemHelp).where(ItemHelp.item_key == item_key(quiz_items()[0]))
    )
    assert kept is None


async def test_only_a_wrong_answer_in_a_quiz_that_offers_it_has_a_second_chance(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    view = await _missed(session, student, assignment)
    attempts, service = AttemptService(session), SecondChanceService(session, _model)
    await attempts.answer(
        student.id, view.attempt.id, "q2", {"choice": right_choice(view, "q2")}, 9
    )
    for item_id in ("q2", "q3"):  # right, and not answered yet
        with pytest.raises(ValidationError):
            await service.explain(student.id, view.attempt.id, item_id, "core")
    with pytest.raises(NotFoundError):
        await service.explain(student.id, view.attempt.id, "nope", "core")


@pytest.mark.parametrize("settings", [{"second_chance": False}, {"feedback_mode": "end"}])
async def test_a_test_or_a_quiz_marked_at_the_end_has_none(
    session, teacher, student, settings
) -> None:
    assignment = await shared(session, teacher, [student], **settings)
    view = await _missed(session, student, assignment)
    assert (await AttemptService(session).view(student.id, view.attempt.id)).second_chance is False
    with pytest.raises(ValidationError):
        await SecondChanceService(session, _model).explain(
            student.id, view.attempt.id, "q1", "core"
        )


# --- one like it ----------------------------------------------------------------------------


async def test_one_like_it_comes_from_the_set_when_it_has_one_not_coming_up(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    view = await _missed(session, student, assignment)
    # The attempt asks only q1–q3: q5, on the same skill as q1, is not coming up.
    view.attempt.plan = {**view.attempt.plan, "order": ["q1", "q2", "q3"]}
    await session.flush()
    model = _model()
    twin = await SecondChanceService(session, lambda: model).twin(student.id, view.attempt.id, "q1")
    assert twin is not None and twin.prompt == "Question 5?"
    assert twin.answer is None and model.asked == []


async def _other_quiz(session, teacher, class_id) -> None:
    """Another quiz for the class, its questions worded differently."""
    other = LearningSet(
        owner_id=teacher.id, purpose="assign", kind="quiz", title="More light",
        topic="light", status="ready", current_version=1, requested_count=2,
    )  # fmt: skip
    session.add(other)
    await session.flush()
    items = [
        {"id": f"m{n}", "prompt": f"More light {n}?", "options": [f"Yes {n}", "b", "c", "d"],
         "answer": 0, "explanation": "", "skill": "light"}
        for n in (1, 2)
    ]  # fmt: skip
    session.add(
        LearningSetVersion(set_id=other.id, version=1, items=items, skills=SKILLS, sources=[])
    )
    await session.flush()
    await AssignmentService(session, build_bus()).share(
        teacher, other.id, class_id, ShareSettings()
    )


async def test_one_like_it_comes_from_the_student_s_other_work_next(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    await _other_quiz(session, teacher, assignment.class_id)
    view = await _missed(session, student, assignment)
    service = SecondChanceService(session, _model)
    twin = await service.twin(student.id, view.attempt.id, "q1")
    assert twin is not None and twin.prompt.startswith("More light")
    # Asked again, the same question.
    assert (await service.twin(student.id, view.attempt.id, "q1")) == twin


async def test_one_like_it_is_made_only_when_there_is_none_and_kept_for_the_next(
    session, teacher, student, account
) -> None:
    other = await account("student")
    assignment = await shared(session, teacher, [student, other])
    model = _model()
    first = await _missed(session, student, assignment)
    twin = await SecondChanceService(session, lambda: model).twin(
        student.id, first.attempt.id, "q1"
    )
    assert twin is not None and twin.prompt == TWIN["prompt"] and model.asked == [LIKE_IT]
    second = await _missed(session, other, assignment)
    again = await SecondChanceService(session, lambda: model).twin(
        other.id, second.attempt.id, "q1"
    )
    assert again is not None and again.prompt == TWIN["prompt"] and model.asked == [LIKE_IT]


async def test_a_question_is_made_only_a_few_times_a_day(
    session, teacher, student, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(second_chance_service, "MOST_MADE_A_DAY", 0)
    assignment = await shared(session, teacher, [student])
    view = await _missed(session, student, assignment)
    model = _model()
    assert (
        await SecondChanceService(session, lambda: model).twin(student.id, view.attempt.id, "q1")
        is None
    )
    assert model.asked == []


# --- the second try ---------------------------------------------------------------------------


async def _growth(session, student) -> list[str]:
    rows = await session.execute(
        select(BuddyGrowth.source_id).where(
            BuddyGrowth.student_id == student.id, BuddyGrowth.source == "second_chance"
        )
    )
    return list(rows.scalars())


async def test_right_on_the_second_try_grows_the_buddy_and_leaves_the_score(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    view = await _missed(session, student, assignment)
    service = SecondChanceService(session, _model)
    twin = await service.twin(student.id, view.attempt.id, "q1")
    assert twin is not None
    right = twin.options.index("The sun")
    tried = await service.try_twin(student.id, view.attempt.id, "q1", right)
    assert tried.correct is True and tried.grew is True and tried.answer == right
    assert tried.explanation == TWIN["explanation"]
    # Asked again: the same result, and no more growth.
    again = await service.try_twin(student.id, view.attempt.id, "q1", (right + 1) % 4)
    assert again.correct is True and again.grew is False
    assert len(await _growth(session, student)) == 1
    assert view.attempt.score == 0


async def test_wrong_on_the_second_try_shows_the_answer_and_grows_nothing(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    view = await _missed(session, student, assignment)
    service = SecondChanceService(session, _model)
    with pytest.raises(NotFoundError):
        await service.try_twin(student.id, view.attempt.id, "q1", 0)
    twin = await service.twin(student.id, view.attempt.id, "q1")
    assert twin is not None
    wrong = (twin.options.index("The sun") + 1) % 4
    with pytest.raises(ValidationError):
        await service.try_twin(student.id, view.attempt.id, "q1", 7)
    tried = await service.try_twin(student.id, view.attempt.id, "q1", wrong)
    assert tried.correct is False and tried.answer == twin.options.index("The sun")
    assert await _growth(session, student) == []


async def test_second_chances_grow_the_buddy_only_a_few_times_a_day(
    session, teacher, student, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(second_chance_service, "SECOND_CHANCES_A_DAY", 1)
    assignment = await shared(session, teacher, [student])
    view = await _missed(session, student, assignment, "q1")
    attempts = AttemptService(session)
    await attempts.answer(
        student.id, view.attempt.id, "q3", {"choice": (right_choice(view, "q3") + 1) % 4}, 9
    )
    service = SecondChanceService(session, _model)
    grew = []
    for item_id in ("q1", "q3"):
        twin = await service.twin(student.id, view.attempt.id, item_id)
        assert twin is not None
        tried = await service.try_twin(
            student.id, view.attempt.id, item_id, twin.options.index("The sun")
        )
        grew.append(tried.grew)
    assert grew == [True, False]


# --- over HTTP ------------------------------------------------------------------------------------


async def test_a_student_gets_a_second_chance_over_http(
    session, client, teacher, student, monkeypatch: pytest.MonkeyPatch
) -> None:
    model = _model()
    monkeypatch.setattr(second_chance_route, "build_model", lambda *_: model)
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        assert attempt["second_chance"] is True
        item = attempt["items"][0]
        wrong = next(n for n, text in enumerate(item["options"]) if not text.startswith("Right"))
        await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "choice": wrong, "time_ms": 800},
        )
        base = f"/api/me/attempts/{attempt['id']}/items/{item['id']}"
        explained = await c.get(f"{base}/explain", params={"level": "stretch"})
        twin = await c.post(f"{base}/twin")
        right = twin.json()["twin"]["options"].index("The sun")
        tried = await c.post(f"{base}/twin/answer", json={"choice": right})
        refused = await c.post(f"{base}/twin/answer", json={"choice": 99})
    assert explained.status_code == 200 and explained.json()["level"] == "stretch"
    assert twin.json()["twin"]["answer"] is None
    assert tried.json()["twin"]["correct"] is True and tried.json()["twin"]["grew"] is True
    assert refused.status_code == 422


async def test_a_teacher_shares_a_quiz_as_a_test(session, client, teacher, student) -> None:
    learning = await shared(session, teacher, [student])
    async with client(teacher) as c:
        made = await c.post(
            "/api/assignments",
            json={
                "set_id": str(learning.set_id),
                "class_id": str(learning.class_id),
                "second_chance": False,
            },
        )
    assert made.status_code == 201 and made.json()["second_chance"] is False
