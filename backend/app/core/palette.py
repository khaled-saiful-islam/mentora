"""Colour keys a class or a group may wear. The frontend maps each to tokens."""

from __future__ import annotations

THEMES: tuple[str, ...] = ("grape", "sun", "mint", "coral", "sky", "tangerine", "lagoon", "orchid")


def is_theme(key: str) -> bool:
    return key in THEMES
