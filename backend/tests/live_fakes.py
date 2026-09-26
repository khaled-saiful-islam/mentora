"""Scripted answers for the lesson planner, by stage — the planner's fakes."""

from __future__ import annotations

import re
from typing import Any

from app.live.settings import SessionSettings

SETTINGS = {
    "subject": "Science",
    "topic": "photosynthesis",
    "grade_level": "year_5",
    "breakdown": ["What plants need", "Inside a leaf"],
    "difficulty": "beginner",
    "approach": "storytelling",
    "duration_minutes": 10,
}


def settings(**overrides: Any) -> SessionSettings:
    return SessionSettings.model_validate({**SETTINGS, **overrides})


def segment(part: str, n: int, *, checkin: bool) -> dict[str, Any]:
    return {
        "title": f"{part} {n}",
        "key_points": [f"{part} matters"],
        "beats": [
            {"say": f"Let's imagine a little mango tree. Today we learn about {part.lower()}."},
            {"say": "So, here's the thing. The tree is busy in the sunshine.", "show": "Busy tree"},
            {"say": "What do you think it needs?", "pause": "think"},
            {"say": "If you thought of water, you're right. It drinks through its roots."},
        ],
        "checkin": (
            {
                "question": f"What does a plant need for {part.lower()}?",
                "options": ["Sunlight", "Sand", "Salt", "Smoke"],
                "answer": 0,
                "explanation": "Plants use sunlight to make food.",
            }
            if checkin
            else None
        ),
    }


def part_answer(system: str, user: str) -> dict[str, Any]:
    """Writes as many segments as asked for, for whichever part is asked for."""
    part = re.search(r'THIS PART \(\d+ of \d+\): "([^"]+)"', user).group(1)
    count = int(re.search(r"Write it as (\d+) segment", user).group(1))
    return {"segments": [segment(part, n, checkin=n == count - 1) for n in range(count)]}


def answers(**overrides: Any) -> dict[str, Any]:
    return {
        "live.check": {"ok": True},
        "live.queries": {"queries": ["photosynthesis for kids"]},
        "live.part": part_answer,
        "live.verify": {"problems": []},
        "live.repair": part_answer,
        "live.breakdown": {"parts": ["What plants need", "Inside a leaf", "Making food"]},
        "live.rewrite": {"segments": [segment("Rewritten", 0, checkin=False)]},
        **overrides,
    }
