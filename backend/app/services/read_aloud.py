"""Read it to me, in the tutor's voice.

A child who cannot read yet taps the button and hears the question, then each
answer by its tile's shape — the same warm voice that teaches live lessons. A
game (§23) is narrated the same way: its story, each chapter, a hint, and the
explanation once a challenge is answered, with the student's own buddy named
where the story says `{buddy}`.

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

from app.core.buddies import buddy_name
from app.core.config import Settings
from app.core.errors import NotFoundError, UpstreamError, ValidationError
from app.db.models.user import User
from app.learning.registry import build_learning_kinds
from app.live.audio import Narrator
from app.providers.speech import SpeechError
from app.services.attempt_service import AttemptService
from app.services.learning_set_service import LearningSetService

Part = Literal["question", "option", "front", "back", "hint", "explanation", "story"]
# A game's story, by piece; a chapter's intro and outro also take its number.
STORY_PIECES = ("hook", "goal", "intro", "outro", "win", "retry")
BUDDY = "{buddy}"

# The quiz tiles, in order. The quiz player names them the same way
# (`MARKERS` in QuizPlayer.tsx), so the voice and the screen agree.
SHAPES = ("Triangle", "Diamond", "Circle", "Square")


def words_for(item: dict[str, Any], part: Part, n: int | None = None) -> str:
    """What a part of an item says aloud, as the student sees it."""
    if part == "question" and isinstance(item.get("prompt"), str):
        return item["prompt"]
    options = item.get("options")
    if part == "option" and isinstance(options, list) and n is not None and 0 <= n < len(options):
        # A game's options are bubbles, lanes and pieces, not shaped tiles: their
        # words alone. Told apart by shape, as everything here is (`has_hint`).
        if "has_hint" in item:
            return str(options[n])
        return f"{SHAPES[n % len(SHAPES)]}: {options[n]}"
    if part in ("front", "back", "hint", "explanation") and item.get(part):
        return str(item[part])
    raise ValidationError("There is nothing to read there.")


def story_words(extras: dict[str, Any], piece: str, n: int | None = None) -> str:
    """What a piece of a game's story says aloud (§23)."""
    story = extras.get("story") if isinstance(extras.get("story"), dict) else {}
    if piece in ("intro", "outro"):
        chapters = story.get("chapters") if isinstance(story.get("chapters"), list) else []
        chapter = chapters[n] if n is not None and 0 <= n < len(chapters) else {}
        words = chapter.get(piece) if isinstance(chapter, dict) else None
    else:
        words = story.get(piece) if piece in STORY_PIECES else None
    if not isinstance(words, str) or not words.strip():
        raise ValidationError("There is nothing to read there.")
    return words


class ReadAloudService:
    def __init__(self, session: AsyncSession, narrator: Narrator, settings: Settings) -> None:
        self._session = session
        self._narrator = narrator
        self._settings = settings

    async def for_attempt(
        self, student_id: UUID, attempt_id: UUID, item_id: str, part: Part, n: int | None
    ) -> bytes:
        """A part of an item in the student's own attempt, in its shown order —
        or of its story. An explanation only once its question is answered."""
        view = await AttemptService(self._session).view(student_id, attempt_id)
        student = await self._session.get(User, student_id)
        buddy = buddy_name(student.buddy if student else None)
        if part == "story":
            return await self._speak(view.language, story_words(view.extras, item_id, n), buddy)
        item = next((i for i in view.items if i.get("id") == item_id), None)
        if part == "hint":
            # Only once asked for — asking is what costs a game's points.
            told = await AttemptService(self._session).asked_hint(student_id, attempt_id, item_id)
            item = {"id": item_id, "hint": told} if told else None
        if part == "explanation":
            played = next((p for p in view.answered if p.item_id == item_id), None)
            told = (played.reveal or {}) if played else {}
            item = {"id": item_id, "explanation": told.get("explanation")} if told else None
        return await self._say(view.language, item, part, n, buddy)

    async def for_set(
        self, owner_id: UUID, set_id: UUID, item_id: str, part: Part, n: int | None
    ) -> bytes:
        """A part of an item in a set its owner is previewing."""
        sets = LearningSetService(self._session)
        learning_set = await sets.owned(owner_id, set_id)
        version = await sets.version(learning_set)
        if part == "story":
            extras = dict(version.extras or {}) if version else {}
            return await self._speak(learning_set.language, story_words(extras, item_id, n))
        kind = build_learning_kinds().get(learning_set.kind)
        raw = next((i for i in (version.items if version else []) if i.get("id") == item_id), None)
        item = kind.public(raw) if kind and raw else None
        if part in ("explanation", "hint") and raw:
            # The maker previewing has every answer anyway.
            item = {"id": item_id, part: raw.get(part)}
        return await self._say(learning_set.language, item, part, n)

    async def _say(
        self,
        language: str,
        item: dict[str, Any] | None,
        part: Part,
        n: int | None,
        buddy: str = "your buddy",
    ) -> bytes:
        if item is None:
            raise NotFoundError("That question is not in this set.")
        return await self._speak(language, words_for(item, part, n), buddy)

    async def _speak(self, language: str, words: str, buddy: str = "your buddy") -> bytes:
        if language not in self._settings.read_aloud_language_list:
            raise ValidationError("The tutor's voice does not read this language yet.")
        words = words.replace(BUDDY, buddy)
        try:
            return await self._narrator.speak(
                words,
                model=self._settings.speech_model,
                voice=self._settings.speech_voice,
                speed=self._settings.speech_speed,
            )
        except SpeechError as exc:
            raise UpstreamError(str(exc)) from exc
