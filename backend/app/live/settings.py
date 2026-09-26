"""What a teacher chooses for a live session, checked once at the boundary.

Everything the tutor does is held to these: the parts in the teacher's order,
the approach, the difficulty, the length, how questions are taken, and the
quiz afterwards. Stored on the session as a frozen copy.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.grades import is_grade

Difficulty = Literal["beginner", "intermediate", "advanced"]
Approach = Literal["storytelling", "step_by_step", "socratic", "example_heavy", "exam_focused"]
QuestionMode = Literal["anytime", "pauses"]

DURATIONS = (10, 15, 20, 30, 45)
MAX_PARTS = 12
# How long one segment runs: a minute or two, so a hand never waits long.
SEGMENT_SECONDS = 90


def _clean(value: str) -> str:
    return " ".join(value.split())


class QuestionSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: QuestionMode = "anytime"
    max_per_student: int = Field(default=3, ge=1, le=10)


class QuizSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    count: int = Field(default=10, ge=3, le=20)
    difficulty: Difficulty = "intermediate"
    due_at: datetime | None = None


class VoiceSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    voice: str | None = None
    speed: float | None = Field(default=None, ge=0.8, le=1.2)


class SessionSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: str = Field(min_length=1, max_length=80)
    topic: str = Field(min_length=2, max_length=160)
    grade_level: str
    breakdown: list[str] = Field(min_length=1, max_length=MAX_PARTS)
    difficulty: Difficulty = "intermediate"
    approach: Approach = "storytelling"
    custom_instruction: str = Field(default="", max_length=400)
    language: Literal["en"] = "en"
    duration_minutes: int = 15
    questions: QuestionSettings = Field(default_factory=QuestionSettings)
    quiz: QuizSettings = Field(default_factory=QuizSettings)
    voice: VoiceSettings = Field(default_factory=VoiceSettings)

    @field_validator("subject", "topic", "custom_instruction")
    @classmethod
    def _tidy(cls, value: str) -> str:
        return _clean(value)

    @field_validator("grade_level")
    @classmethod
    def _grade(cls, value: str) -> str:
        if not is_grade(value):
            raise ValueError("not a school level Mentora knows")
        return value

    @field_validator("breakdown")
    @classmethod
    def _parts(cls, value: list[str]) -> list[str]:
        parts = [_clean(p)[:120] for p in value if _clean(p)]
        if not parts:
            raise ValueError("list at least one part of the topic")
        if len({p.lower() for p in parts}) != len(parts):
            raise ValueError("each part of the topic should be different")
        return parts

    @field_validator("duration_minutes")
    @classmethod
    def _duration(cls, value: int) -> int:
        if value not in DURATIONS:
            raise ValueError(f"choose one of {', '.join(map(str, DURATIONS))} minutes")
        return value

    def segments_per_part(self) -> list[int]:
        """How many segments each part gets, sharing the time out evenly and
        never giving a part less than one."""
        total = max(len(self.breakdown), round(self.duration_minutes * 60 / SEGMENT_SECONDS))
        base, extra = divmod(total, len(self.breakdown))
        return [base + (1 if i < extra else 0) for i in range(len(self.breakdown))]


class Style:
    """How one teaching approach writes. A small strategy object: one per
    approach, each with the rules the model is held to."""

    def __init__(self, label: str, rules: str) -> None:
        self.label = label
        self.rules = rules


APPROACHES: dict[str, Style] = {
    "storytelling": Style(
        "Storytelling",
        "Teach through a story: a character, a place, something that happens, and "
        "what it shows us. Carry the same story through the whole lesson.",
    ),
    "step_by_step": Style(
        "Step by step",
        "Explain one step at a time, in order, and say which step we are on. Check "
        "each step lands before the next.",
    ),
    "socratic": Style(
        "Question-led",
        "Lead with questions to the room. Let them wonder, then reveal the idea. "
        "Most beats open or close with a question.",
    ),
    "example_heavy": Style(
        "Lots of examples",
        "Every idea comes with a concrete example from daily life, and a second one "
        "when it is hard.",
    ),
    "exam_focused": Style(
        "Exam-focused",
        "Keep to what the exam asks, name the key words to use in answers, and point "
        "out the common mistakes.",
    ),
}

DIFFICULTY_RULES: dict[str, str] = {
    "beginner": "The group is new to this. Use the simplest words, go slowly, no jargon.",
    "intermediate": "The group knows the basics. Name the proper terms and explain them.",
    "advanced": "The group is confident. Go deeper, connect ideas, stretch them.",
}


# --- quick checks, by age -----------------------------------------------------------


@dataclass(frozen=True, slots=True)
class CheckSize:
    """How long a quick check stays open, and so how short it must be to read
    in that time: young readers get longer, older students a brisk one."""

    seconds: int
    question_words: int
    option_words: int


CHECK_EARLY = CheckSize(seconds=30, question_words=12, option_words=4)
CHECK_MIDDLE = CheckSize(seconds=20, question_words=14, option_words=5)
CHECK_UPPER = CheckSize(seconds=15, question_words=12, option_words=5)


def check_size(grade_level: str | None) -> CheckSize:
    """Year 1–3: 30 s. Year 4–6: 20 s. Form 1 and up: 15 s."""
    code = grade_level or ""
    if code.startswith("year_"):
        year = int(code.split("_")[1]) if code.split("_")[1].isdigit() else 4
        return CHECK_EARLY if year <= 3 else CHECK_MIDDLE
    if code.startswith(("form_", "lower_", "upper_")):
        return CHECK_UPPER
    return CHECK_MIDDLE
