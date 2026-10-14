"""Read it to me, in the tutor's voice.

A child who cannot read yet taps the button and hears the question, then each
answer by its tile's shape — the same warm voice that teaches live lessons. A
game (§26) is narrated the same way: its story, each island's idea and task,
every card, step or side of a pair in its round and why it goes where it does,
a hint, and what an island taught once it is cleared — with the student's own
buddy named where the story says `{buddy}`.

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
from app.learning.game_rounds import pieces_of, say_words
from app.learning.registry import build_learning_kinds
from app.live.audio import Narrator
from app.providers.speech import SpeechError
from app.services.attempt_service import AttemptService
from app.services.learning_set_service import LearningSetService

Part = Literal[
    "question", "option", "front", "back", "hint", "explanation", "story",
    "learn", "task", "piece", "why", "before", "after", "word",
]  # fmt: skip
# A game's story, by piece: told as narration, or a panel's line by number.
STORY_PIECES = ("hook", "goal", "win")
# Mission control's lines around a game's story, by number: the call before
# it, "here is your mission" before the goal, and good luck after (§28.3.2).
MISSION = "mission"
MISSION_LINES = {
    "en": (
        "Attention, agent. A new mission is coming in.",
        "Here is your mission.",
        "{islands} islands stand in your way. Good luck, agent.",
    ),
    "ms": (
        "Perhatian, ejen. Satu misi baharu sedang masuk.",
        "Inilah misi anda.",
        "{islands} pulau menanti anda. Semoga berjaya, ejen.",
    ),
}
STORY_PANELS = ("opening", "ending")
# An island's beats in the story (§25): a panel before it, one after.
BEAT_PARTS = ("before", "after")
BUDDY = "{buddy}"

# The quiz tiles, in order. The quiz player names them the same way
# (`MARKERS` in QuizPlayer.tsx), so the voice and the screen agree.
SHAPES = ("Triangle", "Diamond", "Circle", "Square")


def words_for(item: dict[str, Any], part: Part, n: int | None = None) -> str:
    """What a part of an item says aloud, as the student sees it."""
    if part == "question":
        # A question's prompt, or a game island's task (§26).
        asked = item.get("prompt") or item.get("task")
        if isinstance(asked, str) and asked:
            return asked
    options = item.get("options")
    if part == "option" and isinstance(options, list) and n is not None and 0 <= n < len(options):
        return f"{SHAPES[n % len(SHAPES)]}: {options[n]}"
    if part in ("piece", "why"):
        pieces = pieces_of(item)
        piece = pieces[n] if n is not None and 0 <= n < len(pieces) else {}
        said = piece.get("text" if part == "piece" else "why")
        if isinstance(said, str) and said:
            return said
    if part == "word":
        # One word of a Say It, for a child who missed it (§28.3.5).
        words = say_words(item)
        if n is not None and 0 <= n < len(words):
            return words[n]
    if part in ("front", "back", "hint", "explanation", "learn", "task") and item.get(part):
        return str(item[part])
    raise ValidationError("There is nothing to read there.")


def story_words(extras: dict[str, Any], piece: str, n: int | None = None) -> str:
    """What a piece of a game's story says aloud (§24)."""
    story = extras.get("story") if isinstance(extras.get("story"), dict) else {}
    if piece in STORY_PANELS:
        words = _line(story.get(piece), n)
    else:
        words = story.get(piece) if piece in STORY_PIECES else None
    if not isinstance(words, str) or not words.strip():
        raise ValidationError("There is nothing to read there.")
    return words


def mission_words(language: str, n: int | None, islands: int) -> str:
    """Mission control's line `n`, in the game's language."""
    lines = MISSION_LINES.get(language, MISSION_LINES["en"])
    if n is None or not 0 <= n < len(lines):
        raise ValidationError("There is nothing to read there.")
    return lines[n].format(islands=islands)


def beat_words(extras: dict[str, Any], island: str, part: str, n: int | None) -> str:
    """A line of the story panel before or after a game's island (§25)."""
    beats = extras.get("beats") if isinstance(extras.get("beats"), dict) else {}
    beat = beats.get(island) if isinstance(beats.get(island), dict) else {}
    words = _line(beat.get(part), n)
    if not words:
        raise ValidationError("There is nothing to read there.")
    return words


def game_narration(
    extras: dict[str, Any], items: list[dict[str, Any]], language: str = "en"
) -> list[str]:
    """Every line a game's narrator says (§28.3.2), in the order a child hears
    them — mission control's call, the story's opening and the mission, then
    each island's beat, idea, task, what it taught and the beat after, then
    the ending — as written, `{buddy}` and all. What the read-aloud routes
    say, so recording these fills their cache."""
    story = extras.get("story") if isinstance(extras.get("story"), dict) else {}
    beats = extras.get("beats") if isinstance(extras.get("beats"), dict) else {}
    mission = [mission_words(language, n, len(items)) for n in range(3)]
    said: list[str | None] = [
        mission[0],
        story.get("hook"),
        *_says(story.get("opening")),
        mission[1],
        story.get("goal"),
        mission[2],
    ]
    for item in items:
        beat = beats.get(item.get("id")) if isinstance(beats.get(item.get("id")), dict) else {}
        said += [
            *_says(beat.get("before")),
            item.get("learn"),
            item.get("task"),
            item.get("explanation"),
            *_says(beat.get("after")),
        ]
    said += [story.get("win"), *_says(story.get("ending"))]
    # As written, not tidied: the clip is keyed by the exact words said.
    return list(dict.fromkeys(s for s in said if isinstance(s, str) and s.strip()))


def _says(lines: Any) -> list[str | None]:
    if not isinstance(lines, list):
        return []
    return [str(line.get("says") or "") if isinstance(line, dict) else None for line in lines]


def _line(lines: Any, n: int | None) -> str | None:
    if not isinstance(lines, list) or n is None or not 0 <= n < len(lines):
        return None
    line = lines[n]
    return str(line.get("says") or "") if isinstance(line, dict) else None


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
        game = view.kind == "game"
        if part == "story":
            words = (
                mission_words(view.language, n, len(view.items))
                if item_id == MISSION
                else story_words(view.extras, item_id, n)
            )
            return await self._speak(view.language, words, buddy, game=game)
        if part in BEAT_PARTS:
            return await self._speak(
                view.language, beat_words(view.extras, item_id, part, n), buddy, game=game
            )
        item = next((i for i in view.items if i.get("id") == item_id), None)
        if part == "hint":
            # Only once asked for — asking is what costs a game's points.
            told = await AttemptService(self._session).asked_hint(student_id, attempt_id, item_id)
            item = {"id": item_id, "hint": told} if told else None
        if part == "explanation":
            played = next((p for p in view.answered if p.item_id == item_id), None)
            told = (played.reveal or {}) if played else {}
            item = {"id": item_id, "explanation": told.get("explanation")} if told else None
        return await self._say(view.language, item, part, n, buddy, game=game)

    async def for_set(
        self, owner_id: UUID, set_id: UUID, item_id: str, part: Part, n: int | None
    ) -> bytes:
        """A part of an item in a set its owner is previewing."""
        sets = LearningSetService(self._session)
        learning_set = await sets.owned(owner_id, set_id)
        version = await sets.version(learning_set)
        extras = dict(version.extras or {}) if version else {}
        game = learning_set.kind == "game"
        islands = len(version.items) if version else 0
        if part == "story":
            words = (
                mission_words(learning_set.language, n, islands)
                if item_id == MISSION
                else story_words(extras, item_id, n)
            )
            return await self._speak(learning_set.language, words, game=game)
        if part in BEAT_PARTS:
            return await self._speak(
                learning_set.language, beat_words(extras, item_id, part, n), game=game
            )
        kind = build_learning_kinds().get(learning_set.kind)
        raw = next((i for i in (version.items if version else []) if i.get("id") == item_id), None)
        item = kind.public(raw) if kind and raw else None
        if part in ("explanation", "hint") and raw:
            # The maker previewing has every answer anyway.
            item = {"id": item_id, part: raw.get(part)}
        return await self._say(learning_set.language, item, part, n, game=game)

    async def _say(
        self,
        language: str,
        item: dict[str, Any] | None,
        part: Part,
        n: int | None,
        buddy: str = "your buddy",
        *,
        game: bool = False,
    ) -> bytes:
        if item is None:
            raise NotFoundError("That question is not in this set.")
        return await self._speak(language, words_for(item, part, n), buddy, game=game)

    async def _speak(
        self, language: str, words: str, buddy: str = "your buddy", *, game: bool = False
    ) -> bytes:
        """`words` in the tutor's voice — or, in a game, mission control's:
        deeper and steadier (§28.3.2)."""
        if language not in self._settings.read_aloud_language_list:
            raise ValidationError("The tutor's voice does not read this language yet.")
        words = words.replace(BUDDY, buddy)
        try:
            voice, speed = voice_for(self._settings, game=game)
            return await self._narrator.speak(
                words, model=self._settings.speech_model, voice=voice, speed=speed
            )
        except SpeechError as exc:
            raise UpstreamError(str(exc)) from exc


def voice_for(settings: Settings, *, game: bool) -> tuple[str, float]:
    """The voice and its pace: a game's narrator, or the tutor's."""
    if game:
        return settings.game_voice, settings.game_voice_speed
    return settings.speech_voice, settings.speech_speed
