"""Langfuse as Mentora's tracer (§27) — the one module that imports it.

The SDK sends from a background thread, so recording costs a turn almost
nothing; and every method here fails quietly, so a Langfuse that is down or
misconfigured costs a turn nothing at all.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from contextlib import AbstractContextManager, nullcontext
from functools import wraps
from typing import Any, ParamSpec, TypeVar

from langfuse import Langfuse, propagate_attributes

from app.observability.base import NULL, Content, Observation, TraceInfo

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


def _quiet(fallback: Any) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorate(method: Callable[P, R]) -> Callable[P, R]:
        @wraps(method)
        def guarded(*args: P.args, **kwargs: P.kwargs) -> R:
            try:
                return method(*args, **kwargs)
            except Exception:  # noqa: BLE001 — tracing never fails the work it watches
                logger.warning("langfuse: %s failed", method.__name__, exc_info=True)
                return fallback

        return guarded

    return decorate


class _Observed:
    """One Langfuse observation behind Mentora's `Observation`."""

    def __init__(self, inner: Any) -> None:
        self._inner = inner
        self._ended = False

    @_quiet(NULL)
    def span(self, name: str, *, metadata: Mapping[str, Any] | None = None) -> Observation:
        return _Observed(
            self._inner.start_observation(
                name=name, as_type="span", metadata=dict(metadata) if metadata else None
            )
        )

    @_quiet(NULL)
    def generation(
        self, name: str, *, model: str, input: Any, parameters: Mapping[str, Any]
    ) -> Observation:
        return _Observed(
            self._inner.start_observation(
                name=name,
                as_type="generation",
                model=model,
                input=input,
                model_parameters=dict(parameters),
            )
        )

    @_quiet(None)
    def event(
        self, name: str, *, metadata: Mapping[str, Any] | None = None, warning: bool = False
    ) -> None:
        self._inner.create_event(
            name=name,
            metadata=dict(metadata) if metadata else None,
            level="WARNING" if warning else "DEFAULT",
        )

    @_quiet(None)
    def end(
        self,
        *,
        output: Any = None,
        metadata: Mapping[str, Any] | None = None,
        usage: tuple[int, int] | None = None,
        cost: tuple[float, float] | None = None,
        error: str | None = None,
    ) -> None:
        if self._ended:
            return
        self._ended = True
        fields: dict[str, Any] = {}
        if output is not None:
            fields["output"] = output
        if metadata:
            fields["metadata"] = dict(metadata)
        if usage is not None:
            fields["usage_details"] = {"input": usage[0], "output": usage[1]}
        if cost is not None:
            fields["cost_details"] = {"input": cost[0], "output": cost[1]}
        if error:
            fields.update(level="ERROR", status_message=error)
        if fields:
            self._inner.update(**fields)
        self._inner.end()


class LangfuseTracer:
    enabled = True

    def __init__(
        self,
        *,
        public_key: str,
        secret_key: str,
        host: str,
        environment: str,
        content: Content,
        sample_rate: float = 1.0,
    ) -> None:
        self.content = content
        self._client = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            base_url=host,
            environment=environment,
            sample_rate=sample_rate,
        )

    def attributes(self, info: TraceInfo) -> AbstractContextManager[Any]:
        if not (info.user or info.session or info.tags):
            return nullcontext()
        return propagate_attributes(
            user_id=info.user,
            session_id=info.session,
            tags=[*info.tags, info.kind.value],
            trace_name=info.name,
        )

    @_quiet(NULL)
    def start(self, info: TraceInfo) -> Observation:
        return _Observed(
            self._client.start_observation(
                name=info.name,
                as_type="span",
                input=info.input,
                metadata={"kind": info.kind.value, **info.metadata},
            )
        )

    @_quiet(None)
    def shutdown(self) -> None:
        self._client.shutdown()
