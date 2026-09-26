"""Recorded speech, made once.

Every clip is keyed by exactly what shapes the sound — model, voice, speed and
the words — so a beat recorded for the preview is the one the whole group
hears live, and asking again costs nothing. Two requests for the same clip at
once share one recording.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path

from app.live.speakable import speakable
from app.providers.speech import SpeechProvider

logger = logging.getLogger(__name__)

MIME = "audio/mpeg"


def clip_key(*, model: str, voice: str, speed: float, text: str) -> str:
    raw = f"{model}|{voice}|{speed:.2f}|{text}".encode()
    return hashlib.sha256(raw).hexdigest()


class AudioCache:
    def __init__(self, root: str | Path) -> None:
        self._root = Path(root)

    def _path(self, key: str) -> Path:
        return self._root / key[:2] / f"{key}.mp3"

    def get(self, key: str) -> bytes | None:
        path = self._path(key)
        try:
            return path.read_bytes()
        except FileNotFoundError:
            return None
        except OSError:
            logger.warning("could not read cached clip %s", key, exc_info=True)
            return None

    def put(self, key: str, audio: bytes) -> None:
        path = self._path(key)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            partial = path.with_suffix(".part")
            partial.write_bytes(audio)
            partial.replace(path)
        except OSError:
            # A cache that cannot write is a slower cache, not a failure.
            logger.warning("could not cache clip %s", key, exc_info=True)


class Narrator:
    def __init__(self, provider: SpeechProvider, cache: AudioCache) -> None:
        self._provider = provider
        self._cache = cache
        self._recording: dict[str, asyncio.Task[bytes]] = {}

    def cached(self, key: str) -> bytes | None:
        """A clip already recorded, by its key — what a room serves."""
        return self._cache.get(key)

    async def speak(self, text: str, *, model: str, voice: str, speed: float) -> bytes:
        said = speakable(text)
        key = clip_key(model=model, voice=voice, speed=speed, text=said)
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        task = self._recording.get(key)
        if task is None:
            task = asyncio.create_task(self._record(key, said, model, voice, speed))
            self._recording[key] = task
            task.add_done_callback(lambda _: self._recording.pop(key, None))
        return await asyncio.shield(task)

    async def _record(self, key: str, said: str, model: str, voice: str, speed: float) -> bytes:
        speech = await self._provider.synthesize(said, voice=voice, speed=speed, model=model)
        self._cache.put(key, speech.audio)
        return speech.audio
