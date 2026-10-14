"""Say It (§28.3.5): lines to read aloud, kept to what an ear can hear; only
for the youngest, in English or Malay; one word said again by the voice; and
a child's reading heard in the set's language, with only the words kept."""

from __future__ import annotations

from sqlalchemy import select

from app.api.deps import get_transcriber
from app.db.models.attempt import Attempt
from app.db.models.learning import LearningSet, LearningSetVersion
from app.learning.game_finish import say_for_young
from app.learning.game_rounds import pieces_of, rounds_of, say_words
from app.services.read_aloud import words_for
from tests.play_helpers import shared

SAY = {
    "lines": [
        {"text": "Petani menanam padi.", "icon": "🌾", "why": "A farmer plants rice."},
        {"text": "Ikan berenang", "icon": "🐟", "why": "Fish swim."},
    ]
}
MATCH = {
    "pairs": [
        {"left": "petani", "right": "farmer"},
        {"left": "ikan", "right": "fish"},
        {"left": "padi", "right": "rice"},
    ]
}


def test_lines_to_say_are_words_an_ear_can_hear() -> None:
    found = rounds_of({"say": SAY}, "why")["say"]
    assert [line["text"] for line in found["lines"]] == ["Petani menanam padi.", "Ikan berenang"]
    assert all(line["id"] for line in found["lines"])
    digits = {"lines": [*SAY["lines"], {"text": "Ada 3 ekor ikan"}]}
    assert len(rounds_of({"say": digits}, "why")["say"]["lines"]) == 2
    long = {"text": "one two three four five six seven eight nine"}
    assert "say" not in rounds_of({"say": {"lines": [SAY["lines"][0], long]}}, "why")


def test_the_voice_can_say_one_word_of_a_line() -> None:
    item = {"play": "say", "say": rounds_of({"say": SAY}, "why")["say"]}
    assert say_words(item) == ["Petani", "menanam", "padi", "Ikan", "berenang"]
    assert words_for(item, "word", 2) == "padi"
    assert pieces_of(item)[1]["text"] == "Ikan berenang"


def test_say_it_is_for_the_youngest_in_english_or_malay() -> None:
    island = {"id": "a", "play": "say", "say": SAY, "match": MATCH, "task": "Say it!"}
    assert say_for_young([island], grade="year_2", language="ms", task="Join")[0]["play"] == "say"
    for grade, language in (("year_5", "ms"), (None, "en"), ("year_1", "zh")):
        played = say_for_young([island], grade=grade, language=language, task="Join")[0]
        assert (played["play"], played["task"]) == ("match", "Join")


class Ears:
    def __init__(self, text: str) -> None:
        self.text, self.languages = text, []

    async def transcribe(self, audio, *, filename, mime, language=None):
        self.languages.append(language)
        return self.text


async def _say_game(session, teacher, student):
    assignment = await shared(session, teacher, [student], kind="game", grade_level="year_2")
    learning_set = await session.get(LearningSet, assignment.set_id)
    learning_set.language = "ms"
    version = await session.scalar(
        select(LearningSetVersion).where(LearningSetVersion.set_id == assignment.set_id)
    )
    first = {**version.items[0], "play": "say", "say": rounds_of({"say": SAY}, "w")["say"]}
    version.items = [first, *version.items[1:]]
    await session.flush()
    return assignment, first["id"]


async def test_a_reading_is_heard_in_the_set_s_language_and_only_the_words_kept(
    session, client, teacher, student
) -> None:
    assignment, island = await _say_game(session, teacher, student)
    ears = Ears("  petani menanam  padi ")
    c = client(student)
    c._transport.app.dependency_overrides[get_transcriber] = lambda: ears  # noqa: SLF001
    async with c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        base = f"/api/me/attempts/{attempt['id']}/items"
        clip = {"clip": ("r.wav", b"RIFF..", "audio/wav")}
        heard = await c.post(f"{base}/{island}/hear", data={"line": "0"}, files=clip)
        no_line = await c.post(f"{base}/{island}/hear", data={"line": "7"}, files=clip)
        not_say = await c.post(f"{base}/g2/hear", data={"line": "0"}, files=clip)
    assert heard.json() == {"text": "petani menanam padi"}
    assert ears.languages == ["ms"]
    assert no_line.status_code == 404 and not_say.status_code == 404
    kept = await session.get(Attempt, attempt["id"])
    await session.refresh(kept)
    assert kept.plan["heard"] == {island: {"0": "petani menanam padi"}}
