"""Tracing (§27): every model call recorded where it belongs, words only where
the setting allows, and a tracer that fails never failing the work."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Mapping
from contextlib import nullcontext
from typing import Any
from uuid import uuid4

import pytest

from app.learning.generator import GenerationRequest
from app.observability.base import (
    NULL,
    Content,
    Kind,
    NullTracer,
    TraceInfo,
    keeps_text,
)
from app.observability.context import Steps, current, finish, note, opened, pseudonym
from app.observability.langfuse_tracer import _Observed
from app.observability.registry import _environment, build_tracer
from app.providers.base import (
    ChatMessage,
    ChatRequest,
    Completion,
    FinishEvent,
    FinishReason,
    ProviderError,
    ProviderInfo,
    Role,
    StreamEvent,
    TokenEvent,
    ToolCall,
    ToolCallsEvent,
    Usage,
    UsageEvent,
    UsageSource,
)
from app.providers.traced import TracedProvider
from app.services import live_turns as live_turns_module
from app.services.events import DoneEvent, StartEvent
from app.services.generation_service import _build_trace
from app.services.live_turns import LiveTurns

SECRET = "my child Aisyah is struggling"


class FakeObservation:
    def __init__(self, kind: str, name: str, **fields: Any) -> None:
        self.kind = kind
        self.name = name
        self.fields = fields
        self.children: list[FakeObservation] = []
        self.events: list[tuple[str, Any, bool]] = []
        self.ended: dict[str, Any] | None = None

    def span(self, name: str, *, metadata: Mapping[str, Any] | None = None) -> FakeObservation:
        child = FakeObservation("span", name, metadata=metadata)
        self.children.append(child)
        return child

    def generation(
        self, name: str, *, model: str, input: Any, parameters: Mapping[str, Any]
    ) -> FakeObservation:
        child = FakeObservation("generation", name, model=model, input=input, parameters=parameters)
        self.children.append(child)
        return child

    def event(
        self, name: str, *, metadata: Mapping[str, Any] | None = None, warning: bool = False
    ) -> None:
        self.events.append((name, metadata, warning))

    def end(self, **fields: Any) -> None:
        if self.ended is None:
            self.ended = fields


class FakeTracer:
    enabled = True

    def __init__(self, content: Content = Content.ALL) -> None:
        self.content = content
        self.roots: list[FakeObservation] = []
        self.infos: list[TraceInfo] = []

    def attributes(self, info: TraceInfo) -> Any:
        self.infos.append(info)
        return nullcontext()

    def start(self, info: TraceInfo) -> FakeObservation:
        root = FakeObservation("trace", info.name, info=info)
        self.roots.append(root)
        return root

    def shutdown(self) -> None:
        return None


class BrokenTracer:
    enabled = True
    content = Content.ALL

    def attributes(self, info: TraceInfo) -> Any:
        raise RuntimeError("langfuse is down")

    def start(self, info: TraceInfo) -> Any:
        raise RuntimeError("langfuse is down")

    def shutdown(self) -> None:
        raise RuntimeError("langfuse is down")


class FakeProvider:
    def __init__(self, *, fail: bool = False) -> None:
        self.info = ProviderInfo(name="fake", model="fake-model", base_url="http://x")
        self._fail = fail

    async def complete(self, req: ChatRequest) -> Completion:
        if self._fail:
            raise ProviderError("The model returned an error (500).", status_code=500)
        return Completion(text='{"ok": true}', usage=Usage(10, 5, UsageSource.PROVIDER))

    async def stream_chat(self, req: ChatRequest) -> AsyncIterator[StreamEvent]:
        if self._fail:
            raise ProviderError("The model returned an error (500).", status_code=500)
        for piece in ("Hel", "lo"):
            yield TokenEvent(piece)
        yield ToolCallsEvent((ToolCall(id="1", name="web_search", arguments='{"q": "x"}'),))
        yield UsageEvent(Usage(20, 2, UsageSource.ESTIMATED))
        yield FinishEvent(FinishReason.TOOL_CALLS)


def request(purpose: str = "") -> ChatRequest:
    return ChatRequest(
        messages=(
            ChatMessage(role=Role.SYSTEM, content="Write a quiz."),
            ChatMessage(role=Role.USER, content=SECRET),
        ),
        model="fake-model",
        tools=({"type": "function", "function": {"name": "web_search"}},),
        purpose=purpose,
    )


def only(observations: list[FakeObservation]) -> FakeObservation:
    assert len(observations) == 1
    return observations[0]


# --- what is kept --------------------------------------------------------


@pytest.mark.parametrize(
    ("content", "kind", "kept"),
    [
        (Content.BUILDS, Kind.BUILD, True),
        (Content.BUILDS, Kind.CHAT, False),
        (Content.BUILDS, Kind.OTHER, False),
        (Content.ALL, Kind.CHAT, True),
        (Content.NONE, Kind.BUILD, False),
    ],
)
def test_words_are_kept_only_where_the_setting_allows(
    content: Content, kind: Kind, kept: bool
) -> None:
    assert keeps_text(content, kind) is kept


async def test_a_build_call_is_recorded_whole_inside_its_trace() -> None:
    tracer = FakeTracer(Content.BUILDS)
    provider = TracedProvider(FakeProvider(), tracer, prices=(1.0, 2.0))
    with opened(tracer, TraceInfo(name="build quiz", kind=Kind.BUILD)):
        completion = await provider.complete(request("check"))
    assert completion.text == '{"ok": true}'
    generation = only(only(tracer.roots).children)
    assert generation.name == "check"
    assert generation.fields["model"] == "fake-model"
    assert generation.fields["input"][1] == {"role": "user", "content": SECRET}
    assert generation.fields["parameters"]["tools"] == ["web_search"]
    assert generation.ended is not None
    assert generation.ended["output"] == '{"ok": true}'
    assert generation.ended["usage"] == (10, 5)
    assert generation.ended["cost"] == pytest.approx((10 / 1e6, 10 / 1e6))
    assert tracer.roots[0].ended is not None


async def test_a_chat_call_keeps_counts_and_never_the_words() -> None:
    tracer = FakeTracer(Content.BUILDS)
    provider = TracedProvider(FakeProvider(), tracer)
    with opened(tracer, TraceInfo(name="chat turn", kind=Kind.CHAT)):
        events = [event async for event in provider.stream_chat(request())]
    assert len(events) == 5  # passed through untouched
    generation = only(only(tracer.roots).children)
    assert generation.name == "answer"
    assert SECRET not in repr(generation.fields) + repr(generation.ended)
    assert generation.fields["input"] == {"messages": 2, "characters": 13 + len(SECRET)}
    assert generation.ended is not None
    assert generation.ended["output"] == {"characters": 5, "tool_calls": ["web_search"]}
    assert generation.ended["metadata"]["finish_reason"] == "tool_calls"
    assert generation.ended["metadata"]["usage_source"] == "estimated"


async def test_a_streamed_answer_is_recorded_as_it_ended() -> None:
    tracer = FakeTracer(Content.ALL)
    provider = TracedProvider(FakeProvider(), tracer)
    with opened(tracer, TraceInfo(name="chat turn", kind=Kind.CHAT)):
        async for _ in provider.stream_chat(request()):
            pass
    generation = only(tracer.roots[0].children)
    assert generation.ended is not None
    assert generation.ended["output"]["text"] == "Hello"
    assert generation.ended["output"]["tool_calls"][0]["name"] == "web_search"


async def test_an_answer_stopped_part_way_is_recorded_as_stopped() -> None:
    tracer = FakeTracer(Content.ALL)
    provider = TracedProvider(FakeProvider(), tracer)
    with opened(tracer, TraceInfo(name="chat turn", kind=Kind.CHAT)):
        stream = provider.stream_chat(request())
        assert isinstance(await anext(stream), TokenEvent)
        await stream.aclose()
    generation = only(tracer.roots[0].children)
    assert generation.ended is not None
    assert generation.ended["output"] == "Hel"
    assert generation.ended["metadata"]["finish_reason"] == "stopped"


async def test_a_failed_call_is_recorded_and_still_raised() -> None:
    tracer = FakeTracer()
    provider = TracedProvider(FakeProvider(fail=True), tracer)
    with opened(tracer, TraceInfo(name="build quiz", kind=Kind.BUILD)):
        with pytest.raises(ProviderError):
            await provider.complete(request("draft"))
        with pytest.raises(ProviderError):
            async for _ in provider.stream_chat(request()):
                pass
    for generation in tracer.roots[0].children:
        assert generation.ended == {"error": "The model returned an error (500)."}


async def test_a_call_outside_any_trace_is_a_trace_of_its_own() -> None:
    tracer = FakeTracer(Content.BUILDS)
    provider = TracedProvider(FakeProvider(), tracer)
    await provider.complete(request("live answer"))
    root = only(tracer.roots)
    assert root.name == "live answer"
    assert root.fields["info"].kind is Kind.OTHER
    assert root.ended is not None
    # Not a build, so not its words.
    assert SECRET not in repr(only(root.children).fields)


async def test_without_tracing_the_provider_is_not_touched() -> None:
    provider = TracedProvider(FakeProvider(), NullTracer())
    assert (await provider.complete(request())).text == '{"ok": true}'
    assert provider.info.model == "fake-model"


# --- never breaks the work ------------------------------------------------


async def test_a_tracer_that_is_down_never_fails_the_call() -> None:
    tracer = BrokenTracer()
    provider = TracedProvider(FakeProvider(), tracer)
    with opened(tracer, TraceInfo(name="chat turn", kind=Kind.CHAT)) as scope:
        assert scope is not None and scope.observation is NULL
        completion = await provider.complete(request())
        events = [event async for event in provider.stream_chat(request())]
    assert completion.text == '{"ok": true}'
    assert len(events) == 5


async def test_a_call_outside_a_trace_survives_a_tracer_that_is_down() -> None:
    provider = TracedProvider(FakeProvider(), BrokenTracer())
    assert (await provider.complete(request())).text == '{"ok": true}'


def test_the_works_own_error_passes_through_and_is_recorded() -> None:
    tracer = FakeTracer()
    with pytest.raises(ValueError), opened(tracer, TraceInfo(name="x", kind=Kind.BUILD)):
        raise ValueError("boom")
    assert tracer.roots[0].ended == {"output": None, "metadata": None, "error": "ValueError"}
    assert current() is None


def test_tracing_off_opens_nothing() -> None:
    with opened(NullTracer(), TraceInfo(name="x", kind=Kind.CHAT)) as scope:
        assert scope is None
        assert current() is None


# --- trace shape ------------------------------------------------------------


async def test_a_builds_stages_are_steps_holding_their_own_calls() -> None:
    tracer = FakeTracer()
    provider = TracedProvider(FakeProvider(), tracer)
    with opened(tracer, TraceInfo(name="build game", kind=Kind.BUILD)) as scope:
        steps = Steps(scope)
        steps.see("check", "running")
        await provider.complete(request("check"))
        note("reply was not JSON", metadata={"stage": "check"}, warning=True)
        steps.see("check", "done", "Fractions")
        steps.see("write", "running")
        await provider.complete(request("draft"))
        steps.close(error="No islands passed the checks.")
        await provider.complete(request("late"))
        finish(scope, output={"type": "failed"}, error="No islands passed the checks.")
    root = tracer.roots[0]
    check, write, late = root.children
    assert (check.kind, check.name, write.name) == ("span", "check", "write")
    assert [child.name for child in check.children] == ["check"]
    assert check.events == [("reply was not JSON", {"stage": "check"}, True)]
    assert check.ended == {"output": "Fractions", "metadata": None, "error": None}
    assert [child.name for child in write.children] == ["draft"]
    assert write.ended is not None and write.ended["error"] == "No islands passed the checks."
    # After the last step, calls land on the trace itself.
    assert late.name == "late"
    assert root.ended is not None and root.ended["output"] == {"type": "failed"}


def test_steps_without_a_trace_do_nothing() -> None:
    steps = Steps(None)
    steps.see("check", "running")
    steps.close()
    assert current() is None


async def test_a_chat_turn_is_one_trace_in_its_conversations_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tracer = FakeTracer(Content.BUILDS)
    monkeypatch.setattr(live_turns_module, "get_tracer", lambda: tracer)
    user_id, conversation_id = uuid4(), uuid4()

    async def turn() -> AsyncIterator[Any]:
        yield StartEvent(
            conversation_id=conversation_id,
            user_message_id=uuid4(),
            assistant_message_id=uuid4(),
            title="",
        )
        assert current() is not None  # the turn's model calls land in it
        yield DoneEvent(finish_reason=FinishReason.STOP)

    live = LiveTurns()
    running = live.begin(user_id=user_id, role="teacher", source=turn())
    assert running.task is not None
    await asyncio.wait_for(running.task, 5)
    info = only(tracer.infos)
    assert (info.name, info.kind, info.session) == ("chat turn", Kind.CHAT, str(conversation_id))
    assert info.user == pseudonym(user_id) and info.tags == ("teacher",)
    assert tracer.roots[0].ended == {
        "output": {"finish_reason": "stop"},
        "metadata": None,
        "error": None,
    }


# --- who and what ------------------------------------------------------------


def test_the_person_is_a_stable_pseudonym() -> None:
    user_id = uuid4()
    assert pseudonym(user_id) == pseudonym(str(user_id))
    assert str(user_id) not in (pseudonym(user_id) or "")
    assert pseudonym(None) is None


def build_request() -> GenerationRequest:
    return GenerationRequest(
        kind="game",
        topic="Food chains",
        subject="Science",
        grade_level="year_4",
        count=6,
        language="en",
        choices={"story": "Our class trip to Taman Negara"},
    )


def test_a_builds_trace_carries_its_topic_only_when_words_may_be_kept() -> None:
    set_id, owner = uuid4(), uuid4()
    kept = _build_trace(set_id, build_request(), owner, Content.BUILDS)
    assert (kept.name, kept.kind, kept.session) == ("build game", Kind.BUILD, str(set_id))
    assert kept.user == pseudonym(owner)
    assert kept.metadata["topic"] == "Food chains"
    assert kept.metadata["choices"] == {"story": "Our class trip to Taman Negara"}
    assert kept.input is not None and kept.input["topic"] == "Food chains"
    hidden = _build_trace(set_id, build_request(), owner, Content.NONE)
    assert "topic" not in hidden.metadata and "choices" not in hidden.metadata
    assert hidden.input is None
    assert hidden.metadata["grade"] == "year_4"


# --- Langfuse wiring ----------------------------------------------------------


class FakeLangfuseObservation:
    def __init__(self) -> None:
        self.updates: list[dict[str, Any]] = []
        self.ends = 0

    def update(self, **fields: Any) -> None:
        self.updates.append(fields)

    def end(self) -> None:
        self.ends += 1

    def start_observation(self, **fields: Any) -> Any:
        raise RuntimeError("network down")


def test_a_langfuse_observation_ends_once_with_mentoras_fields() -> None:
    inner = FakeLangfuseObservation()
    observed = _Observed(inner)
    observed.end(output="hi", usage=(3, 4), cost=(0.1, 0.2), error="slow")
    observed.end(output="again")
    assert inner.ends == 1
    assert inner.updates == [
        {
            "output": "hi",
            "usage_details": {"input": 3, "output": 4},
            "cost_details": {"input": 0.1, "output": 0.2},
            "level": "ERROR",
            "status_message": "slow",
        }
    ]
    # The SDK failing is a step that records nothing, not an error.
    assert observed.span("check") is NULL


def test_no_keys_means_no_tracing() -> None:
    from app.core.config import Settings

    settings = Settings(langfuse_public_key="pk", langfuse_secret_key="", langfuse_host="")
    assert isinstance(build_tracer(settings), NullTracer)


@pytest.mark.parametrize(
    ("app_env", "expected"),
    [("production", "production"), ("Dev Box", "dev-box"), ("", "development")],
)
def test_the_environment_is_spelled_as_langfuse_allows(app_env: str, expected: str) -> None:
    assert _environment(app_env) == expected
