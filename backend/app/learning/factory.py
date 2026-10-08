"""Wiring a generator from settings — the one place that knows the concrete
provider, search and guard. Everything else takes them as arguments."""

from __future__ import annotations

from app.artifacts.model import ArtifactModel
from app.core.config import Settings
from app.guards.registry import build_guards
from app.learning.base import LearningKind
from app.learning.generator import LearningGenerator
from app.learning.model import JsonModel, LearningModel, Meter
from app.learning.picture_check import PictureCheck, VisionPictureCheck, WordsPictureCheck
from app.learning.research import Researcher
from app.learning.sim.builder import SimBuilder
from app.learning.sim.playtest import BrowserTester
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.tools.page_reader import PageReader
from app.tools.serpapi import SerpApiSearch


def build_model(settings: Settings, meter: Meter) -> JsonModel:
    provider = OpenAICompatibleProvider(
        base_url=settings.resolved_learning_base_url,
        api_key=settings.resolved_learning_api_key,
        model=settings.resolved_learning_model,
        timeout=settings.learning_timeout_seconds,
    )
    return LearningModel(provider, meter)


def build_researcher(settings: Settings) -> Researcher:
    search = (
        SerpApiSearch(
            api_key=settings.serpapi_key,
            base_url=settings.serpapi_base_url,
            country=settings.search_country,
            safe=True,
        )
        if settings.search_enabled
        else None
    )
    guards = build_guards(settings)
    return Researcher(
        search,
        PageReader(timeout=settings.search_read_timeout_seconds),
        guards[0] if guards else None,
        read=settings.learning_read_pages,
    )


def build_picture_check(settings: Settings) -> PictureCheck:
    """Looking at the picture when a model can see; its title otherwise."""
    if settings.picture_check_model.strip():
        return VisionPictureCheck(
            base_url=settings.resolved_picture_check_base_url,
            api_key=settings.resolved_picture_check_api_key,
            model=settings.picture_check_model.strip(),
            timeout=settings.picture_check_timeout_seconds,
        )
    return WordsPictureCheck()


def build_sim_builder(settings: Settings) -> SimBuilder | None:
    """What writes and tests a game (§24): the studio's model, which has the
    output budget for a whole document, and the browser it already uses.
    None when games are off, or there is no such model to write them."""
    if not settings.games_available:
        return None
    model = ArtifactModel(
        OpenAICompatibleProvider(
            base_url=settings.resolved_artifact_base_url,
            api_key=settings.resolved_artifact_api_key,
            model=settings.artifact_model,
            timeout=settings.artifact_timeout_seconds,
        ),
        max_tokens=settings.artifact_max_tokens,
    )
    return SimBuilder(model, BrowserTester())


def build_generator(settings: Settings, kind: LearningKind, meter: Meter) -> LearningGenerator:
    return LearningGenerator(
        build_model(settings, meter),
        build_researcher(settings),
        kind,
        meter,
        picture_check=build_picture_check(settings),
        builder=build_sim_builder(settings) if getattr(kind, "coded", False) else None,
    )
