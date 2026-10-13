"""Any provider, with every call recorded (§27).

Wraps the `LLMProvider` protocol, so it sees every model call in the app
without any of them changing: the model, what was asked and what came back
(or only their sizes, when the trace may not keep words), tokens, cost, how
it finished. A call made inside a chat turn or a build lands in its trace; any
other call is a small trace of its own.

What it records never changes what the caller gets — the events and the
completion pass through untouched, and the tracer fails quietly.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any

from app.observability.base import Kind, Observation, TraceInfo, Tracer, keeps_text
from app.observability.context import Scope, current, quietly
from app.providers.base import (
    ChatRequest,
    Completion,
    FinishEvent,
    LLMProvider,
    ProviderInfo,
    StreamEvent,
    TokenEvent,
    ToolCall,
    ToolCallsEvent,
    Usage,
    UsageEvent,
)

PER_MILLION = 1_000_000


class TracedProvider:
    def __init__(
        self,
        inner: LLMProvider,
        tracer: Tracer,
        *,
        prices: tuple[float, float] | None = None,
    ) -> None:
        self._inner = inner
        self._tracer = tracer
        # Per million tokens in and out, as Mentora's own cost table counts.
        self._prices = prices

    @property
    def info(self) -> ProviderInfo:
        return self._inner.info

    @info.setter
    def info(self, value: ProviderInfo) -> None:
        self._inner.info = value

    async def complete(self, req: ChatRequest) -> Completion:
        call = self._begin(req, "completion")
        try:
            completion = await self._inner.complete(req)
        except BaseException as exc:
            if call:
                call.failed(exc)
            raise
        if call:
            call.done(
                completion.text,
                completion.tool_calls,
                completion.usage,
                str(completion.finish_reason),
            )
        return completion

    async def stream_chat(self, req: ChatRequest) -> AsyncIterator[StreamEvent]:
        call = self._begin(req, "answer")
        text: list[str] = []
        calls: tuple[ToolCall, ...] = ()
        usage: Usage | None = None
        finish = ""
        try:
            async for event in self._inner.stream_chat(req):
                if isinstance(event, TokenEvent):
                    text.append(event.text)
                elif isinstance(event, ToolCallsEvent):
                    calls = event.calls
                elif isinstance(event, UsageEvent):
                    usage = event.usage
                elif isinstance(event, FinishEvent):
                    finish = str(event.reason)
                yield event
        except (GeneratorExit, asyncio.CancelledError):
            # Stopped by the person, or the turn was: what came so far.
            if call:
                call.done("".join(text), calls, usage, "stopped")
            raise
        except BaseException as exc:
            if call:
                call.failed(exc)
            raise
        if call:
            call.done("".join(text), calls, usage, finish)

    def _begin(self, req: ChatRequest, default: str) -> _Call | None:
        if not self._tracer.enabled:
            return None
        return quietly("generation", lambda: self._started(req, req.purpose or default), None)

    def _started(self, req: ChatRequest, name: str) -> _Call:
        scope = current()
        root: Observation | None = None
        if scope is None:
            # Not inside a turn or a build: a trace of its own.
            info = TraceInfo(name=name, kind=Kind.OTHER)
            root = self._tracer.start(info)
            scope = Scope(root, keeps_text(self._tracer.content, Kind.OTHER))
        parent = scope.observation
        generation = parent.generation(
            name,
            model=req.model or self.info.model,
            input=_input(req, scope.keep_text),
            parameters=_parameters(req),
        )
        return _Call(generation, root, scope.keep_text, self._prices)


@dataclass(frozen=True, slots=True)
class _Call:
    generation: Observation
    # The trace's root, when the call is a trace of its own.
    root: Observation | None
    keep_text: bool
    prices: tuple[float, float] | None

    def done(
        self, text: str, calls: Sequence[ToolCall], usage: Usage | None, finish: str
    ) -> None:
        tokens = (usage.prompt_tokens, usage.completion_tokens) if usage else None
        self._end(
            output=_output(text, calls, self.keep_text),
            metadata={
                "finish_reason": finish,
                "usage_source": str(usage.source) if usage else "missing",
            },
            usage=tokens,
            cost=_cost(tokens, self.prices),
        )

    def failed(self, exc: BaseException) -> None:
        message = getattr(exc, "message", "") or type(exc).__name__
        self._end(error=str(message)[:300])

    def _end(self, **fields: Any) -> None:
        quietly("generation", lambda: self.generation.end(**fields), None)
        if self.root is not None:
            root = self.root
            quietly("trace", lambda: root.end(error=fields.get("error")), None)


def _input(req: ChatRequest, keep_text: bool) -> Any:
    if keep_text:
        return [message.to_wire() for message in req.messages]
    return {
        "messages": len(req.messages),
        "characters": sum(len(message.content) for message in req.messages),
    }


def _output(text: str, calls: Sequence[ToolCall], keep_text: bool) -> Any:
    names = [call.name for call in calls]
    if not keep_text:
        return {"characters": len(text), "tool_calls": names}
    if not calls:
        return text
    return {
        "text": text,
        "tool_calls": [{"name": call.name, "arguments": call.arguments} for call in calls],
    }


def _parameters(req: ChatRequest) -> dict[str, Any]:
    parameters: dict[str, Any] = {
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "stream": req.stream,
    }
    tools = [_tool_name(tool) for tool in req.tools]
    if tools:
        parameters["tools"] = tools
    return parameters


def _tool_name(schema: dict[str, Any]) -> str:
    function = schema.get("function")
    name = function.get("name") if isinstance(function, dict) else schema.get("name")
    return str(name or "?")


def _cost(
    tokens: tuple[int, int] | None, prices: tuple[float, float] | None
) -> tuple[float, float] | None:
    if tokens is None or prices is None:
        return None
    return (tokens[0] * prices[0] / PER_MILLION, tokens[1] * prices[1] / PER_MILLION)
