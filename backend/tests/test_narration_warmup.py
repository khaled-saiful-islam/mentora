"""A game told aloud from its first second (§28.3.2): its narration recorded
once, as soon as it is made — each buddy's version where a line names one."""

from __future__ import annotations

from contextlib import asynccontextmanager

from app.core.config import Settings
from app.providers.speech import SpeechError
from app.services.narration_warmup import MOST_CLIPS, every_voicing, record_game
from app.services.read_aloud import game_narration
from tests.play_helpers import ready_set

EXTRAS = {
    "story": {
        "hook": "The river is drying up!",
        "opening": [
            {"who": "Mak", "says": "Help us, {buddy}!"},
            {"who": "{buddy}", "says": "Let's go!"},
        ],
        "goal": "Find where the water went.",
        "win": "The river flows again!",
        "ending": [{"who": "Mak", "says": "Thank you!"}],
    },
    "beats": {"i1": {"before": [{"who": "Mak", "says": "Look at the sky."}], "after": []}},
}
ITEMS = [
    {"id": "i1", "learn": "Water evaporates.", "task": "Sort them!", "explanation": "Heat lifts."},
    {"id": "i2", "learn": "Clouds form.", "task": "Line up!", "explanation": "Help us, {buddy}!"},
]


def test_a_game_says_its_lines_in_the_order_they_are_heard_each_once() -> None:
    assert game_narration(EXTRAS, ITEMS) == [
        "The river is drying up!",
        "Help us, {buddy}!",
        "Let's go!",
        "Find where the water went.",
        "Look at the sky.",
        "Water evaporates.",
        "Sort them!",
        "Heat lifts.",
        "Clouds form.",
        "Line up!",
        "The river flows again!",
        "Thank you!",
    ]


def test_a_line_naming_the_buddy_is_said_for_every_buddy_and_for_a_preview() -> None:
    said = every_voicing(["Help us, {buddy}!", "Let's go!"])
    assert said == [
        "Help us, Kiko!",
        "Help us, Tompok!",
        "Help us, Ollie!",
        "Help us, Momo!",
        "Help us, Rimau!",
        "Help us, your buddy!",
        "Let's go!",
    ]


class FakeNarrator:
    def __init__(self, *, fail_after: int | None = None) -> None:
        self.said: list[str] = []
        self.fail_after = fail_after

    async def speak(self, text: str, **_: object) -> bytes:
        if self.fail_after is not None and len(self.said) >= self.fail_after:
            raise SpeechError("the voice is down")
        self.said.append(text)
        return b"mp3"


def _maker(session):
    @asynccontextmanager
    async def make():
        yield session

    return make


async def _record(session, game, narrator) -> int:
    settings = Settings(read_aloud_languages="en")
    return await record_game(
        game.id, session_maker=_maker(session), narrator=narrator, settings=settings
    )


async def _game(session, teacher, language="en"):
    learning_set = await ready_set(session, teacher, kind="game", n=2)
    learning_set.language = language
    await session.flush()
    return learning_set


async def test_a_game_s_narration_is_recorded_once_it_is_made(session, teacher) -> None:
    game = await _game(session, teacher)
    narrator = FakeNarrator()
    recorded = await _record(session, game, narrator)
    assert recorded == len(narrator.said) > 0
    assert len(narrator.said) <= MOST_CLIPS


async def test_nothing_is_recorded_in_a_language_the_voice_does_not_read(session, teacher) -> None:
    game = await _game(session, teacher, language="ms")
    narrator = FakeNarrator()
    assert await _record(session, game, narrator) == 0
    assert narrator.said == []


async def test_a_voice_that_goes_down_stops_the_recording_quietly(session, teacher) -> None:
    game = await _game(session, teacher)
    narrator = FakeNarrator(fail_after=1)
    assert await _record(session, game, narrator) == 1
