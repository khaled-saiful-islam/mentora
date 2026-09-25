"""Short JSON calls: one retry on prose, usage metered, failures said plainly."""

from __future__ import annotations

import pytest

from app.learning.model import GenerationUnavailable, LearningModel, Meter
from app.providers.base import Completion, ProviderError, ProviderInfo, Usage, UsageSource


class ScriptedProvider:
    info = ProviderInfo(name="scripted", model="scripted-1", base_url="")

    def __init__(self, replies: list[str | Exception]) -> None:
        self._replies = list(replies)
        self.requests = []

    async def complete(self, req):
        self.requests.append(req)
        reply = self._replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return Completion(text=reply, usage=Usage(10, 5, UsageSource.PROVIDER))

    async def stream_chat(self, req):  # pragma: no cover - not used
        yield None


async def test_a_json_reply_is_returned_and_metered() -> None:
    meter = Meter()
    model = LearningModel(ScriptedProvider(['```json\n{"ok": true}\n```']), meter)
    assert await model.ask("check", "sys", "user") == {"ok": True}
    assert (meter.prompt_tokens, meter.completion_tokens, meter.calls) == (10, 5, 1)
    assert meter.by_stage == {"check": 15}


async def test_prose_gets_one_more_chance_then_nothing() -> None:
    provider = ScriptedProvider(["Sure! Here you go.", "Still prose."])
    meter = Meter()
    assert await LearningModel(provider, meter).ask("draft", "sys", "user") == {}
    assert len(provider.requests) == 2
    assert "one JSON object" in provider.requests[1].messages[-1].content
    assert meter.calls == 2


async def test_the_second_chance_can_succeed() -> None:
    provider = ScriptedProvider(["no", '{"items": []}'])
    assert await LearningModel(provider, Meter()).ask("draft", "s", "u") == {"items": []}


async def test_an_unreachable_model_is_a_generation_failure() -> None:
    provider = ScriptedProvider([ProviderError("The model timed out.")])
    with pytest.raises(GenerationUnavailable, match="timed out"):
        await LearningModel(provider, Meter()).ask("check", "s", "u")
