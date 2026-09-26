"""The tutor's voice: the speech adapter, the clip cache and the voice lab."""

from __future__ import annotations

import asyncio
import json
import random
from pathlib import Path

import httpx
import pytest

from app.learning.model import Meter
from app.live.audio import AudioCache, Narrator, clip_key
from app.live.voice_lab import LessonUnavailable, VoiceLab, is_praise, lines_for
from app.moderation.gate import ModerationGate
from app.providers.speech import OpenAICompatibleSpeech, Speech, SpeechError
from tests.learning_fakes import FakeModel
from tests.test_chat_service import FakeProvider

GOOD_LESSON = {
    "title": "Why leaves are green",
    "beats": [
        {"say": "Okay, everyone. Have you ever wondered why leaves are green?", "show": None},
        {
            "say": "Here's the thing. That green is a clue. The leaf is busy making food.",
            "show": "Green means chlorophyll",
            "pause": "breath",
        },
    ],
    "recap": "So the next time you see a leaf, you'll know it's cooking.",
}


class FakeSpeech:
    def __init__(self, delay: float = 0.0) -> None:
        self.said: list[str] = []
        self._delay = delay

    async def synthesize(self, text, *, voice, speed, model=None):
        self.said.append(text)
        await asyncio.sleep(self._delay)
        return Speech(audio=f"{voice}:{text}".encode(), mime="audio/mpeg")


# --- the speech adapter -----------------------------------------------------


def _speech(handler) -> OpenAICompatibleSpeech:
    return OpenAICompatibleSpeech(
        base_url="https://voice.test/v1/",
        api_key="k",
        model="tts-model",
        timeout=5,
        transport=httpx.MockTransport(handler),
    )


async def test_speech_is_asked_for_in_the_openai_shape_with_the_speed_kept_sane() -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=b"ID3...", headers={"content-type": "audio/mpeg"})

    speech = await _speech(handler).synthesize("Hello, class.", voice="voice_1", speed=9)
    assert speech.audio == b"ID3..."
    assert seen["url"] == "https://voice.test/v1/audio/speech"
    assert seen["auth"] == "Bearer k"
    assert seen["body"] == {
        "model": "tts-model",
        "input": "Hello, class.",
        "voice": "voice_1",
        "speed": 1.2,
        "response_format": "mp3",
    }


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(400, json={"error": "bad voice"}),
        httpx.Response(200, content=b"{}", headers={"content-type": "application/json"}),
        httpx.Response(200, content=b"", headers={"content-type": "audio/mpeg"}),
    ],
)
async def test_a_failed_or_odd_reply_is_a_plain_speech_error(response: httpx.Response) -> None:
    with pytest.raises(SpeechError):
        await _speech(lambda _: response).synthesize("Hi.", voice="fable", speed=1)


async def test_an_unreachable_voice_is_a_plain_speech_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(SpeechError, match="could not be reached"):
        await _speech(handler).synthesize("Hi.", voice="fable", speed=1)


# --- the clip cache ---------------------------------------------------------


async def test_a_clip_is_recorded_once_and_then_served_from_the_cache(tmp_path: Path) -> None:
    voice = FakeSpeech()
    narrator = Narrator(voice, AudioCache(tmp_path))
    first = await narrator.speak("Water is H₂O.", model="m", voice="fable", speed=0.85)
    again = await narrator.speak("Water is H₂O.", model="m", voice="fable", speed=0.85)
    assert first == again == b"fable:Water is H two O."
    # What was recorded is the sayable text, once.
    assert voice.said == ["Water is H two O."]


async def test_the_same_clip_asked_for_twice_at_once_is_recorded_once(tmp_path: Path) -> None:
    voice = FakeSpeech(delay=0.05)
    narrator = Narrator(voice, AudioCache(tmp_path))
    clips = await asyncio.gather(
        *(narrator.speak("Hello.", model="m", voice="nova", speed=1) for _ in range(3))
    )
    assert len(set(clips)) == 1
    assert voice.said == ["Hello."]


async def test_a_different_voice_or_speed_is_a_different_clip(tmp_path: Path) -> None:
    voice = FakeSpeech()
    narrator = Narrator(voice, AudioCache(tmp_path))
    await narrator.speak("Hello.", model="m", voice="nova", speed=1)
    await narrator.speak("Hello.", model="m", voice="fable", speed=1)
    await narrator.speak("Hello.", model="m", voice="fable", speed=0.85)
    assert len(voice.said) == 3
    assert clip_key(model="m", voice="a", speed=1, text="x") != clip_key(
        model="m", voice="a", speed=0.9, text="x"
    )


def test_a_cache_that_cannot_write_still_answers(tmp_path: Path) -> None:
    blocked = tmp_path / "file"
    blocked.write_text("not a directory")
    cache = AudioCache(blocked)
    cache.put("ab" + "0" * 62, b"audio")  # logged, not raised
    assert cache.get("ab" + "0" * 62) is None


# --- the lab ----------------------------------------------------------------


def _lab(answers: dict, chunks: list[str] | None = None, fail: str | None = None) -> VoiceLab:
    return VoiceLab(
        FakeModel(answers, Meter()),
        FakeProvider(chunks or [], fail=fail),
        ModerationGate(),
    )


async def test_the_lab_writes_a_lesson_as_spoken_beats() -> None:
    lesson = await _lab({"live.lesson": GOOD_LESSON}).lesson("photosynthesis", None, ["Aina"])
    assert lesson.title == "Why leaves are green"
    assert [b.pause for b in lesson.beats] == ["think", "breath"]
    assert lesson.beats[1].show == "Green means chlorophyll"
    assert lesson.seconds > 0


async def test_a_lesson_that_sounds_written_is_sent_back_once_to_be_rewritten() -> None:
    stiff = {"title": "Leaves", "beats": [{"say": "Furthermore, leaves are green."}]}
    model_answers = {"live.lesson": stiff, "live.repair": GOOD_LESSON}
    lab = _lab(model_answers)
    lesson = await lab.lesson("photosynthesis", None, [])
    assert lesson.title == "Why leaves are green"
    assert lab._model.asked == ["live.lesson", "live.repair"]  # noqa: SLF001


async def test_a_lesson_with_nothing_to_say_is_refused_plainly() -> None:
    with pytest.raises(LessonUnavailable):
        await _lab({"live.lesson": {"title": "x", "beats": []}}).lesson("rain", None, [])


async def _answer(lab: VoiceLab, question: str) -> list[dict]:
    return [
        event
        async for event in lab.answer(
            question=question, student="Aina", topic="photosynthesis", grade=None, taught=[]
        )
    ]


async def test_an_answer_streams_as_whole_sayable_sentences_then_done() -> None:
    chunks = [
        "Chlorophyll is the green ",
        "stuff in leaves. It turns CO2 into ",
        "food. Okay — back to it.",
    ]
    events = await _answer(_lab({}, chunks), "Why are leaves green?")
    assert [e["type"] for e in events] == ["sentence", "sentence", "sentence", "done"]
    assert events[1]["text"] == "It turns C O two into food."


async def test_a_question_that_cannot_be_answered_in_the_room_is_redirected_kindly() -> None:
    events = await _answer(_lab({}, ["Never said."]), "how do I kill myself")
    assert [e["type"] for e in events] == ["redirect", "done"]
    assert "another time" in events[0]["text"]
    assert "kill" not in events[0]["text"]


async def test_a_model_failure_mid_answer_ends_on_a_bridge_not_silence() -> None:
    events = await _answer(_lab({}, fail="down"), "Why are leaves green?")
    assert events[-2]["text"].startswith("So, let's go back")
    assert events[-1] == {"type": "done"}


def test_each_student_gets_their_own_lines_by_first_name() -> None:
    said = lines_for("Aina", rng=random.Random(1))  # noqa: S311 — a greeting, not a secret
    assert "Aina" in said.call and "Aina" in said.thanks and "Aina" in said.redirect


async def test_an_opening_compliment_is_dropped_because_the_student_was_already_thanked() -> None:
    chunks = [
        "That's a brilliant question, Aina. ",
        "Plants have no mouths, so they cook with light. ",
    ]
    events = await _answer(_lab({}, chunks), "Why don't plants eat?")
    assert events[0]["text"] == "Plants have no mouths, so they cook with light."


def test_praise_is_told_apart_from_an_answer_that_happens_to_be_nice() -> None:
    assert is_praise("What a great question!")
    assert is_praise("Ooh, I love that you're thinking about that, Aina.")
    assert is_praise("That's a really interesting thought.")
    assert not is_praise("Plants are amazing little chefs.")
    assert not is_praise("A good way to picture it is a solar panel on your roof, catching light.")


async def test_warming_the_model_streams_the_answer_prompt_for_one_token() -> None:
    chat = FakeProvider(["Sure"])
    lab = VoiceLab(FakeModel({}, Meter()), chat, ModerationGate())
    await lab.warm(topic="rain", grade=None, taught=["Clouds are made of tiny drops."])
    [request] = chat.requests
    assert request.max_tokens == 1 and request.stream
    assert "Clouds are made of tiny drops." in request.messages[0].content


async def test_a_model_that_cannot_be_warmed_is_not_an_error() -> None:
    lab = VoiceLab(FakeModel({}, Meter()), FakeProvider([], fail="down"), ModerationGate())
    await lab.warm(topic="rain", grade=None, taught=[])  # logged, not raised


async def test_speech_to_text_sends_the_clip_in_the_openai_shape_and_tidies_the_words() -> None:
    from app.providers.speech import OpenAICompatibleTranscriber

    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = request.content
        return httpx.Response(200, json={"text": "  why do leaves   fall  "})

    ears = OpenAICompatibleTranscriber(
        base_url="https://voice.test/v1",
        api_key="k",
        model="asr",
        timeout=5,
        transport=httpx.MockTransport(handler),
    )
    text = await ears.transcribe(b"RIFFdata", filename="q.wav", mime="audio/wav")
    assert text == "why do leaves fall"
    assert seen["url"] == "https://voice.test/v1/audio/transcriptions"
    assert (
        b'name="model"' in seen["body"] and b"asr" in seen["body"] and b"RIFFdata" in seen["body"]
    )


async def test_speech_to_text_that_fails_says_so_plainly() -> None:
    from app.providers.speech import OpenAICompatibleTranscriber

    ears = OpenAICompatibleTranscriber(
        base_url="https://voice.test/v1",
        api_key="k",
        model="asr",
        timeout=5,
        transport=httpx.MockTransport(lambda _: httpx.Response(500)),
    )
    with pytest.raises(SpeechError, match="couldn't be heard"):
        await ears.transcribe(b"x", filename="q.wav", mime="audio/wav")
