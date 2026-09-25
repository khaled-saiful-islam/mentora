"""A finishing stage some kinds have after their items are written.

Most kinds are done once their items pass the checks. A study guide is not:
it wants a picture for every section and a beginning and an end — a big
question to open on, a summary to close with. A kind that has such a stage
says so by shape (`isinstance(kind, Enriching)`), never by name, which is the
same rule the chat uses for tools.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from app.core.grades import Grade
from app.learning.base import Item
from app.learning.model import JsonModel
from app.learning.research import Picture, Source


class Pictures(Protocol):
    """Somewhere to look for pictures. Empty — never an error — when it can't."""

    async def pictures(self, query: str, *, limit: int) -> list[Picture]: ...


@dataclass(frozen=True, slots=True)
class Finishing:
    """What a kind's finishing stage is told about the set it is finishing."""

    title: str
    topic: str
    grade: Grade | None
    language: str
    items: tuple[Item, ...]
    sources: tuple[Source, ...]


@runtime_checkable
class Enriching(Protocol):
    async def illustrate(self, items: list[Item], *, topic: str, pictures: Pictures) -> list[Item]:
        """The items with pictures added where they were missing. Items a
        search found nothing for are returned as they were."""
        ...

    async def wrap(self, model: JsonModel, finishing: Finishing) -> dict[str, Any]:
        """What the set has besides its items — its opening and its ending.
        Clean, via `normalise_extras`; empty when the model had nothing."""
        ...

    def normalise_extras(self, raw: Any) -> dict[str, Any]:
        """Clean extras from a model or an editor. Never raises."""
        ...
