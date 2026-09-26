"""Speaking instead of typing: a clip in, tidy words out, the clip dropped."""

from __future__ import annotations

from app.api.deps import get_transcriber
from app.providers.speech import SpeechError


class Ears:
    def __init__(self, text: str = "  why is the  sky blue  ", fail: bool = False) -> None:
        self.text, self.fail, self.heard = text, fail, 0

    async def transcribe(self, audio, *, filename, mime):
        self.heard += 1
        if self.fail:
            raise SpeechError("That couldn't be heard. Try again, or type it.")
        return self.text


def _client(client, user, ears):
    c = client(user)
    c._transport.app.dependency_overrides[get_transcriber] = lambda: ears  # noqa: SLF001
    return c


async def test_a_clip_comes_back_as_tidy_words(client, student) -> None:
    ears = Ears()
    async with _client(client, student, ears) as c:
        heard = await c.post(
            "/api/voice/transcribe", files={"clip": ("s.wav", b"RIFF..", "audio/wav")}
        )
    assert heard.status_code == 200
    assert heard.json() == {"text": "why is the sky blue"}


async def test_empty_long_and_unheard_clips_are_refused_plainly(client, student) -> None:
    async with _client(client, student, Ears()) as c:
        empty = await c.post("/api/voice/transcribe", files={"clip": ("s.wav", b"", "audio/wav")})
        long = await c.post(
            "/api/voice/transcribe", files={"clip": ("s.wav", b"x" * 1_300_000, "audio/wav")}
        )
    async with _client(client, student, Ears(fail=True)) as c:
        unheard = await c.post(
            "/api/voice/transcribe", files={"clip": ("s.wav", b"RIFF", "audio/wav")}
        )
    async with _client(client, student, Ears(text=" . ")) as c:
        blank = await c.post(
            "/api/voice/transcribe", files={"clip": ("s.wav", b"RIFF", "audio/wav")}
        )
    assert empty.status_code == long.status_code == unheard.status_code == blank.status_code == 422
    assert "half a minute" in long.json()["error"]["message"]


async def test_signed_out_people_cannot_use_it(client) -> None:
    async with client() as c:
        assert (
            await c.post("/api/voice/transcribe", files={"clip": ("s.wav", b"RIFF", "audio/wav")})
        ).status_code == 401
