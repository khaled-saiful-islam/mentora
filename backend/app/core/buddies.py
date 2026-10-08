"""The companions a student can pick.

The characters themselves — their look, moves and voice — live in the
frontend's buddy registry. The backend only needs to know which names are real,
so a stored buddy is always one the browser can draw.
"""

from __future__ import annotations

BUDDIES: tuple[str, ...] = ("kiko", "tompok", "ollie", "momo", "rimau")


def is_buddy(name: str) -> bool:
    return name in BUDDIES


def buddy_name(key: str | None) -> str:
    """What a buddy is called, for words said aloud — "Momo". Someone without
    one (a teacher previewing) hears "your buddy"."""
    return key.capitalize() if key and is_buddy(key) else "your buddy"
