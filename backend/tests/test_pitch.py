"""Pitched for the year: every writing stage and the check after it are told
what a child in that year can read, follow and count to."""

from __future__ import annotations

import pytest

from app.core.grades import GRADES, grade_for
from app.learning import prompts
from app.learning.pitch import pitch
from app.live.plan_prompts import _who


def test_every_year_has_its_pitch() -> None:
    for grade in GRADES:
        said = pitch(grade)
        assert grade.label in said
        assert "never beyond" in said


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        ("year_1", "up to 100;"),
        ("year_3", "up to 10 000"),
        ("year_3", "6 in 10 easy"),
        ("year_5", "up to 1 000 000"),
        ("form_2", "lower secondary"),
        ("form_5", "SPM"),
        ("upper_6", "STPM"),
    ],
)
def test_each_year_gets_its_own_numbers_steps_and_mix(code, expected) -> None:
    assert expected in pitch(grade_for(code))


def test_no_year_no_pitch() -> None:
    assert pitch(None) == ""


def test_writing_and_checking_both_carry_the_pitch() -> None:
    year_3 = grade_for("year_3")
    system, _ = prompts.draft(
        rules="rules", noun_plural="questions", count=5, topic="fractions", grade=year_3,
        language="en", skills="- s1", listing="", avoid=[],
    )  # fmt: skip
    assert "Pitch everything for Year 3" in system
    system, user = prompts.verify(topic="fractions", grade=year_3, listing="", items_json="[]")
    assert "too hard for Year 3" in system
    assert "Pitch everything for Year 3" in user


def test_a_live_lesson_is_pitched_for_its_year_too() -> None:
    assert "Pitch everything for Year 2" in _who(grade_for("year_2"))
    assert _who(None) == "school students"
