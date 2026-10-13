"""Which tracer runs (§27): Langfuse when its keys are set, otherwise one that
records nothing. One per process, like the SDK's own client."""

from __future__ import annotations

import logging
import re
from functools import lru_cache

from app.core.config import Settings, get_settings
from app.observability.base import Content, NullTracer, Tracer

logger = logging.getLogger(__name__)


def build_tracer(settings: Settings) -> Tracer:
    if not settings.langfuse_enabled:
        return NullTracer()
    try:
        from app.observability.langfuse_tracer import LangfuseTracer

        return LangfuseTracer(
            public_key=settings.langfuse_public_key.strip(),
            secret_key=settings.langfuse_secret_key.strip(),
            host=settings.langfuse_host.strip().rstrip("/"),
            environment=_environment(settings.app_env),
            content=Content(settings.langfuse_content),
            sample_rate=min(1.0, max(0.0, settings.langfuse_sample_rate)),
        )
    except Exception:  # noqa: BLE001 — no tracing is better than no app
        logger.warning("tracing is off: Langfuse could not start", exc_info=True)
        return NullTracer()


def _environment(app_env: str) -> str:
    """Langfuse's spelling: lower case, letters, digits, - and _."""
    cleaned = re.sub(r"[^a-z0-9_-]", "-", app_env.strip().lower())[:40]
    return cleaned or "development"


@lru_cache
def get_tracer() -> Tracer:
    return build_tracer(get_settings())
