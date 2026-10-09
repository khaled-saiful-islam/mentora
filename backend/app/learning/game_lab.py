"""The Lab (§26.8): sliders that drive a formula, and goals for its output.

What a model writes is kept only when it can be played: the sliders' ids are
the formula's only names, the formula works out across the sliders' range,
and every goal can be reached — found here by trying the sliders across their
range, so Show me has an answer to play and no child is set a goal that
cannot be met. A goal already met where the sliders start is no goal at all.
"""

from __future__ import annotations

import itertools
import math
import re
from collections.abc import Iterator
from typing import Any

from app.learning.base import clean_text
from app.learning.formula import FormulaError, evaluate, names_in

LAB_CONTROLS = (1, 3)
LAB_GOALS = (1, 3)
# Settings tried along each slider when looking for a goal's answer.
SAMPLES = 41
MOST_STEPS = 1000
LIMITS = {"label": 40, "unit": 16, "icon": 16, "text": 160, "why": 220, "formula": 200}
_ID = re.compile(r"^[a-z_][a-z0-9_]{0,23}$")
_RESERVED = {"sin", "cos", "tan", "sqrt", "abs", "min", "max", "pi"}


def lab(value: Any, why: str) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    controls = _controls(value.get("controls"))
    # Lower case, as the sliders' ids are: the app reads names case by case.
    formula = (clean_text(value.get("formula"), LIMITS["formula"]) or "").lower()
    if controls is None or not formula or not _names_fit(formula, controls):
        return None
    grid = list(_settings(controls))
    outputs = [(s, evaluate(formula, s)) for s in grid]
    finite = [(s, o) for s, o in outputs if math.isfinite(o)]
    if len(finite) < len(outputs) / 2:
        return None
    start = {c["id"]: c["start"] for c in controls}
    goals = _goals(value.get("goals"), finite, start, formula, why)
    if not goals:
        return None
    low, high = _shown_range([o for _, o in finite], goals)
    return {
        "controls": controls,
        "output": {**_output(value.get("output")), "min": _round(low), "max": _round(high)},
        "formula": formula,
        "goals": goals,
    }


def _controls(value: Any) -> list[dict[str, Any]] | None:
    given = [c for c in value if isinstance(c, dict)] if isinstance(value, list) else []
    controls = [c for c in map(_control, given) if c]
    ids = [c["id"] for c in controls]
    if not LAB_CONTROLS[0] <= len(controls) <= LAB_CONTROLS[1] or len(set(ids)) != len(ids):
        return None
    return controls


def _control(raw: dict[str, Any]) -> dict[str, Any] | None:
    ident = str(raw.get("id") or "").strip().lower()
    label = clean_text(raw.get("label"), LIMITS["label"])
    low, high, step = _number(raw.get("min")), _number(raw.get("max")), _number(raw.get("step"))
    if not _ID.match(ident) or ident in _RESERVED or not label:
        return None
    if low is None or high is None or step is None:
        return None
    if high <= low or step <= 0 or (high - low) / step > MOST_STEPS:
        return None
    start = _number(raw.get("start"))
    unit = clean_text(raw.get("unit"), LIMITS["unit"]) or ""
    return {
        "id": ident,
        "label": _without_unit(label, unit),
        "icon": clean_text(raw.get("icon"), LIMITS["icon"]) or "",
        "unit": unit,
        "min": low,
        "max": high,
        "step": step,
        "start": _snap(low if start is None else start, low, high, step),
    }


def _names_fit(formula: str, controls: list[dict[str, Any]]) -> bool:
    try:
        return names_in(formula) <= {c["id"] for c in controls}
    except FormulaError:
        return False


def _settings(controls: list[dict[str, Any]]) -> Iterator[dict[str, float]]:
    """Every setting of the sliders tried: up to `SAMPLES` along each."""
    alongs = [sorted(set(_along(c))) for c in controls]
    for combination in itertools.product(*alongs):
        yield {c["id"]: v for c, v in zip(controls, combination, strict=True)}


def _along(c: dict[str, Any]) -> Iterator[float]:
    count = min(SAMPLES, int(round((c["max"] - c["min"]) / c["step"])) + 1)
    for n in range(count):
        at = c["min"] + (c["max"] - c["min"]) * n / max(count - 1, 1)
        yield _snap(at, c["min"], c["max"], c["step"])


def _goals(
    value: Any, finite: list[tuple[dict[str, float], float]], start: dict[str, float],
    formula: str, why: str,
) -> list[dict[str, Any]]:  # fmt: skip
    """The goals that can be reached, each with the setting nearest where the
    sliders are by then, and none already met there."""
    given = [g for g in value if isinstance(g, dict)] if isinstance(value, list) else []
    goals, at = [], start
    for n, raw in enumerate(given[: LAB_GOALS[1]], start=1):
        text = clean_text(raw.get("text"), LIMITS["text"])
        low, high = _number(raw.get("low")), _number(raw.get("high"))
        if not text or low is None or high is None or high <= low:
            continue
        if low <= evaluate(formula, at) <= high:
            continue
        reaching = [s for s, o in finite if low <= o <= high]
        if not reaching:
            continue
        solution = min(reaching, key=lambda s: _distance(s, at))
        why_here = clean_text(raw.get("why"), LIMITS["why"]) or why
        goals.append({"id": f"g{n}", "text": text, "low": low, "high": high, "why": why_here,
                      "solution": solution})  # fmt: skip
        at = solution
    return goals


def _shown_range(outputs: list[float], goals: list[dict[str, Any]]) -> tuple[float, float]:
    """What the meter shows: the goals with room around them, not every value
    the sliders can reach — a 0.5 A goal on a 0–12 A meter is a sliver."""
    reach_low, reach_high = min(outputs), max(outputs)
    want_low, want_high = min(g["low"] for g in goals), max(g["high"] for g in goals)
    room = max(want_high - want_low, abs(want_high) * 0.5, 1e-9)
    low = max(reach_low, 0.0 if reach_low >= 0 else want_low - room)
    high = min(reach_high, want_high + room)
    return (low, high) if high > low else (reach_low, reach_high)


def _output(value: Any) -> dict[str, str]:
    raw = value if isinstance(value, dict) else {}
    unit = clean_text(raw.get("unit"), LIMITS["unit"]) or ""
    return {
        "label": _without_unit(clean_text(raw.get("label"), LIMITS["label"]) or "Result", unit),
        "icon": clean_text(raw.get("icon"), LIMITS["icon"]) or "",
        "unit": unit,
    }


def _without_unit(label: str, unit: str) -> str:
    """"Voltage (V)" is "Voltage": the unit is shown beside the number."""
    if not unit:
        return label
    return re.sub(rf"\s*[(\[]\s*{re.escape(unit)}\s*[)\]]\s*$", "", label) or label


def _distance(a: dict[str, float], b: dict[str, float]) -> float:
    return sum(abs(a[k] - b.get(k, a[k])) for k in a)


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _snap(value: float, low: float, high: float, step: float) -> float:
    """`value` within the slider, on one of its steps."""
    snapped = low + round((min(max(value, low), high) - low) / step) * step
    return _round(min(snapped, high))


def _round(value: float) -> float:
    return float(round(value, 6))
