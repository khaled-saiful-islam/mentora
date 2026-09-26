"""What the tutor says to one student by name — recorded before anyone asks,
so a raised hand never meets a silence."""

from __future__ import annotations

import random
from dataclasses import dataclass

from app.live import prompts


@dataclass(frozen=True, slots=True)
class Lines:
    call: str
    thanks: str
    redirect: str
    later: str


def lines_for(name: str, *, rng: random.Random | None = None) -> Lines:
    pick = (rng or random).choice
    return Lines(
        call=pick(prompts.CALL_ON).format(name=name),
        thanks=pick(prompts.THANKS).format(name=name),
        redirect=prompts.REDIRECT.format(name=name),
        later=prompts.LATER.format(name=name),
    )
