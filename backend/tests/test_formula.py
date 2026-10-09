"""The Lab's formulas (§26.8): worked out by reading them, never by `eval` —
the same small grammar the app reads."""

from __future__ import annotations

import math

import pytest

from app.learning.formula import evaluate, names_in


@pytest.mark.parametrize(
    ("formula", "values", "expected"),
    [
        ("1 + 2 * 3", {}, 7),
        ("(1 + 2) * 3", {}, 9),
        ("2 ^ 3 ^ 2", {}, 512),  # right-associative
        ("-2 ^ 2", {}, -4),  # the power binds first
        ("v / r", {"v": 12, "r": 4}, 3),
        ("sin(30) * 2", {}, 1),  # degrees
        ("sqrt(16) + abs(-3)", {}, 7),
        ("max(1, 5, 3) - min(4, 2)", {}, 3),
        ("2 * pi", {}, 2 * math.pi),
        (".5 * 4", {}, 2),
        ("v**2", {"v": 3}, 9),
        ("--3 + +2", {}, 5),
    ],
)
def test_a_formula_is_worked_out_like_arithmetic(
    formula: str, values: dict, expected: float
) -> None:
    assert evaluate(formula, values) == pytest.approx(expected)


@pytest.mark.parametrize(
    "formula",
    ["1 / 0", "sqrt(-1)", "unknown + 1", "2 +", "(1 + 2", "sin(1, 2)", "max(1)", "5.", "X + 1",
     "__import__('os')", "1; 2", "x" * 300],
)  # fmt: skip
def test_what_cannot_be_worked_out_is_not_a_number(formula: str) -> None:
    assert math.isnan(evaluate(formula, {"x": 1}))


def test_the_names_a_formula_uses_are_its_sliders() -> None:
    assert names_in("sun * water / 10 + sin(angle) * pi") == {"sun", "water", "angle"}
