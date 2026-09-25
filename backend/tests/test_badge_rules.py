"""Each badge rule, on the attempts that should and should not earn it."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.badges.base import Context, SkillTally
from app.badges.catalog import CATALOG, RULES

NOW = datetime(2026, 9, 25, 10, tzinfo=UTC)
BASE = Context(
    kind="quiz",
    purpose="assign",
    percent=70,
    best_streak=2,
    number=1,
    first_percent=None,
    completed_at=NOW,
    due_at=None,
    scope="a1",
    practice_completed=0,
)


def earned(ctx: Context) -> set[str]:
    return {award.badge for rule in RULES if (award := rule.evaluate(ctx))}


@pytest.mark.parametrize(
    ("changes", "badge"),
    [
        ({"percent": 100}, "perfect_score"),
        ({"percent": 92}, "star_scorer"),
        ({"best_streak": 6}, "hot_streak"),
        ({"number": 2, "first_percent": 40, "percent": 70}, "comeback"),
        ({"due_at": NOW + timedelta(days=2)}, "early_bird"),
        ({"kind": "flashcard", "percent": 100}, "card_shark"),
        ({"kind": "study_guide", "percent": 100}, "bookworm"),
        ({"purpose": "practice", "practice_completed": 1}, "self_starter"),
        ({"purpose": "practice", "practice_completed": 5}, "practice_pro"),
        ({"skills": (SkillTally("light", 9, 10, 3),)}, "skill_master"),
    ],
)
def test_each_badge_is_earned_by_what_it_says(changes: dict, badge: str) -> None:
    assert badge in earned(replace(BASE, **changes))


def test_an_ordinary_attempt_earns_nothing() -> None:
    assert earned(BASE) == set()


def test_perfect_is_not_also_star() -> None:
    got = earned(replace(BASE, percent=100))
    assert "perfect_score" in got and "star_scorer" not in got


def test_practice_does_not_earn_class_quiz_badges() -> None:
    assert "perfect_score" not in earned(replace(BASE, purpose="practice", percent=100))


def test_a_small_improvement_is_not_a_comeback() -> None:
    assert "comeback" not in earned(replace(BASE, number=2, first_percent=60, percent=70))


def test_finishing_on_the_due_day_is_not_early() -> None:
    assert "early_bird" not in earned(replace(BASE, due_at=NOW + timedelta(hours=5)))


def test_a_skill_needs_three_sets_to_be_mastered() -> None:
    assert "skill_master" not in earned(replace(BASE, skills=(SkillTally("x", 10, 10, 2),)))


def test_the_catalog_names_every_badge_including_the_podium() -> None:
    assert {"gold", "silver", "bronze"} <= set(CATALOG)
    assert {rule.key for rule in RULES} <= set(CATALOG)
    for info in CATALOG.values():
        assert info.name and info.description and info.hint
