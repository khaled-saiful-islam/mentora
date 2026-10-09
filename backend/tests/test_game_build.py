"""A game through the same pipeline as every set (§26): the level reaches the
prompts that write and check, islands are checked as islands, a round that
breaks its rules is played as a Match Up, an island with no round at all is
written again — and the story is written around them. No code is written:
the rounds are the app's own."""

from __future__ import annotations

from typing import Any

from app.guards.prompt_injection import PromptInjectionGuard
from app.learning.game import FALLBACK_TASK, GameKind
from app.learning.generator import Built, GenerationRequest, LearningGenerator, Refused, Stage
from app.learning.model import Meter
from app.learning.quiz import QuizKind
from app.learning.research import Researcher
from tests.learning_fakes import GOOD_RESULTS, FakeModel, FakeSearch, happy

DIFFICULTY = ["hard", "easy", "medium"]
PAIRS = [
    {"left": "Roots", "right": "drink water", "why": "Roots take in water."},
    {"left": "Leaves", "right": "catch sunlight", "why": "Leaves catch the light."},
    {"left": "Stomata", "right": "let air in", "why": "Tiny holes let air in."},
]


def rounds(n: int) -> dict[str, Any]:
    """A Sort It Out, a Line Up and a Match Up in turn."""
    if n % 3 == 1:
        cards = [
            {
                "text": f"Card {n}.{c}",
                "icon": "🌱",
                "basket": "In" if c % 2 else "Out",
                "why": "So.",
            }
            for c in range(1, 5)
        ]
        return {
            "play": "sort",
            "sort": {"baskets": [{"label": "In"}, {"label": "Out"}], "cards": cards},
        }
    if n % 3 == 2:
        steps = [{"text": f"Step {n}.{c}", "icon": "➡️", "why": "Then."} for c in range(1, 5)]
        return {"play": "order", "order": {"steps": steps}}
    return {"play": "match"}


def islands(broken: set[int] | None = None) -> Any:
    counter = iter(range(1, 1000))

    def answer(system: str, user: str) -> dict[str, Any]:
        want = int(user.rsplit("Write ", 1)[1].split()[0])
        items = []
        for _ in range(want):
            n = next(counter)
            items.append(
                {
                    "learn": f"Idea number {n}.",
                    "icon": "☀️",
                    **rounds(n),
                    "task": f"Do task {n}!",
                    "pairs": [] if n in (broken or set()) else PAIRS,
                    "explanation": "Plants need light to make food.",
                    "hint": "More sunlight.",
                    "skill": "chlorophyll",
                    "difficulty": DIFFICULTY[n % 3],
                    "source_ids": ["s1"],
                }
            )
        return {"items": items}

    return answer


STORY = {
    "title": "Save the Padi",
    "world": "kampung",
    "story": {"hook": "The padi is wilting! {buddy} needs you.", "goal": "Grow it.", "win": "Yay!"},
}


def build(answers: dict[str, Any], *, kind=None) -> tuple[LearningGenerator, Any]:
    meter = Meter()
    model = FakeModel(answers, meter)
    researcher = Researcher(FakeSearch(GOOD_RESULTS), None, PromptInjectionGuard())
    gen = LearningGenerator(model, researcher, kind or GameKind(), meter)
    return gen, model


async def run(gen: LearningGenerator, **req: Any) -> list[Any]:
    request = GenerationRequest(
        kind="game", topic="photosynthesis", subject="Science", grade_level="year_5", **req
    )
    return [update async for update in gen.run(request)]


async def test_a_game_build_ends_with_its_story_and_writes_no_code() -> None:
    gen, _ = build(happy(draft=islands(), wrap=STORY))
    updates = await run(gen, count=4, choices={"world": "kampung"})

    stages = [(u.key, u.state) for u in updates if isinstance(u, Stage)]
    assert stages[-1] == ("finish", "done")
    assert not [key for key, _ in stages if key == "build"]
    built = updates[-1]
    assert isinstance(built, Built)
    items = list(built.result.items)
    assert len(items) == 4
    assert {i["play"] for i in items} == {"sort", "order", "match"}
    assert [i["difficulty"] for i in items] == sorted(
        (i["difficulty"] for i in items), key=["easy", "medium", "hard"].index
    )
    assert built.result.extras["title"] == "Save the Padi"


async def test_a_round_that_breaks_its_rules_is_played_as_a_match_up() -> None:
    written = islands()

    def draft(system: str, user: str) -> dict[str, Any]:
        items = written(system, user)["items"]
        # Every card in one basket: the other basket gets none.
        for item in items:
            if item["play"] == "sort":
                item["sort"]["cards"] = [{**c, "basket": "In"} for c in item["sort"]["cards"]]
        return {"items": items}

    gen, _ = build(happy(draft=draft, wrap=STORY))
    updates = await run(gen, count=3)
    first = next(i for i in updates[-1].result.items if i["learn"] == "Idea number 1.")
    assert first["play"] == "match" and first["task"] == FALLBACK_TASK


async def test_an_island_with_no_round_that_keeps_its_rules_is_written_again() -> None:
    # The first batch's Match Ups have no pairs, and nothing to fall back on.
    gen, model = build(happy(draft=islands(broken={3}), wrap=STORY))
    updates = await run(gen, count=3)
    items = updates[-1].result.items
    assert len(items) == 3 and "Idea number 3." not in [i["learn"] for i in items]
    assert model.asked.count("draft") == 2


async def test_islands_are_checked_as_islands_at_the_level_chosen() -> None:
    seen: dict[str, str] = {}

    def draft(system: str, user: str) -> dict[str, Any]:
        seen["draft"] = system
        return islands()(system, user)

    def verify(system: str, user: str) -> dict[str, Any]:
        seen["verify_system"], seen["verify"] = system, user
        return {"results": []}

    gen, _ = build(happy(draft=draft, verify=verify, wrap=STORY))
    await run(gen, count=3, level="beginner")
    assert "Level: Beginner" in seen["draft"]
    assert "Level: Beginner" in seen["verify"]
    assert "These items are islands" in seen["verify_system"]
    assert "ALWAYS `pairs`" in seen["draft"]


async def test_quizzes_have_no_story() -> None:
    gen, model = build(happy(), kind=QuizKind())
    updates = await run(gen, count=5)
    assert not [u for u in updates if isinstance(u, Stage) and u.key == "finish"]
    assert "wrap" not in model.asked


async def test_an_unsafe_story_is_refused_before_any_model_is_asked() -> None:
    gen, model = build(happy(draft=islands(), wrap=STORY))
    updates = await run(gen, count=3, choices={"story": "Ali learns how to make a bomb."})
    assert isinstance(updates[-1], Refused)
    assert model.asked == []


async def test_the_makers_story_setting_and_templates_reach_the_islands_and_the_story() -> None:
    seen: dict[str, str] = {}

    def draft(system: str, user: str) -> dict[str, Any]:
        seen["draft"] = system
        return islands()(system, user)

    def wrap(system: str, user: str) -> dict[str, Any]:
        seen["wrap"] = user
        return STORY

    gen, _ = build(happy(draft=draft, wrap=wrap))
    choices = {"world": "reef", "story": "Siti the turtle.", "plays": ["sort", "order"]}
    updates = await run(gen, count=3, choices=choices)
    assert "coral reef of Sipadan" in seen["draft"]
    assert "<story>\nSiti the turtle.\n</story>" in seen["draft"]
    assert "Use only sort, order." in seen["draft"]
    assert "Siti the turtle." in seen["wrap"]
    assert updates[-1].result.extras["authored"] is True
