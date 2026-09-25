"""A lesson as the tutor breathes it: beats.

A beat is two to four sentences — one breath group, one small idea — recorded
as a single clip so its intonation runs on like a person's instead of
resetting every full stop. Between beats sits a pause the script chose: a
short one mid-thought, a breath between ideas, a longer think after a question
put to the room. Silence is part of teaching; here it is written down.

The model is asked for beats, but a beat that came back as a paragraph is cut
here, and every beat's words go through `speakable` first.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.live.speakable import speakable

# Seconds of silence after a beat, by name.
PAUSES: dict[str, float] = {"short": 0.3, "breath": 0.6, "think": 1.5}
DEFAULT_PAUSE = "breath"

MAX_SENTENCES = 4
MAX_WORDS = 60
# A teacher talking to a class, which is what `speech_speed` is tuned to.
WORDS_PER_MINUTE = 150

# A sentence ends at . ! ? or … followed by a space and something that starts
# a sentence. "Mr. Tan" and "3.5" do not end one.
_SENTENCE_END = re.compile(r"(?<=[.!?…])[\"')\]]*\s+(?=[\"'(\[]?[A-Z0-9])")
# The sentence that answers a question put to the room.
_REVEAL = re.compile(
    r"(?:If you (?:said|guessed|thought|picked|chose|went with)|Did you (?:say|guess))\b"
)
_NOT_AN_END = re.compile(r"\b(?:Mr|Mrs|Ms|Dr|St|No|vs)\.$")


@dataclass(frozen=True, slots=True)
class Beat:
    id: str
    say: str
    # What is on the screen while it is said — never read out.
    show: str | None
    pause: str

    @property
    def words(self) -> int:
        return len(self.say.split())

    def as_dict(self) -> dict[str, Any]:
        return {"id": self.id, "say": self.say, "show": self.show, "pause": self.pause}


def sentences(text: str) -> list[str]:
    parts = _SENTENCE_END.split(text.strip())
    out: list[str] = []
    for part in (p.strip() for p in parts):
        if not part:
            continue
        if out and _NOT_AN_END.search(out[-1]):
            out[-1] = f"{out[-1]} {part}"
        else:
            out.append(part)
    return out


def beats_from(raw: list[Any], *, prefix: str = "b") -> list[Beat]:
    """Beats from what the model wrote, cut to size and made sayable."""
    beats: list[Beat] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        say = speakable(str(entry.get("say") or ""))
        if not say:
            continue
        show = _show(entry.get("show"))
        pause = str(entry.get("pause") or "").strip().lower()
        chunks = _chunks(sentences(say))
        for index, (chunk, waits) in enumerate(chunks):
            last = index == len(chunks) - 1
            chosen = pause if pause in PAUSES else _pause_for(chunk)
            beats.append(
                Beat(
                    id=f"{prefix}{len(beats) + 1}",
                    say=chunk,
                    show=show,
                    pause="think" if waits else chosen if last else "short",
                )
            )
    return beats


def spoken_seconds(beats: list[Beat]) -> float:
    words = sum(beat.words for beat in beats)
    return words / WORDS_PER_MINUTE * 60 + sum(PAUSES[beat.pause] for beat in beats)


def _chunks(parts: list[str]) -> list[tuple[str, bool]]:
    """Sentences grouped into beats, each with whether the room is given time
    to think after it. A question followed by "If you said…" is cut in two, so
    the pause falls between asking and answering, not after both."""
    chunks: list[list[str]] = [[]]
    waits: list[bool] = [False]
    for sentence in parts:
        current = chunks[-1]
        words = sum(len(s.split()) for s in current) + len(sentence.split())
        reveal = bool(current) and current[-1].endswith("?") and bool(_REVEAL.match(sentence))
        if current and (reveal or len(current) >= MAX_SENTENCES or words > MAX_WORDS):
            waits[-1] = reveal
            chunks.append([sentence])
            waits.append(False)
        else:
            current.append(sentence)
    return [(" ".join(c), w) for c, w in zip(chunks, waits, strict=True) if c]


def _pause_for(chunk: str) -> str:
    # A beat that ends by asking the room something waits for the room.
    return "think" if chunk.rstrip("\"')").endswith("?") else DEFAULT_PAUSE


def _show(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned[:240] or None
