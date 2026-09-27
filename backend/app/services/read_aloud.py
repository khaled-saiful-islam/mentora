"""Read it to me, in the tutor's voice.

A child who cannot read yet taps the button and hears the question, then each
answer by its tile's shape — the same warm voice that teaches live lessons.

The words are never sent by the browser. The server finds the item in the
attempt (or, for a preview, in the set) and says what is on screen, so this is
not a way to make the voice say anything else. Each part is its own short
clip, so the player can leave a breath between them — one long clip at
ILMU's pace runs a question and four answers together.
"""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import NotFoundError, UpstreamError, ValidationError
from app.learning.registry import build_learning_kinds
from app.live.audio import Narrator
from app.providers.speech import SpeechError
from app.services.attempt_service import AttemptService
from app.services.learning_set_service import LearningSetService

Part = Literal["question", "option", "front", "back"]

# The quiz tiles, in order. The quiz player names them the same way
# (`MARKERS` in QuizPlayer.tsx), so the voice and the screen agree.
SHAPES = ("Triangle", "Diamond", "Circle", "Square")


def words_for(item: dict[str, Any], part: Part, n: int | None = None) -> str:
    """What a part of an item says aloud, as the student sees it."""
    if part == "question" and isinstance(item.get("prompt"), str):
        return item["prompt"]
    options = item.get("options")
    if part == "option" and isinstance(options, list) and n is not None and 0 <= n < len(options):
        return f"{SHAPES[n % len(SHAPES)]}: {options[n]}"
    if part in ("front", "back") and isinstance(item.get(part), str):
        return item[part]
    raise ValidationError("There is nothing to read there.")


class ReadAloudService:
    def __init__(self, session: AsyncSession, narrator: Narrator, settings: Settings) -> None:
        self._session = session
        self._narrator = narrator
        self._settings = settings

    async def for_attempt(
        self, student_id: UUID, attempt_id: UUID, item_id: str, part: Part, n: int | None
    ) -> bytes:
        """A part of an item in the student's own attempt, in its shown order."""
        view = await AttemptService(self._session).view(student_id, attempt_id)
        item = next((i for i in view.items if i.get("id") == item_id), None)
        return await self._say(view.language, item, part, n)

    async def for_set(
        self, owner_id: UUID, set_id: UUID, item_id: str, part: Part, n: int | None
    ) -> bytes:
        """A part of an item in a set its owner is previewing."""
        sets = LearningSetService(self._session)
        learning_set = await sets.owned(owner_id, set_id)
        version = await sets.version(learning_set)
        kind = build_learning_kinds().get(learning_set.kind)
        raw = next((i for i in (version.items if version else []) if i.get("id") == item_id), None)
        item = kind.public(raw) if kind and raw else None
        return await self._say(learning_set.language, item, part, n)

    async def _say(
        self, language: str, item: dict[str, Any] | None, part: Part, n: int | None
    ) -> bytes:
        if item is None:
            raise NotFoundError("That question is not in this set.")
        if language not in self._settings.read_aloud_language_list:
            raise ValidationError("The tutor's voice does not read this language yet.")
        words = words_for(item, part, n)
        try:
            return await self._narrator.speak(
                words,
                model=self._settings.speech_model,
                voice=self._settings.speech_voice,
                speed=self._settings.speech_speed,
            )
        except SpeechError as exc:
            raise UpstreamError(str(exc)) from exc
