"""What "Read it to me" asks for, and the clip it gets back."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query, Response

from app.services.read_aloud import Part


@dataclass(frozen=True, slots=True)
class Spoken:
    item: str
    part: Part
    n: int | None


def _spoken(
    item: Annotated[str, Query(min_length=1, max_length=64)],
    part: Part,
    n: Annotated[int | None, Query(ge=0, le=9)] = None,
) -> Spoken:
    return Spoken(item=item, part=part, n=n)


SpokenDep = Annotated[Spoken, Depends(_spoken)]


def clip(audio: bytes, *, keep: bool) -> Response:
    """An attempt's items never change, so its clips may be kept; a set being
    previewed may have been edited a moment ago, so its clips are asked for
    again (the server's own cache still answers)."""
    cache = "private, max-age=3600" if keep else "no-store"
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": cache})
