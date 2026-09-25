"""The model behind generation: short calls that must answer in JSON.

Every call says which stage it is for, so a fake can answer by stage in tests
and the logs say where the time and tokens went. Usage is metered across the
whole build, because generation counts toward the person's token quota.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.artifacts.model import parse_object
from app.providers.base import ChatMessage, ChatRequest, LLMProvider, ProviderError, Role

logger = logging.getLogger(__name__)


class GenerationUnavailable(RuntimeError):
    """The model could not be reached or kept failing — said plainly."""


@dataclass
class Meter:
    """Tokens spent so far. Mutable by design: it is filled in call by call."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    calls: int = 0
    by_stage: dict[str, int] = field(default_factory=dict)

    def add(self, stage: str, prompt: int, completion: int) -> None:
        self.prompt_tokens += prompt
        self.completion_tokens += completion
        self.calls += 1
        self.by_stage[stage] = self.by_stage.get(stage, 0) + prompt + completion


class JsonModel(Protocol):
    name: str

    async def ask(
        self,
        stage: str,
        system: str,
        user: str,
        *,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> dict[str, Any]: ...


class LearningModel:
    def __init__(self, provider: LLMProvider, meter: Meter) -> None:
        self._provider = provider
        self._meter = meter

    @property
    def name(self) -> str:
        return self._provider.info.model

    async def ask(
        self,
        stage: str,
        system: str,
        user: str,
        *,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        """One JSON object back, asking once more if the first reply was not one."""
        for attempt in (1, 2):
            nudge = "" if attempt == 1 else "\n\nReply with one JSON object and nothing else."
            request = ChatRequest(
                messages=(
                    ChatMessage(role=Role.SYSTEM, content=system),
                    ChatMessage(role=Role.USER, content=user + nudge),
                ),
                model=self.name,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False,
            )
            try:
                completion = await self._provider.complete(request)
            except ProviderError as exc:
                raise GenerationUnavailable(exc.message) from exc
            usage = completion.usage
            self._meter.add(stage, usage.prompt_tokens, usage.completion_tokens)
            parsed = parse_object(completion.text)
            if parsed:
                return parsed
            logger.info("stage %s: reply was not JSON (attempt %d)", stage, attempt)
        return {}
