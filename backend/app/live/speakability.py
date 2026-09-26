"""Would a real teacher say this? The checks that decide.

Each problem is a sentence the model can act on, because the list goes back to
it as the repair brief. They are the ways a script gives itself away as
written rather than spoken: a sentence too long for one breath, symbols the
voice cannot say, the stiff phrases of an essay, a lesson much longer or
shorter than the time it was given.
"""

from __future__ import annotations

import re
from collections.abc import Sequence

from app.live.beats import Beat, sentences, spoken_seconds

MAX_SENTENCE_WORDS = 28
# How far off the target time a segment may run before it is rewritten.
PACE_TOLERANCE = 0.3

_UNSAYABLE = re.compile(r"[=<>^\\|#*_~{}\[\]]|\d+/\d+")
# How a beat starts when it answers a question nobody could say aloud.
_AS_IF_ANSWERED = re.compile(
    r"^(?:exactly|yes|yep|correct|that's right|that is right|right you are|spot on)\b[!,. ]",
    re.I,
)
_STIFF = (
    "settle down",
    "alright, class",
    "in this lesson, we will",
    "in this segment",
    "in conclusion",
    "as an ai",
    "delve",
    "it is important to note",
    "furthermore",
    "moreover",
    "in summary",
    "let us explore",
)


def problems(
    beats: list[Beat], *, target_seconds: float | None = None, students: Sequence[str] = ()
) -> list[str]:
    found: list[str] = []
    after_question = False
    for beat in beats:
        found += _heard_nobody(beat, after_question, students)
        after_question = beat.pause == "think"
        for sentence in sentences(beat.say):
            if len(sentence.split()) > MAX_SENTENCE_WORDS:
                found.append(f"Too long to say in one breath — split it: “{_clip(sentence)}”")
        if _UNSAYABLE.search(beat.say):
            found.append(
                f"Has symbols a voice cannot say — write them as words: “{_clip(beat.say)}”"
            )
        if beat.say.count("!") > 1:
            found.append(
                f"Too excited for a calm storyteller — keep it gentle, one “!” at most: "
                f"“{_clip(beat.say, 60)}”"
            )
        lowered = beat.say.lower()
        for phrase in _STIFF:
            if phrase in lowered:
                found.append(
                    f"“{phrase}” sounds read, not spoken — say it the way you would to the class"
                )
    if target_seconds:
        seconds = spoken_seconds(beats)
        if seconds > target_seconds * (1 + PACE_TOLERANCE):
            found.append(
                f"Runs about {round(seconds)} s for a {round(target_seconds)} s part — cut it down"
            )
        elif seconds < target_seconds * (1 - PACE_TOLERANCE):
            found.append(
                f"Runs about {round(seconds)} s for a {round(target_seconds)} s part — say more"
            )
    return found


def _heard_nobody(beat: Beat, after_question: bool, students: Sequence[str]) -> list[str]:
    """Students cannot answer out loud, so a script must not talk as if they had."""
    found: list[str] = []
    if after_question and _AS_IF_ANSWERED.match(beat.say):
        found.append(
            f"Nobody answered out loud — don't react as if you heard them; say “If you said…”: "
            f"“{_clip(beat.say, 60)}”"
        )
    for sentence in sentences(beat.say):
        if sentence.endswith("?") and any(_names(name, sentence) for name in students):
            found.append(
                f"Asks one student by name, who cannot answer — ask the whole room: "
                f"“{_clip(sentence, 60)}”"
            )
    return found


def _names(name: str, sentence: str) -> bool:
    return re.search(rf"\b{re.escape(name)}\b", sentence) is not None


def _clip(text: str, limit: int = 90) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
