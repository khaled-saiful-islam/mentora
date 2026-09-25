"""The companions a student can pick.

The characters themselves — their look, moves and voice — live in the
frontend's buddy registry. The backend only needs to know which names are real,
so a stored buddy is always one the browser can draw.
"""

from __future__ import annotations

BUDDIES: tuple[str, ...] = ("kiko", "bolt", "ollie", "momo", "rimau")


def is_buddy(name: str) -> bool:
    return name in BUDDIES
