"""Explain why (§28.3.5, Form 1–5): a reason after a right answer, judged in
one line; once per question, a few a day; words that may not reach the model
held back and logged; a model that will not answer, said kindly."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.api.routes import explain_why as explain_route
from app.core.errors import ValidationError
from app.db.models.moderation import ModerationEvent
from app.learning.model import GenerationUnavailable, Meter
from app.moderation.base import Category, Decision, Screening
from app.moderation.gate import ModerationGate
from app.services.attempt_service import AttemptService
from app.services.explain_why import OFF_TOPIC, UNCHECKED, ExplainWhyService
from tests.learning_fakes import FakeModel
from tests.play_helpers import right_choice, shared

JUDGE = "explain why: judge"
SPOT_ON = {"verdict": "spot_on", "feedback": "Yes: light gives plants the energy to make food."}


class Holds:
    name = "holds"

    def screen(self, text: str) -> Screening:
        if "secret" in text:
            return Screening(Decision.BLOCK, text, Category.PERSONAL_INFO, "test")
        return Screening.allow(text)


def _service(session, model=None, *, per_day: int = 5) -> ExplainWhyService:
    model = model or FakeModel({JUDGE: SPOT_ON}, Meter())
    return ExplainWhyService(
        session, lambda: model, ModerationGate(inputs=(Holds(),)), per_day=per_day
    )


async def _answered(session, teacher, student, *, right: tuple[str, ...] = ("q1", "q3")):
    student.grade_level = "form_2"
    await session.flush()
    assignment = await shared(session, teacher, [student])
    attempts = AttemptService(session)
    view = await attempts.start(student, assignment.id)
    for item in ("q1", "q2", "q3"):
        choice = right_choice(view, item) if item in right else (right_choice(view, item) + 1) % 4
        await attempts.answer(student.id, view.attempt.id, item, {"choice": choice}, 900)
    return view.attempt.id


async def test_a_reason_is_judged_once_per_question(session, teacher, student) -> None:
    attempt = await _answered(session, teacher, student)
    model = FakeModel({JUDGE: SPOT_ON}, Meter())
    service = _service(session, model)
    first = await service.judge(student, attempt, "q1", "Because plants need light to make food")
    again = await service.judge(student, attempt, "q1", "something else")
    assert first.verdict == "spot_on" and again == first and model.asked == [JUDGE]
    assert await service.left(student) == 4


async def test_only_after_a_right_answer_and_only_a_few_a_day(session, teacher, student) -> None:
    attempt = await _answered(session, teacher, student)
    service = _service(session, per_day=1)
    with pytest.raises(ValidationError):
        await service.judge(student, attempt, "q2", "my reason")  # answered wrong
    await service.judge(student, attempt, "q1", "my reason")
    with pytest.raises(ValidationError):
        await service.judge(student, attempt, "q3", "my reason")  # none left today


async def test_only_form_one_to_five(session, teacher, student) -> None:
    attempt = await _answered(session, teacher, student)
    student.grade_level = "year_6"
    service = _service(session)
    assert await service.left(student) == 0
    with pytest.raises(ValidationError):
        await service.judge(student, attempt, "q1", "my reason")


async def test_words_held_back_never_reach_the_model_and_are_logged(
    session, teacher, student
) -> None:
    attempt = await _answered(session, teacher, student)
    model = FakeModel({JUDGE: SPOT_ON}, Meter())
    judged = await _service(session, model).judge(student, attempt, "q1", "my secret address")
    assert (judged.verdict, judged.feedback) == (None, OFF_TOPIC)
    assert model.asked == []
    logged = await session.scalar(
        select(func.count())
        .select_from(ModerationEvent)
        .where(ModerationEvent.user_id == student.id)
    )
    assert logged == 1


async def test_a_model_that_will_not_answer_is_said_kindly_and_not_counted(
    session, teacher, student
) -> None:
    attempt = await _answered(session, teacher, student)
    down = FakeModel({JUDGE: GenerationUnavailable("down")}, Meter())
    service = _service(session, down)
    judged = await service.judge(student, attempt, "q1", "Because of light")
    assert (judged.verdict, judged.feedback) == (None, UNCHECKED)
    assert await service.left(student) == 5


async def test_a_student_explains_why_over_http(
    session, client, teacher, student, monkeypatch: pytest.MonkeyPatch
) -> None:
    model = FakeModel({JUDGE: SPOT_ON}, Meter())
    monkeypatch.setattr(explain_route, "build_model", lambda *_: model)
    attempt = await _answered(session, teacher, student)
    async with client(student) as c:
        left = (await c.get("/api/me/why")).json()
        judged = await c.post(
            f"/api/me/attempts/{attempt}/items/q1/why", json={"words": "Light makes food."}
        )
    assert left == {"left": 5}
    assert judged.status_code == 200 and judged.json()["verdict"] == "spot_on"
