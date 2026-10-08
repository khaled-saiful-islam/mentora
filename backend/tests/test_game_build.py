"""A game through the same pipeline as every set (§24): the level reaches the
prompts that write and check, missions are checked as missions, the story is
written around them — and then the game's code is written and tested, and a
game whose code cannot be made fails the set rather than shipping without it."""

from __future__ import annotations

from typing import Any

from app.guards.prompt_injection import PromptInjectionGuard
from app.learning.game import GameKind
from app.learning.generator import Built, GenerationRequest, LearningGenerator, Refused, Stage
from app.learning.model import GenerationUnavailable, Meter
from app.learning.quiz import QuizKind
from app.learning.research import Researcher
from app.learning.sim.builder import Progress, SimBuilt
from tests.learning_fakes import GOOD_RESULTS, FakeModel, FakeSearch, happy

DIFFICULTY = ["hard", "easy", "medium"]


def missions() -> Any:
    counter = iter(range(1, 1000))

    def answer(system: str, user: str) -> dict[str, Any]:
        want = int(user.rsplit("Write ", 1)[1].split()[0])
        items = []
        for _ in range(want):
            n = next(counter)
            items.append(
                {
                    "goal": f"Grow plant {n} to full height.",
                    "win": f"Plant {n} is 100% tall with sun above half.",
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


class FakeBuilder:
    """Says what it is doing, then hands back a game — or fails."""

    def __init__(self, fail: Exception | None = None) -> None:
        self.specs: list[Any] = []
        self._fail = fail

    async def build(self, spec):
        self.specs.append(spec)
        yield Progress("Designing the simulation")
        yield Progress("Coding the game", "12 KB written")
        if self._fail is not None:
            raise self._fail
        yield SimBuilt(html="<!DOCTYPE html>", model="fake", prompt_tokens=9, completion_tokens=4,
                       build_ms=5)  # fmt: skip


def build(answers: dict[str, Any], *, kind=None, builder=None) -> tuple[LearningGenerator, Any]:
    meter = Meter()
    model = FakeModel(answers, meter)
    researcher = Researcher(FakeSearch(GOOD_RESULTS), None, PromptInjectionGuard())
    gen = LearningGenerator(model, researcher, kind or GameKind(), meter, builder=builder)
    return gen, model


async def run(gen: LearningGenerator, **req: Any) -> list[Any]:
    request = GenerationRequest(
        kind="game", topic="photosynthesis", subject="Science", grade_level="year_5", **req
    )
    return [update async for update in gen.run(request)]


async def test_a_game_build_ends_with_its_story_then_its_tested_code() -> None:
    builder = FakeBuilder()
    gen, _ = build(happy(draft=missions(), wrap=STORY), builder=builder)
    updates = await run(gen, count=4, choices={"world": "kampung"})

    stages = [(u.key, u.state) for u in updates if isinstance(u, Stage)]
    assert stages.index(("finish", "done")) < stages.index(("build", "running"))
    assert stages[-1] == ("build", "done")
    coding = [u.label for u in updates if isinstance(u, Stage) and u.key == "build"]
    assert "Coding the game" in coding
    built = updates[-1]
    assert isinstance(built, Built)
    assert built.result.document.html == "<!DOCTYPE html>"
    items = list(built.result.items)
    assert [i["difficulty"] for i in items] == sorted(
        (i["difficulty"] for i in items), key=["easy", "medium", "hard"].index
    )
    spec = builder.specs[0]
    assert [m["id"] for m in spec.missions] == [i["id"] for i in items]
    assert spec.title == "Save the Padi" and "kampung" in spec.setting


async def test_a_game_whose_code_cannot_be_made_fails_the_set() -> None:
    builder = FakeBuilder(fail=GenerationUnavailable("This game didn't pass its tests."))
    gen, _ = build(happy(draft=missions(), wrap=STORY), builder=builder)
    try:
        await run(gen, count=3)
    except GenerationUnavailable as exc:
        assert "didn't pass its tests" in str(exc)
    else:
        raise AssertionError("a game with no code was kept")


async def test_with_no_game_writer_set_up_no_game_is_made() -> None:
    gen, _ = build(happy(draft=missions(), wrap=STORY), builder=None)
    try:
        await run(gen, count=3)
    except GenerationUnavailable as exc:
        assert "Games can't be made here" in str(exc)
    else:
        raise AssertionError("a game with no code was kept")


async def test_missions_are_checked_as_missions_at_the_level_chosen() -> None:
    seen: dict[str, str] = {}

    def draft(system: str, user: str) -> dict[str, Any]:
        seen["draft"] = system
        return missions()(system, user)

    def verify(system: str, user: str) -> dict[str, Any]:
        seen["verify_system"], seen["verify"] = system, user
        return {"results": []}

    gen, _ = build(happy(draft=draft, verify=verify, wrap=STORY), builder=FakeBuilder())
    await run(gen, count=3, level="beginner")
    assert "Level: Beginner" in seen["draft"]
    assert "Level: Beginner" in seen["verify"]
    assert "These items are missions" in seen["verify_system"]
    assert "never options" in seen["draft"].lower()


async def test_quizzes_have_no_story_and_no_code() -> None:
    builder = FakeBuilder()
    gen, model = build(happy(), kind=QuizKind(), builder=builder)
    updates = await run(gen, count=5)
    assert not [u for u in updates if isinstance(u, Stage) and u.key in ("finish", "build")]
    assert "wrap" not in model.asked and builder.specs == []
    assert updates[-1].result.document is None


async def test_an_unsafe_story_is_refused_before_any_model_is_asked() -> None:
    builder = FakeBuilder()
    gen, model = build(happy(draft=missions(), wrap=STORY), builder=builder)
    updates = await run(gen, count=3, choices={"story": "Ali learns how to make a bomb."})
    assert isinstance(updates[-1], Refused)
    assert model.asked == [] and builder.specs == []


async def test_the_makers_story_and_setting_reach_the_missions_and_the_story() -> None:
    seen: dict[str, str] = {}

    def draft(system: str, user: str) -> dict[str, Any]:
        seen["draft"] = system
        return missions()(system, user)

    def wrap(system: str, user: str) -> dict[str, Any]:
        seen["wrap"] = user
        return STORY

    gen, _ = build(happy(draft=draft, wrap=wrap), builder=FakeBuilder())
    updates = await run(gen, count=3, choices={"world": "reef", "story": "Siti the turtle."})
    assert "coral reef of Sipadan" in seen["draft"]
    assert "<story>\nSiti the turtle.\n</story>" in seen["draft"]
    assert "Siti the turtle." in seen["wrap"]
    assert updates[-1].result.extras["authored"] is True
