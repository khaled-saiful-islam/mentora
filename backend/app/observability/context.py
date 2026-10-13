"""The trace a piece of work is in, carried in a context variable (§27).

A chat turn and a build each open one trace (`opened`); every model call made
while it runs — in that task or in the tasks it starts — lands inside it,
without being handed anything. A build's stages are steps within it
(`Steps`).

Every call into the tracer goes through `quietly`: tracing that fails is
logged and forgotten, and the turn goes on (rule 3).
"""

from __future__ import annotations

import hashlib
import logging
from collections import Counter
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.observability.base import NULL, Observation, TraceInfo, Tracer, keeps_text

logger = logging.getLogger(__name__)

@dataclass(frozen=True, slots=True)
class Scope:
    """Where a model call made now is recorded, and whether its words are.

    `tally` is shared by a trace and all its steps — what happened how often,
    for the scores a trace ends with. Mutable by design, like `Meter`.
    """

    observation: Observation
    keep_text: bool
    tally: Counter[str] = field(default_factory=Counter)


_scope: ContextVar[Scope | None] = ContextVar("mentora_trace_scope", default=None)


def current() -> Scope | None:
    return _scope.get()


def pseudonym(user_id: UUID | str | None) -> str | None:
    """The person as the trace knows them: a hash, never the id itself."""
    if user_id is None:
        return None
    return hashlib.sha256(f"mentora:{user_id}".encode()).hexdigest()[:16]


def quietly[T](what: str, call: Callable[[], T], fallback: T) -> T:
    try:
        return call()
    except Exception:  # noqa: BLE001 — tracing never fails the work it watches
        logger.warning("tracing: %s failed", what, exc_info=True)
        return fallback


@contextmanager
def opened(tracer: Tracer, info: TraceInfo) -> Iterator[Scope | None]:
    """One trace around a piece of work, or nothing when tracing is off.

    The work's own exceptions pass through untouched; the trace records that
    it failed. Leaves the scope as it found it — set back rather than reset,
    so a stream closed from another task cannot trip over its token.
    """
    if not tracer.enabled:
        yield None
        return
    with _attributes(tracer, info):
        root = quietly("trace", lambda: tracer.start(info), NULL)
        scope = Scope(root, keeps_text(tracer.content, info.kind))
        before = _scope.get()
        _scope.set(scope)
        try:
            yield scope
        except BaseException as exc:
            finish(scope, error=type(exc).__name__)
            raise
        finally:
            _scope.set(before)
            finish(scope)


@contextmanager
def _attributes(tracer: Tracer, info: TraceInfo) -> Iterator[None]:
    """Who and which session, for everything recorded inside — or nothing,
    if the tracer cannot say so."""
    try:
        manager = tracer.attributes(info)
        manager.__enter__()
    except Exception:  # noqa: BLE001 — the trace is still worth having without them
        logger.warning("tracing: attributes failed", exc_info=True)
        yield
        return
    try:
        yield
    finally:
        quietly("attributes", lambda: manager.__exit__(None, None, None), None)


def finish(
    scope: Scope | None,
    *,
    output: Any = None,
    metadata: Mapping[str, Any] | None = None,
    error: str | None = None,
) -> None:
    """Close a trace or a step; the first close is the one that counts."""
    if scope is not None:
        quietly(
            "end",
            lambda: scope.observation.end(output=output, metadata=metadata, error=error),
            None,
        )


def note(
    name: str,
    *,
    metadata: Mapping[str, Any] | None = None,
    words: Mapping[str, Any] | None = None,
    warning: bool = False,
) -> None:
    """Something worth seeing, on whatever step is running now, and counted.
    `words` — an island's text, a check's complaint — only where the trace may
    keep them; `metadata` always."""
    scope = _scope.get()
    if scope is None:
        return
    scope.tally[name] += 1
    shown = {**(metadata or {}), **(words or {})} if scope.keep_text else dict(metadata or {})
    quietly(
        "event",
        lambda: scope.observation.event(name, metadata=shown or None, warning=warning),
        None,
    )


def count(name: str, amount: int = 1) -> None:
    """Counted for the trace's scores, with nothing to show on its own."""
    scope = _scope.get()
    if scope is not None:
        scope.tally[name] += amount


def score(scope: Scope | None, name: str, value: float | str, comment: str | None = None) -> None:
    """A number or a label on the whole trace, to filter and chart by."""
    if scope is not None:
        quietly("score", lambda: scope.observation.score(name, value, comment=comment), None)


class Steps:
    """A build's stages as steps of its trace, opened and closed as the
    generator says it starts and finishes each, so the model calls a stage
    makes land inside it."""

    def __init__(self, root: Scope | None) -> None:
        self._root = root
        self._open: Scope | None = None

    def see(self, key: str, state: str, detail: str = "") -> None:
        if self._root is None:
            return
        if state == "running":
            self.close()
            root = self._root
            step = quietly("step", lambda: root.observation.span(key), NULL)
            self._open = Scope(step, root.keep_text, root.tally)
            _scope.set(self._open)
        elif self._open is not None:
            self.close(output=detail or None)

    def close(self, *, output: Any = None, error: str | None = None) -> None:
        if self._open is None:
            return
        finish(self._open, output=output, error=error)
        self._open = None
        _scope.set(self._root)
