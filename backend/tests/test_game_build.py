"""A game going through the same pipeline as every set (§23): the level reaches
every prompt that writes or checks, challenges come out easiest first, and the
finish stage writes the story around them."""

from __future__ import annotations

from typing import Any

from app.guards.prompt_injection import PromptInjectionGuard
from app.learning.game import GameKind
from app.learning.generator import Built, GenerationRequest, LearningGenerator, Refused, Stage
from app.learning.model import GenerationUnavailable, Meter
from app.learning.quiz import QuizKind
from app.learning.research import Researcher
from tests.learning_fakes import GOOD_RESULTS, FakeModel, FakeSearch, happy

DIFFICULTY = ["hard", "easy", "medium"]


def challenges() -> Any:
    counter = iter(range(1, 1000))

    def answer(system: str, user: str) -> dict[str, Any]:
        want = int(user.rsplit("Write ", 1)[1].split()[0])
        items = []
        for _ in range(want):
            n = next(counter)
            items.append(
                {
                    "prompt": f"Challenge {n}: which fraction is one half?",
                    "options": [f"1/2 ({n})", f"1/3 ({n})", f"2/3 ({n})"],
                    "answer": 0,
                    "hint": "Two equal parts.",
                    "explanation": "One of two equal parts.",
                    "skill": "chlorophyll",
                    "difficulty": DIFFICULTY[n % 3],
                    "source_ids": ["s1"],
                }
            )
        return {"items": items}

    return answer


STORY = {
    "title": "Momo's Fraction Rescue",
    "style": "quest",
    "world": "rainforest",
    "story": {
        "hook": "The river has flooded! {buddy} needs you.",
        "goal": "Share the food fairly.",
        "chapters": [{"title": "One"}, {"title": "Two"}, {"title": "Three"}],
        "win": "Hooray!",
        "retry": "Again!",
    },
}


def build(answers: dict[str, Any], kind=None) -> tuple[LearningGenerator, FakeModel]:
    meter = Meter()
    model = FakeModel(answers, meter)
    researcher = Researcher(FakeSearch(GOOD_RESULTS), None, PromptInjectionGuard())
    return LearningGenerator(model, researcher, kind or GameKind(), meter), model


async def run(gen: LearningGenerator, **req: Any) -> list[Any]:
    request = GenerationRequest(
        kind="game", topic="fractions", subject="Mathematics", grade_level="year_4", **req
    )
    return [update async for update in gen.run(request)]


async def test_a_game_build_ends_with_its_story_and_its_challenges_easiest_first() -> None:
    gen, model = build(happy(draft=challenges(), wrap=STORY))
    updates = await run(gen, count=9)

    finish = [u for u in updates if isinstance(u, Stage) and u.key == "finish"]
    assert [u.state for u in finish] == ["running", "done"]
    assert finish[0].label == "Writing the story and building the world"
    assert "Momo's Fraction Rescue" in finish[1].detail
    built = updates[-1]
    assert isinstance(built, Built)
    order = [i["difficulty"] for i in built.result.items]
    assert order == sorted(order, key=["easy", "medium", "hard"].index)
    assert built.result.extras["story"]["hook"].startswith("The river has flooded!")
    assert "wrap" in model.asked


async def test_the_level_reaches_the_prompts_that_write_and_check() -> None:
    seen: dict[str, str] = {}

    def draft(system: str, user: str) -> dict[str, Any]:
        seen["draft"] = system
        return challenges()(system, user)

    def verify(system: str, user: str) -> dict[str, Any]:
        seen["verify"] = user
        return {"results": []}

    gen, _ = build(happy(draft=draft, verify=verify, wrap=STORY))
    await run(gen, count=3, level="beginner")
    assert "Level: Beginner" in seen["draft"]
    assert "Level: Beginner" in seen["verify"]


async def test_the_teachers_story_and_choices_reach_the_story_writer() -> None:
    seen: dict[str, str] = {}

    def wrap(system: str, user: str) -> dict[str, Any]:
        seen["user"] = user
        return STORY

    gen, _ = build(happy(draft=challenges(), wrap=wrap))
    updates = await run(
        gen,
        count=3,
        choices={"style": "catch", "world": "auto", "story": "Siti the turtle is lost."},
    )
    assert "Siti the turtle is lost." in seen["user"]
    extras = updates[-1].result.extras
    assert extras["style"] == "catch"
    assert extras["authored"] is True


async def test_a_story_writer_that_cannot_answer_still_leaves_a_playable_game() -> None:
    gen, _ = build(happy(draft=challenges(), wrap=GenerationUnavailable("busy")))
    updates = await run(gen, count=3)
    built = updates[-1]
    assert isinstance(built, Built)
    assert len(built.result.extras["story"]["chapters"]) == 3
    assert built.result.extras["title"]


async def test_kinds_without_a_level_or_an_order_are_unchanged() -> None:
    gen, model = build(happy(), kind=QuizKind())
    updates = await run(gen, count=5)
    assert not [u for u in updates if isinstance(u, Stage) and u.key == "finish"]
    assert "wrap" not in model.asked


async def test_an_unsafe_story_is_refused_before_the_model_is_asked() -> None:
    gen, model = build(happy(draft=challenges(), wrap=STORY))
    updates = await run(
        gen,
        count=3,
        choices={"style": "auto", "world": "auto", "story": "Ali learns how to make a bomb."},
    )
    assert isinstance(updates[-1], Refused)
    assert model.asked == []


async def test_the_makers_story_is_judged_with_the_topic() -> None:
    seen: dict[str, str] = {}

    def check(system: str, user: str) -> dict[str, Any]:
        seen["system"], seen["user"] = system, user
        return {"ok": True, "title": "Fractions", "topic": "Fractions"}

    gen, _ = build(happy(check=check, draft=challenges(), wrap=STORY))
    await run(gen, count=3, choices={"story": "Siti the turtle shares her kuih."})
    assert "Siti the turtle shares her kuih." in seen["user"]
    assert "story the maker wrote" in seen["system"]


async def test_a_teachers_story_survives_a_story_writer_that_cannot_answer() -> None:
    gen, _ = build(happy(draft=challenges(), wrap=GenerationUnavailable("busy")))
    story = "Siti the turtle is lost.\n\nShe swims to the reef.\n\nShe finds her friends."
    updates = await run(gen, count=3, choices={"story": story})
    extras = updates[-1].result.extras
    assert extras["authored"] is True
    assert extras["story"]["hook"] == "Siti the turtle is lost."
    assert [c["intro"] for c in extras["story"]["chapters"]][:2] == [
        "She swims to the reef.",
        "She finds her friends.",
    ]


async def test_challenges_are_written_into_the_games_world_and_story() -> None:
    seen: dict[str, str] = {}

    def draft(system: str, user: str) -> dict[str, Any]:
        seen["draft"] = system
        return challenges()(system, user)

    gen, _ = build(happy(draft=draft, wrap=STORY))
    await run(gen, count=3, choices={"world": "reef", "story": "Siti the turtle is lost."})
    assert "coral reef of Sipadan" in seen["draft"]
    assert "<story>\nSiti the turtle is lost.\n</story>" in seen["draft"]
    assert "never food or things that do not belong" in seen["draft"]
