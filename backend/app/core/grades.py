"""The school levels Mentora speaks: the Malaysian system.

Stored on students and on learning sets by `code`, shown by `label`. The order
of `GRADES` is the order of the picker, and `stage` is its grouping.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Grade:
    code: str
    label: str
    stage: str
    # Roughly the student's age at the start of the year — enough for a model
    # to pitch vocabulary, and for "is this appropriate?" to have a number.
    age: int


def _primary() -> tuple[Grade, ...]:
    return tuple(Grade(f"year_{n}", f"Year {n}", "Primary", 6 + n) for n in range(1, 7))


def _secondary() -> tuple[Grade, ...]:
    return tuple(Grade(f"form_{n}", f"Form {n}", "Secondary", 12 + n) for n in range(1, 6))


GRADES: tuple[Grade, ...] = (
    *_primary(),
    *_secondary(),
    Grade("lower_6", "Lower Six", "Pre-university", 18),
    Grade("upper_6", "Upper Six", "Pre-university", 19),
)

_BY_CODE: dict[str, Grade] = {grade.code: grade for grade in GRADES}


def is_grade(code: str) -> bool:
    return code in _BY_CODE


def grade_for(code: str | None) -> Grade | None:
    return _BY_CODE.get(code or "")


def grade_label(code: str | None) -> str | None:
    grade = grade_for(code)
    return grade.label if grade else None
