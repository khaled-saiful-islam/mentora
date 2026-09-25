from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Event:
    """Something that happened. Frozen: subscribers read it, never edit it."""
