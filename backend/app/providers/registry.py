"""The one place that decides which provider is in use.

Adding a provider is a new file implementing `LLMProvider` plus one branch here.
Nothing else in the application needs to change, because nothing else in the
application imports a concrete provider.
"""

from __future__ import annotations

from app.core.config import Settings, get_settings
from app.observability.registry import get_tracer
from app.providers.base import LLMProvider
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.providers.traced import TracedProvider


def build_provider(settings: Settings | None = None) -> LLMProvider:
    settings = settings or get_settings()
    return make_provider(
        settings,
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        model=settings.llm_model,
        timeout=settings.llm_timeout_seconds,
    )


def make_provider(
    settings: Settings, *, base_url: str, api_key: str, model: str, timeout: float
) -> LLMProvider:
    """A provider for one endpoint and model — the chat's, generation's, the
    studio's — with every call recorded when tracing is on (§27)."""
    provider = OpenAICompatibleProvider(
        base_url=base_url, api_key=api_key, model=model, timeout=timeout
    )
    tracer = get_tracer()
    if not tracer.enabled:
        return provider
    prices = (
        (settings.llm_price_input_per_1m, settings.llm_price_output_per_1m)
        if settings.llm_price_currency.strip().upper() == "USD"
        else None
    )
    return TracedProvider(provider, tracer, prices=prices)
