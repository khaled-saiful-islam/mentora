"""A lesson laid out in the order it is said — the conductor walks this list.

Every sentence of every beat is one step, with the silence after it; a part
with a quick check gets a check step after its last sentence. A step's index
is the lesson's position, saved as it moves, so a restart carries on from the
sentence it reached. Pure: no time, no I/O.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from app.live.beats import PAUSES, SENTENCE_GAP

QUESTION_GAP = 0.8


@dataclass(frozen=True, slots=True)
class Step:
    index: int
    kind: str  # "say" or "check"
    segment_id: str
    segment: int
    text: str = ""
    # Seconds of quiet after this step.
    pause: float = 0.0
    beat_id: str = ""
    show: str | None = None
    checkin: dict[str, Any] | None = None
    # The last sentence of its part: where "questions at pauses" are taken.
    part_end: bool = False


def steps_of(segments: list[dict[str, Any]]) -> list[Step]:
    """`segments` as stored: id, position, beats [{id, say, show, pause, sentences}], checkin."""
    steps: list[Step] = []
    for number, segment in enumerate(segments):
        beats = segment.get("beats") or []
        for b, beat in enumerate(beats):
            parts = beat.get("sentences") or [beat.get("say", "")]
            parts = [p for p in parts if p and p.strip()]
            for s, sentence in enumerate(parts):
                last_in_beat = s == len(parts) - 1
                steps.append(
                    Step(
                        index=len(steps),
                        kind="say",
                        segment_id=str(segment["id"]),
                        segment=number,
                        text=sentence,
                        pause=_pause(beat, sentence, last_in_beat),
                        beat_id=str(beat.get("id", "")),
                        show=beat.get("show"),
                        part_end=last_in_beat and b == len(beats) - 1,
                    )
                )
        if segment.get("checkin"):
            steps.append(
                Step(
                    index=len(steps),
                    kind="check",
                    segment_id=str(segment["id"]),
                    segment=number,
                    checkin=segment["checkin"],
                    part_end=True,
                )
            )
    return steps


def reveal_line(checkin: dict[str, Any]) -> str:
    """What Astra says when a quick check closes."""
    options = checkin.get("options") or []
    answer = checkin.get("answer", 0)
    right = options[answer] if 0 <= answer < len(options) else ""
    explanation = (checkin.get("explanation") or "").strip()
    return f"The answer is: {right}. {explanation}".strip()


def _pause(beat: dict[str, Any], sentence: str, last: bool) -> float:
    if last:
        return PAUSES.get(str(beat.get("pause") or "breath"), PAUSES["breath"])
    return QUESTION_GAP if re.search(r"\?[\"')]*$", sentence.strip()) else SENTENCE_GAP


# --- reminders -------------------------------------------------------------------

REMINDERS: tuple[tuple[str, timedelta, timedelta], ...] = (
    # name, from (before the start), until (before the start)
    ("day", timedelta(hours=24), timedelta(hours=2)),
    ("soon", timedelta(minutes=15), timedelta(minutes=1)),
    ("now", timedelta(0), timedelta(minutes=-5)),
)
# The room opens this long before the start.
LOBBY_OPENS = timedelta(minutes=10)


def due_reminders(scheduled_at: datetime, now: datetime, sent: list[str]) -> list[str]:
    """Which reminders are due now and not yet sent. A reminder whose window
    has passed is never sent late — a "tomorrow" note an hour before is noise."""
    return [
        name
        for name, opens, closes in REMINDERS
        if name not in sent and scheduled_at - opens <= now <= scheduled_at - closes
    ]


def already_told(scheduled_at: datetime, now: datetime) -> list[str]:
    """Reminders a new schedule makes pointless: put on the schedule inside
    the day, the "tomorrow" note would only repeat what was just said."""
    return ["day"] if scheduled_at - now < timedelta(hours=25) else []


def lobby_open(scheduled_at: datetime, now: datetime) -> bool:
    return now >= scheduled_at - LOBBY_OPENS
