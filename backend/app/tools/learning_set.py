"""Making a quiz, flashcards or a study guide from a chat.

"Make me a quiz on fractions for my Year 4 maths class" starts the same build
as Library → Make (`services/set_builds.py`). The model is told to make sure
of the four things a set needs — what to make, the topic, the school year
and the subject — and to ask for whichever is missing rather than guess. This
tool checks them again, and a call without them is refused with the question
to ask.

The result is not a source to cite. Its address is the set's own page in the
app (`/library/{id}`), and the chat shows it as a card that follows the
build (`is_made` in `providers/base.py`).
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from typing import Any, Protocol

from app.core.errors import MentoraError
from app.core.grades import GRADES, Grade
from app.providers.base import ToolResult
from app.services.generation_service import GenerationDraft
from app.services.set_builds import Started
from app.tools.base import ToolPresentation, ToolUnavailable

KINDS: dict[str, str] = {"quiz": "quiz", "flashcard": "flashcards", "study_guide": "study guide"}
_KIND_WORDS = {
    "quiz": "quiz",
    "quizzes": "quiz",
    "flashcard": "flashcard",
    "flashcards": "flashcard",
    "cards": "flashcard",
    "study_guide": "study_guide",
    "study guide": "study_guide",
    "guide": "study_guide",
}
_YEAR_WORDS = re.compile(r"^(tahun|darjah|standard|std|primary)\s*", re.I)
_FORM_WORDS = re.compile(r"^(tingkatan|secondary)\s*", re.I)


class SetMaker(Protocol):
    async def make(self, draft: GenerationDraft) -> Started: ...


def grade_from(said: str) -> Grade | None:
    """A school year as a person might write it: "Year 4", "form 2", "year_4",
    "Tahun 4", "Tingkatan 2", "Lower Six". None if it is not one."""
    text = " ".join(str(said).lower().replace("_", " ").split())
    text = _YEAR_WORDS.sub("year ", text)
    text = _FORM_WORDS.sub("form ", text)
    text = re.sub(r"^(year|form)\s*(\d)$", r"\1 \2", text)
    return next((g for g in GRADES if text in (g.code.replace("_", " "), g.label.lower())), None)


def _text(value: Any, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


class MakeLearningSetTool:
    name = "make_learning_set"
    description = (
        "Make a quiz, a deck of flashcards or a study guide with Mentora's own maker "
        "(the same one as Library → Make). It is saved to the person's Library and "
        "takes about a minute. It needs what to make, the school year (Year 1-6 or Form "
        "1-5), and what it is about: a topic, a subject, or both. Work out what you can "
        "yourself instead of asking: given a topic but no subject, give the subject it "
        "belongs to (fractions → Mathematics, the water cycle → Science); given a "
        "subject but no topic, leave the topic out and it covers that subject for the "
        "year. Once you have those, call it straight away: do not ask which part of the "
        "topic, how many, how hard, or in what format — it picks a sensible spread and "
        "count for the year by itself. Ask only for what you cannot work out — what to "
        "make, the year, or what it is about — in one short, friendly question. Never "
        "guess a year. Never write the questions or cards out in the chat yourself."
    )
    parameters: dict[str, Any] = {
        "type": "object",
        "properties": {
            "kind": {
                "type": "string",
                "enum": list(KINDS),
                "description": "What to make: a quiz, flashcards, or a study guide.",
            },
            "topic": {
                "type": "string",
                "description": "What it is about, as the person put it. Leave out if only "
                "a subject was given.",
            },
            "subject": {
                "type": "string",
                "description": "The school subject, e.g. Science — worked out from the "
                "topic when the person did not say.",
            },
            "year": {
                "type": "string",
                "description": "The school year it is for, e.g. 'Year 4' or 'Form 2'.",
            },
            "count": {
                "type": "integer",
                "description": "How many questions or cards, only if the person said.",
            },
            "language": {
                "type": "string",
                "description": "Its language as a code (en, ms, ta, zh, bn), if not English.",
            },
        },
        "required": ["kind", "year"],
    }
    presentation = ToolPresentation(
        running="Starting it", done="Started", noun="set", failed="Could not start it"
    )

    def __init__(self, maker: SetMaker, *, languages: Sequence[str] = ("en",)) -> None:
        self._maker = maker
        self._languages = tuple(languages)

    async def run(self, **kwargs: Any) -> Sequence[ToolResult]:
        draft, grade = self._draft(kwargs)
        try:
            started = await self._maker.make(draft)
        except MentoraError as exc:
            raise ToolUnavailable(exc.message) from exc
        what = KINDS[started.kind]
        about = ", ".join(x for x in (grade.label, draft.subject) if x)
        return [
            ToolResult(
                tool=self.name,
                title=started.title,
                url=f"/library/{started.set_id}",
                snippet=" · ".join(x for x in (what.capitalize(), grade.label, draft.subject) if x),
                excerpt=(
                    f'Started making the {what} "{started.title}" ({about}). It will be '
                    "ready in about a minute; it is shown as a "
                    "card in this chat, it goes into the Library, and the bell rings when it "
                    "is ready. Tell the person that in a sentence or two. Do not write the "
                    "questions or cards yourself, and do not cite this."
                ),
            )
        ]

    def _draft(self, given: dict[str, Any]) -> tuple[GenerationDraft, Grade]:
        kind = _KIND_WORDS.get(_text(given.get("kind"), 32).lower(), "")
        topic = _text(given.get("topic"), 200)
        subject = _text(given.get("subject"), 80)
        year = _text(given.get("year"), 32)
        missing = [
            name
            for name, value in (
                ("what to make (a quiz, flashcards or a study guide)", kind),
                ("the school year", year),
                ("what it is about (a topic or a subject)", len(topic) >= 2 or subject),
            )
            if not value
        ]
        if missing:
            raise ToolUnavailable(
                f"Not started: still need {', '.join(missing)}. Ask the person for it."
            )
        grade = grade_from(year)
        if grade is None:
            raise ToolUnavailable(
                f'Not started: "{year}" is not a school year here (Year 1-6, Form 1-5). '
                "Ask the person which year it is for."
            )
        count = given.get("count")
        language = _text(given.get("language"), 8).lower() or "en"
        draft = GenerationDraft(
            kind=kind,
            # Only a subject: the set covers that subject for the year.
            topic=topic if len(topic) >= 2 else f"{subject} for {grade.label}",
            subject=subject or None,
            grade_level=grade.code,
            count=count if isinstance(count, int) and 1 <= count <= 50 else None,
            language=language if language in self._languages else "en",
        )
        return draft, grade
