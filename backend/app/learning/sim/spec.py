"""What a simulation game is built from: the set it belongs to, already
written and checked — its missions, its story, where it is set."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class SimSpec:
    title: str
    topic: str
    # "Year 4 (about 10 years old)" — said to the model as it is.
    audience: str
    language: str
    # beginner | intermediate | advanced (`learning/pitch.py`)
    level: str
    # Where it happens, in words: a setting's note, or "a Malaysian setting".
    setting: str
    # The story, as the game's opening and ending are told by Mentora.
    hook: str = ""
    goal: str = ""
    win: str = ""
    # `{"id", "goal", "win", "explanation", "hint"}` in the order they are played.
    missions: tuple[dict[str, Any], ...] = field(default_factory=tuple)

    def mission_lines(self) -> str:
        """The missions as the model reads them: id, goal, the check in words,
        and what reaching it teaches."""
        return "\n".join(
            f"{n}. id={m['id']}\n   goal: {m['goal']}\n   reached when: {m['win']}\n"
            f"   teaches: {m['explanation']}"
            for n, m in enumerate(self.missions, start=1)
        )
