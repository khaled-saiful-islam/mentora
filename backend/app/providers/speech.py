"""The tutor's voice: text in, audio out.

`SpeechProvider` is the seam. The one implementation speaks the OpenAI
`/audio/speech` wire format over raw httpx — ILMU serves it at the same base
URL as chat. A vendor that also returns word timings is a second class here
and a branch in `build_speech`; nothing that calls it changes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

# Beyond these the voice stops sounding like a person: slurred below, a
# chipmunk above.
MIN_SPEED = 0.6
MAX_SPEED = 1.3


@dataclass(frozen=True, slots=True)
class Speech:
    audio: bytes
    mime: str


class SpeechError(RuntimeError):
    """The voice could not be made — said plainly, never the upstream body."""


class SpeechProvider(Protocol):
    async def synthesize(
        self, text: str, *, voice: str, speed: float, model: str | None = None
    ) -> Speech: ...


class OpenAICompatibleSpeech:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._url = f"{base_url.rstrip('/')}/audio/speech"
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._transport = transport

    async def synthesize(
        self, text: str, *, voice: str, speed: float, model: str | None = None
    ) -> Speech:
        body = {
            "model": model or self._model,
            "input": text,
            "voice": voice,
            "speed": min(MAX_SPEED, max(MIN_SPEED, speed)),
            "response_format": "mp3",
        }
        headers = {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout, transport=self._transport
            ) as client:
                response = await client.post(self._url, json=body, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("speech request failed: %s", exc)
            raise SpeechError("The voice could not be reached.") from exc
        if response.status_code != 200:
            logger.warning("speech returned %s: %s", response.status_code, response.text[:200])
            raise SpeechError("The voice could not say that.")
        mime = response.headers.get("content-type", "audio/mpeg").split(";")[0].strip()
        if not mime.startswith("audio/") or not response.content:
            raise SpeechError("The voice sent back something that is not audio.")
        return Speech(audio=response.content, mime=mime)


def build_speech(settings: Settings) -> SpeechProvider:
    return OpenAICompatibleSpeech(
        base_url=settings.resolved_speech_base_url,
        api_key=settings.resolved_speech_api_key,
        model=settings.speech_model,
        timeout=settings.speech_timeout_seconds,
    )
