"""Text a voice can say.

A model writes for the eye: `H₂O`, `25°C`, `e.g.`, a bullet, a bold word. A
voice reading that aloud says "H subscript two O", "twenty-five degree C",
"e g", or stumbles — and the tutor sounds like a machine reading a slide. So
before anything is spoken it passes through here, and what comes out is what a
teacher would actually say.

Plain rules, in order, each tested. It runs on everything the tutor says:
the lesson when it is recorded and every answer as it streams.
"""

from __future__ import annotations

import re

_DIGIT_WORDS = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine")
_SUBSCRIPTS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")

# Markup a model leaves in even when told not to.
_MARKUP: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\[([^\]]+)\]\((?:https?://)?[^)]+\)"), r"\1"),  # [text](link) → text
    (re.compile(r"https?://\S+"), ""),
    (re.compile(r"^\s{0,3}#{1,6}\s*", re.M), ""),  # headings
    (re.compile(r"^\s*(?:[-*•▪◦]|\d+[.)])\s+", re.M), ""),  # bullets, numbered lines
    (re.compile(r"(\*\*|__)(.+?)\1"), r"\2"),
    (re.compile(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])"), r"\1"),
    (re.compile(r"`([^`]*)`"), r"\1"),
)

_FRACTIONS = {
    "1/2": "a half",
    "1/3": "a third",
    "2/3": "two thirds",
    "1/4": "a quarter",
    "3/4": "three quarters",
    "1/5": "a fifth",
    "1/10": "a tenth",
}

_UNITS: tuple[tuple[str, str], ...] = (
    ("km/h", "kilometres per hour"),
    ("m/s²", "metres per second squared"),
    ("m/s", "metres per second"),
    ("°C", " degrees Celsius"),
    ("°F", " degrees Fahrenheit"),
    ("°", " degrees"),
    ("cm³", "cubic centimetres"),
    ("cm²", "square centimetres"),
    ("m²", "square metres"),
    ("m³", "cubic metres"),
    ("km²", "square kilometres"),
)

_WORDS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\be\.g\.,?", re.I), "for example,"),
    (re.compile(r"\bi\.e\.,?", re.I), "that is,"),
    (re.compile(r"\betc\.", re.I), "and so on."),
    (re.compile(r"\bvs\.?(?=\s)", re.I), "versus"),
    (re.compile(r"\bapprox\.", re.I), "approximately"),
    (re.compile(r"\bw/(?=\s)"), "with"),
)

# Arithmetic between numbers, so "3 × 4 = 12" is said, not spelled.
_MATHS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?<=\d)\s*[×x*]\s*(?=\d)"), " times "),
    (re.compile(r"(?<=\d)\s*÷\s*(?=\d)"), " divided by "),
    (re.compile(r"(?<=\d)\s*\+\s*(?=\d)"), " plus "),
    (re.compile(r"(?<=\d)\s+[-−–]\s+(?=\d)"), " minus "),
    (re.compile(r"(?<=\d)[-–](?=\d)"), " to "),  # a range: 5-6 years
    (re.compile(r"\s*(?:=)\s*"), " equals "),
    (re.compile(r"\s*≈\s*"), " is about "),
    (re.compile(r"\s*≠\s*"), " is not equal to "),
    (re.compile(r"\s*≤\s*"), " is at most "),
    (re.compile(r"\s*≥\s*"), " is at least "),
    (re.compile(r"(?<=\w)\s*<\s*(?=\w)"), " is less than "),
    (re.compile(r"(?<=\w)\s*>\s*(?=\w)"), " is more than "),
    (re.compile(r"\s*(?:→|->|⟶)\s*"), " becomes "),
    (re.compile(r"(?<=\d)\s*%"), " per cent"),
    (re.compile(r"\s*&\s*"), " and "),
)

_POWERS = (("²", " squared"), ("³", " cubed"), ("^2", " squared"), ("^3", " cubed"))

# A chemical formula or a code like "CO2": capitals, maybe a lower-case letter,
# and at least one digit. Said element by element: "C O two".
_FORMULA = re.compile(r"\b(?=[A-Z][A-Za-z\d]*\d)(?:[A-Z][a-z]?\d*){1,8}\b")
_ELEMENT = re.compile(r"([A-Z][a-z]?)(\d*)")
_EMOJI = re.compile("[\U0001f300-\U0001faff☀-➿️]")
_SPACES = re.compile(r"[ \t]+")
_SPACE_BEFORE_PUNCTUATION = re.compile(r"\s+([,.!?;:])")


def speakable(text: str) -> str:
    """What the tutor should actually say for `text`."""
    out = text.translate(_SUBSCRIPTS)
    for pattern, replacement in _MARKUP:
        out = pattern.sub(replacement, out)
    out = _EMOJI.sub("", out)
    for pattern, replacement in _WORDS:
        out = pattern.sub(replacement, out)
    for unit, words in _UNITS:
        out = out.replace(unit, f" {words.strip()}" if not words.startswith(" ") else words)
    out = _FORMULA.sub(_formula, out)
    for written, said in _FRACTIONS.items():
        out = re.sub(rf"(?<![\d/]){re.escape(written)}(?![\d/])", said, out)
    out = re.sub(r"(?<=\d)/(?=\d)", " over ", out)
    for written, said in _POWERS:
        out = out.replace(written, said)
    for pattern, replacement in _MATHS:
        out = pattern.sub(replacement, out)
    out = out.replace("\n", " ")
    out = _SPACES.sub(" ", out)
    out = _SPACE_BEFORE_PUNCTUATION.sub(r"\1", out)
    return out.strip()


def _formula(match: re.Match[str]) -> str:
    token = match.group(0)
    parts = []
    for element, count in _ELEMENT.findall(token):
        parts.append(element)
        if count:
            parts.append(_number(count))
    return " ".join(parts)


def _number(digits: str) -> str:
    # A subscript is said as a number up to twelve ("C six H twelve O six"),
    # digit by digit beyond that.
    value = int(digits)
    small = (
        "zero",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
    )
    if value < len(small):
        return small[value]
    return " ".join(_DIGIT_WORDS[int(d)] for d in digits)
