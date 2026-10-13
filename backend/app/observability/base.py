"""What a tracer is, in Mentora's words (§27).

Nothing here names a vendor: Langfuse is one implementation
(`langfuse_tracer.py`), and the null one below is what runs when there are no
keys. A tracer records; it never decides anything, and a failure inside one
must never reach a turn — `context.py` keeps that promise for every caller.
"""

from __future__ import annotations

from collections.abc import Mapping
from contextlib import AbstractContextManager, nullcontext
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol


class Content(StrEnum):
    """Whose words a trace may carry (`LANGFUSE_CONTENT`)."""

    BUILDS = "builds"  # quizzes, guides and games: curriculum text
    ALL = "all"
    NONE = "none"


class Kind(StrEnum):
    """What a trace is of, which decides whether its words are kept."""

    BUILD = "build"
    CHAT = "chat"
    OTHER = "other"


def keeps_text(content: Content, kind: Kind) -> bool:
    return content is Content.ALL or (content is Content.BUILDS and kind is Kind.BUILD)


@dataclass(frozen=True, slots=True)
class TraceInfo:
    name: str
    kind: Kind
    # A pseudonym, never the id itself (`context.pseudonym`).
    user: str | None = None
    session: str | None = None
    tags: tuple[str, ...] = ()
    metadata: Mapping[str, Any] = field(default_factory=dict)
    # What was asked for, shown as the trace's input — only where its words
    # may be kept (`keeps_text`); the caller decides.
    input: Any = None


class Observation(Protocol):
    """A trace, a step inside one, or one model call. Ended once: the first
    `end` is the one that counts, and later ones are ignored."""

    def span(self, name: str, *, metadata: Mapping[str, Any] | None = None) -> Observation: ...

    def generation(
        self, name: str, *, model: str, input: Any, parameters: Mapping[str, Any]
    ) -> Observation: ...

    def event(
        self, name: str, *, metadata: Mapping[str, Any] | None = None, warning: bool = False
    ) -> None: ...

    def score(self, name: str, value: float | str, *, comment: str | None = None) -> None:
        """Scores the whole trace this observation is in."""
        ...

    def end(
        self,
        *,
        output: Any = None,
        metadata: Mapping[str, Any] | None = None,
        usage: tuple[int, int] | None = None,
        cost: tuple[float, float] | None = None,
        error: str | None = None,
    ) -> None: ...


class Tracer(Protocol):
    enabled: bool
    content: Content

    def attributes(self, info: TraceInfo) -> AbstractContextManager[Any]:
        """Who, which session and what kind, for everything started inside."""
        ...

    def start(self, info: TraceInfo) -> Observation:
        """A new trace's root. Its steps hang from it; nothing becomes current."""
        ...

    def shutdown(self) -> None:
        """Send what is still queued, on the way down."""
        ...


class NullObservation:
    """Records nothing, so callers never ask whether tracing is on."""

    def span(self, name: str, *, metadata: Mapping[str, Any] | None = None) -> Observation:
        return self

    def generation(
        self, name: str, *, model: str, input: Any, parameters: Mapping[str, Any]
    ) -> Observation:
        return self

    def event(
        self, name: str, *, metadata: Mapping[str, Any] | None = None, warning: bool = False
    ) -> None:
        return None

    def score(self, name: str, value: float | str, *, comment: str | None = None) -> None:
        return None

    def end(
        self,
        *,
        output: Any = None,
        metadata: Mapping[str, Any] | None = None,
        usage: tuple[int, int] | None = None,
        cost: tuple[float, float] | None = None,
        error: str | None = None,
    ) -> None:
        return None


NULL = NullObservation()


class NullTracer:
    enabled = False
    content = Content.NONE

    def attributes(self, info: TraceInfo) -> AbstractContextManager[Any]:
        return nullcontext()

    def start(self, info: TraceInfo) -> Observation:
        return NULL

    def shutdown(self) -> None:
        return None
