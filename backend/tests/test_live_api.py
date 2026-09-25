"""The voice lab through the API: teachers only, and each route doing what the
page will ask of it."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.api.deps import get_narrator, get_voice_lab
from app.learning.model import Meter
from app.live.audio import AudioCache, Narrator
from app.live.voice_lab import VoiceLab
from app.moderation.gate import ModerationGate
from tests.learning_fakes import FakeModel
from tests.test_chat_service import FakeProvider
from tests.test_live_voice import GOOD_LESSON, FakeSpeech


@pytest.fixture
def live(client, tmp_path: Path):
    """`live(user)`: a client whose lab and voice are fakes."""
    voice = FakeSpeech()

    def make(user, *, lesson=GOOD_LESSON, chunks=("Leaves are green because of chlorophyll. ",)):
        c = client(user)
        overrides = c._transport.app.dependency_overrides  # noqa: SLF001
        overrides[get_voice_lab] = lambda: VoiceLab(
            FakeModel({"live.lesson": lesson}, Meter()),
            FakeProvider(list(chunks)),
            ModerationGate(),
        )
        overrides[get_narrator] = lambda: Narrator(voice, AudioCache(tmp_path))
        return c

    make.voice = voice
    return make


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", "/api/live/voices", None),
        ("post", "/api/live/voice-lab/lesson", {"topic": "rain"}),
        ("post", "/api/live/speech", {"text": "Hello."}),
        (
            "post",
            "/api/live/voice-lab/answer",
            {"question": "Why?", "student": "Adam", "topic": "rain"},
        ),
    ],
)
async def test_students_cannot_use_the_voice_lab(live, student, method, path, body) -> None:
    async with live(student) as c:
        response = await (c.get(path) if method == "get" else c.post(path, json=body))
    assert response.status_code == 403


async def test_a_teacher_sees_the_voices_on_offer(live, teacher) -> None:
    async with live(teacher) as c:
        offered = (await c.get("/api/live/voices")).json()
    assert offered["voice"] in offered["voices"]
    assert offered["model"] in offered["models"]
    assert offered["min_speed"] < offered["speed"] < offered["max_speed"]


async def test_a_teacher_gets_a_spoken_lesson_and_lines_for_each_student(live, teacher) -> None:
    async with live(teacher) as c:
        response = await c.post(
            "/api/live/voice-lab/lesson",
            json={
                "topic": "photosynthesis",
                "grade_level": "year_5",
                "students": ["Aina Binti", " Mei "],
            },
        )
    assert response.status_code == 200, response.text
    lesson = response.json()
    assert lesson["title"] == "Why leaves are green"
    assert [b["id"] for b in lesson["beats"]] == ["b1", "b2"]
    # First names only, as they will be said in the room.
    assert set(lesson["lines"]) == {"Aina", "Mei"}
    assert "Aina" in lesson["lines"]["Aina"]["call"]


async def test_an_unknown_school_level_is_refused(live, teacher) -> None:
    async with live(teacher) as c:
        response = await c.post(
            "/api/live/voice-lab/lesson", json={"topic": "rain", "grade_level": "year_99"}
        )
    assert response.status_code == 422


async def test_a_lesson_the_model_could_not_write_is_a_plain_error(live, teacher) -> None:
    async with live(teacher, lesson={"beats": []}) as c:
        response = await c.post("/api/live/voice-lab/lesson", json={"topic": "rain"})
    assert response.status_code == 502
    assert "could not be written" in response.json()["error"]["message"]


async def test_speech_comes_back_as_audio_in_the_voice_asked_for(live, teacher) -> None:
    async with live(teacher) as c:
        response = await c.post(
            "/api/live/speech", json={"text": "Water is H₂O.", "voice": "nova", "speed": 0.9}
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"nova:Water is H two O."


@pytest.mark.parametrize(
    "body",
    [
        {"text": "Hi.", "voice": "not-a-voice"},
        {"text": "Hi.", "model": "not-a-model"},
    ],
)
async def test_only_the_voices_on_offer_can_be_asked_for(live, teacher, body) -> None:
    async with live(teacher) as c:
        response = await c.post("/api/live/speech", json=body)
    assert response.status_code == 422
    assert live.voice.said == []


async def test_speech_too_long_or_too_fast_is_refused(live, teacher) -> None:
    async with live(teacher) as c:
        long = await c.post("/api/live/speech", json={"text": "a" * 901})
        fast = await c.post("/api/live/speech", json={"text": "Hi.", "speed": 3})
    assert long.status_code == fast.status_code == 422


async def test_an_answer_streams_as_sentences_over_sse(live, teacher) -> None:
    async with live(teacher) as c:
        response = await c.post(
            "/api/live/voice-lab/answer",
            json={
                "question": "Why are leaves green?",
                "student": "Aina",
                "topic": "photosynthesis",
            },
        )
    assert response.status_code == 200
    events = [
        json.loads(line[len("data:") :].strip())
        for line in response.text.splitlines()
        if line.startswith("data:")
    ]
    assert events[0] == {"type": "sentence", "text": "Leaves are green because of chlorophyll."}
    assert events[-1] == {"type": "done"}


async def test_the_model_can_be_warmed_while_a_hand_is_up(live, teacher) -> None:
    async with live(teacher) as c:
        response = await c.post("/api/live/voice-lab/warm", json={"topic": "rain"})
    assert response.status_code == 204
