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
    # The main character, drawn in the game: "Atuk Hassan, a padi farmer".
    character: str = ""
    # Each mission's three beats and its check (§25), in the order played:
    # `{"id", "learn", "icon", "control", "guide", "goal", "win", "explanation"}`.
    missions: tuple[dict[str, Any], ...] = field(default_factory=tuple)

    def mission_lines(self) -> str:
        """The missions as the model reads them: each one's idea, the control
        it adds, what Try it asks, the Do it problem and its check."""
        return "\n".join(
            f"{n}. id={m['id']}\n   learn it: {m.get('learn', '')} {m.get('icon', '')}\n"
            f"   control it adds: {m.get('control', '')}\n"
            f"   try it (guided): {m.get('guide', '')}\n"
            f"   do it: {m['goal']}\n   reached when: {m['win']}\n"
            f"   teaches: {m['explanation']}"
            for n, m in enumerate(self.missions, start=1)
        )
