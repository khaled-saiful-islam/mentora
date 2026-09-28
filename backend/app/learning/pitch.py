"""How hard to make it, for a school year: what a child in that year can read,
how many steps they can follow, which numbers they have met, and how the
difficulty labels map onto the year.

"Audience: Year 3 (about 9 years old)" alone left a model to guess, and it
guessed high: questions a Year 3 class had never been taught. Every stage that
writes for students (a set, a study guide, a live lesson) and the check after
it read this, so the year means the same thing to all of them. Numbers follow
the KSSR and KSSM number ranges.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.grades import Grade


@dataclass(frozen=True, slots=True)
class Band:
    words: str
    steps: str
    numbers: str
    # The share of easy, medium and hard, for the youngest more gently.
    mix: str


_EARLY = "about 6 in 10 easy, 3 in 10 medium, 1 in 10 hard"
_MIDDLE = "about half easy, a third medium, the rest hard"
_SENIOR = "about a third each of easy, medium and hard"

BANDS: dict[str, Band] = {
    "year_1": Band(
        "sentences under 10 words, the simplest everyday words, one idea at a time, things "
        "a child can see, touch or do",
        "one step only, no reasoning chains",
        "whole numbers up to 100; adding and taking away within 100; halves and quarters "
        "only of shapes",
        _EARLY,
    ),
    "year_2": Band(
        "sentences under 12 words, everyday words, one idea at a time, familiar things",
        "one step only",
        "whole numbers up to 1 000; times tables of 2, 5 and 10; a half, a quarter, a third",
        _EARLY,
    ),
    "year_3": Band(
        "sentences under 15 words, everyday words; a school word is explained when used",
        "one step, or two simple steps at most for 'hard'",
        "whole numbers up to 10 000; times tables up to 10; fractions with the same "
        "denominator; money up to RM100",
        _EARLY,
    ),
    "year_4": Band(
        "sentences under 20 words, plain words; subject words the year has been taught",
        "up to two steps",
        "whole numbers up to 100 000; proper fractions, decimals to two places, simple percentages",
        _MIDDLE,
    ),
    "year_5": Band(
        "sentences under 20 words, plain words; subject words the year has been taught",
        "up to two steps, three for 'hard'",
        "whole numbers up to 1 000 000; fractions, decimals and percentages",
        _MIDDLE,
    ),
    "year_6": Band(
        "clear sentences under 25 words; subject words the year has been taught",
        "up to three steps",
        "whole numbers up to 10 000 000; fractions, decimals, percentages and simple ratio",
        _MIDDLE,
    ),
}
_LOWER_SECONDARY = Band(
    "clear sentences; subject vocabulary of lower secondary (KSSM)",
    "multi-step reasoning is fine",
    "the KSSM lower-secondary range for the subject",
    _SENIOR,
)
_UPPER_SECONDARY = Band(
    "clear, exam-style sentences (SPM level)",
    "multi-step reasoning and application",
    "the SPM range for the subject",
    _SENIOR,
)
_SIXTH_FORM = Band(
    "clear, exam-style sentences (STPM level)",
    "extended reasoning",
    "the STPM range for the subject",
    _SENIOR,
)


def band_for(grade: Grade) -> Band:
    if grade.code in BANDS:
        return BANDS[grade.code]
    if grade.code in ("form_1", "form_2", "form_3"):
        return _LOWER_SECONDARY
    if grade.code in ("form_4", "form_5"):
        return _UPPER_SECONDARY
    return _SIXTH_FORM


def pitch(grade: Grade | None) -> str:
    """The rules for pitching it at this year, for a prompt. Empty without a year."""
    if grade is None:
        return ""
    band = band_for(grade)
    return (
        f"Pitch everything for {grade.label}, not above it and not babyish:\n"
        f"- Words: {band.words}.\n"
        f"- Thinking: {band.steps}.\n"
        f"- Numbers, if any: {band.numbers}.\n"
        f"- Difficulty: 'easy' is what nearly every child in {grade.label} can already do, "
        f"'medium' the year's core, 'hard' the top of {grade.label} — never beyond what "
        f"the year's syllabus (KSSR/KSSM) teaches. Mix: {band.mix}."
    )
