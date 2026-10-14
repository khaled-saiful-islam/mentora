"""A game told aloud from its first second (§28.3.2).

Every line its narrator says is recorded once, as soon as the game is made,
in the background — so the first child to press "Start the mission" hears
it at once instead of waiting on each clip, and every child after hears the
same recording. A line that names the buddy is recorded once for each
buddy, and once for "your buddy", as a preview says it.

Only for languages the tutor's voice reads. Never part of the build: a
failure is logged and the game is just as playable, recorded as it is heard.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.buddies import BUDDIES, buddy_name
from app.core.config import Settings
from app.db.models.learning import LearningSet
from app.live.audio import Narrator
from app.providers.speech import SpeechError
from app.services.learning_set_service import LearningSetService
from app.services.read_aloud import BUDDY, game_narration, voice_for

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]

# A game of six islands says about forty lines; this is well past that, and a
# ceiling on what one build can spend on speech.
MOST_CLIPS = 120

# Recordings still being made, held so none is collected mid-way.
_running: set[asyncio.Task[int]] = set()


def every_voicing(texts: list[str]) -> list[str]:
    """Each line as it can be said: once, or once per buddy where it names one."""
    names = [buddy_name(key) for key in BUDDIES] + [buddy_name(None)]
    said: list[str] = []
    for text in texts:
        said += [text.replace(BUDDY, name) for name in names] if BUDDY in text else [text]
    return list(dict.fromkeys(said))


async def record_game(
    set_id: UUID, *, session_maker: SessionMaker, narrator: Narrator, settings: Settings
) -> int:
    """Records a game's narration; returns how many lines were recorded."""
    async with session_maker() as session:
        learning_set = await session.get(LearningSet, set_id)
        if learning_set is None or learning_set.kind != "game":
            return 0
        if learning_set.language not in settings.read_aloud_language_list:
            return 0
        version = await LearningSetService(session).version(learning_set)
        extras: dict[str, Any] = dict(version.extras or {}) if version else {}
        items: list[dict[str, Any]] = list(version.items) if version else []
    recorded = 0
    voice, speed = voice_for(settings, game=True)
    lines = game_narration(extras, items, learning_set.language or "en")
    for text in every_voicing(lines)[:MOST_CLIPS]:
        try:
            await narrator.speak(text, model=settings.speech_model, voice=voice, speed=speed)
        except SpeechError:
            # The voice is down: the rest is recorded when it is first heard.
            logger.warning("narration for game %s stopped after %d lines", set_id, recorded)
            break
        recorded += 1
    logger.info("narration for game %s: %d lines recorded", set_id, recorded)
    return recorded


def record_in_background(
    set_id: UUID, *, session_maker: SessionMaker, narrator: Narrator, settings: Settings
) -> None:
    """Starts recording and returns at once; the build is already done."""
    task = asyncio.create_task(
        record_game(set_id, session_maker=session_maker, narrator=narrator, settings=settings)
    )
    _running.add(task)
    task.add_done_callback(_finished)


def _finished(task: asyncio.Task[int]) -> None:
    _running.discard(task)
    if not task.cancelled() and task.exception() is not None:
        logger.warning("recording a game's narration failed", exc_info=task.exception())
