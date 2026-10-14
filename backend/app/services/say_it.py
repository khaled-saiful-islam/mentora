"""Say It (§28.3.5): a child reads a line of a game aloud and hears which
words came through.

The clip is heard in the set's language and dropped; only the words heard
are kept, on the attempt (`plan["heard"]`), the last try of each line. The
player lights each word it matches (`features/game/rounds/say.ts`).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.providers.speech import SpeechError, Transcriber
from app.services.attempt_service import AttemptService

# A line is at most 8 words: what was heard is kept to a little more.
MOST_HEARD = 200
LANGUAGES = ("en", "ms")


async def hear(
    session: AsyncSession,
    transcriber: Transcriber,
    *,
    student_id: UUID,
    attempt_id: UUID,
    item_id: str,
    line: int,
    audio: bytes,
    mime: str,
) -> str:
    """The words heard in a child's reading of `line`, kept on the attempt."""
    loaded = await AttemptService(session).loaded(student_id, attempt_id)
    attempt = loaded.attempt
    if attempt.status != "in_progress":
        raise ValidationError("This attempt is already finished.")
    item = loaded.by_id.get(item_id)
    if item is None or item_id not in attempt.plan["order"] or item.get("play") != "say":
        raise NotFoundError("There is nothing to say there.")
    lines = _lines(item)
    if not 0 <= line < len(lines):
        raise NotFoundError("There is no such line.")
    language = loaded.learning_set.language if loaded.learning_set.language in LANGUAGES else "en"
    try:
        heard = await transcriber.transcribe(
            audio, filename="reading.wav", mime=mime, language=language
        )
    except SpeechError as exc:
        raise ValidationError(str(exc)) from exc
    heard = " ".join(heard.split())[:MOST_HEARD]
    kept = dict(attempt.plan.get("heard", {}))
    kept[item_id] = {**kept.get(item_id, {}), str(line): heard}
    attempt.plan = {**attempt.plan, "heard": kept}
    await session.flush()
    return heard


def _lines(item: dict[str, Any]) -> list[dict[str, Any]]:
    content = item.get("say") if isinstance(item.get("say"), dict) else {}
    lines = content.get("lines")
    return [line for line in lines if isinstance(line, dict)] if isinstance(lines, list) else []
