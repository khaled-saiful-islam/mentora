"""The game kind (§24): a mission, what a player sees, how it is marked from
what the game reports, points, and the story a game is told in."""

from __future__ import annotations

import pytest

from app.core.grades import grade_for
from app.learning.base import LearningKind, Skill
from app.learning.enrich import Enriching, Finishing
from app.learning.game import LIMITS, Answered, GameKind
from app.learning.model import GenerationUnavailable, Meter
from app.learning.registry import build_learning_kinds
from tests.learning_fakes import FakeModel

SKILLS = (Skill("light", "Light energy"), Skill("water", "Water"))
SOURCES = {"s1"}


def raw_mission(**overrides) -> dict:
    return {
        "learn": "Leaves are tiny kitchens: they cook food from sunlight.",
        "icon": "☀️",
        "control": "the sun slider",
        "guide": "Slide the sun all the way up!",
        "goal": "Grow the padi plant to full height before sunset.",
        "win": "The plant reaches 100% height while sunlight and water are above half.",
        "explanation": "Plants use sunlight and water to make their own food.",
        "hint": "Try giving the plant more sunlight.",
        "skill": "light",
        "difficulty": "easy",
        "source_ids": ["s1", "s9"],
        **overrides,
    }


def mission(**overrides) -> dict:
    item = GameKind().normalise(raw_mission(**overrides), skills=SKILLS, source_ids=SOURCES)
    assert item is not None
    return item


def story(**overrides) -> dict:
    return {
        "title": "Save the Padi",
        "world": "kampung",
        "story": {"hook": "The padi is wilting!", "goal": "Grow it back.", "win": "Hooray!"},
        **overrides,
    }


def test_a_game_is_a_coded_learning_kind_with_a_story() -> None:
    kind = GameKind()
    assert isinstance(kind, LearningKind)
    assert isinstance(kind, Enriching)
    assert kind.coded is True
    assert build_learning_kinds()["game"].item_noun_plural == "missions"
    assert (kind.min_count, kind.default_count, kind.max_count) == (3, 4, 6)


def test_a_good_mission_is_kept_and_its_unknown_sources_dropped() -> None:
    item = mission()
    assert item["goal"].startswith("Grow the padi")
    assert item["source_ids"] == ["s1"]
    assert item["difficulty"] == "easy"


@pytest.mark.parametrize("missing", ["goal", "win", "explanation", "learn"])
def test_a_mission_without_its_goal_check_or_lesson_is_refused(missing: str) -> None:
    raw = raw_mission()
    raw.pop(missing)
    assert GameKind().normalise(raw, skills=SKILLS, source_ids=SOURCES) is None


def test_a_player_meets_the_missions_beats_but_not_its_check_lesson_or_hint() -> None:
    shown = GameKind().public(mission())
    assert shown == {
        "id": shown["id"],
        "learn": "Leaves are tiny kitchens: they cook food from sunlight.",
        "icon": "☀️",
        "control": "the sun slider",
        "guide": "Slide the sun all the way up!",
        "goal": "Grow the padi plant to full height before sunset.",
        "has_hint": True,
        "skill": "light",
        "difficulty": "easy",
    }


def test_a_mission_is_marked_from_what_the_game_reported_and_always_teaches() -> None:
    kind, item = GameKind(), mission()
    reached = kind.grade(item, {"done": True, "tries": 2})
    missed = kind.grade(item, {"done": False})
    odd = kind.grade(item, {"done": "yes"})
    assert reached.correct and not missed.correct and not odd.correct
    assert missed.reveal["explanation"].startswith("Plants use sunlight")


def test_points_pay_for_harder_missions_first_goes_and_cost_a_hint() -> None:
    points = GameKind().points
    first_go = Answered(correct=True, hinted=False, difficulty="easy", tries=1)
    assert points([first_go], grade_level=None, level=None) == 125
    hard_later = Answered(correct=True, hinted=False, difficulty="hard", tries=3)
    assert points([hard_later], grade_level=None, level=None) == 150
    hinted = Answered(correct=True, hinted=True, difficulty="medium", tries=1)
    assert points([hinted], grade_level=None, level=None) == 110
    missed = Answered(correct=False, hinted=True, difficulty="hard", tries=4)
    assert points([missed], grade_level=None, level=None) == 0
    # Reached after the buddy showed how: never zero, never the full count.
    shown = Answered(correct=True, hinted=False, difficulty="hard", tries=3, shown=True)
    assert points([shown], grade_level=None, level=None) == 50


def test_two_missions_adding_the_same_control_are_the_same_mission() -> None:
    kind = GameKind()
    assert kind.distinct(mission(control="The sun slider")) == kind.distinct(
        mission(control="sun slider")
    )
    assert kind.distinct(mission(control="the rain cloud")) != kind.distinct(mission())
    # The thing controlled, whatever widget it is.
    assert kind.distinct(mission(control="the sun")) == kind.distinct(mission(control="sun slider"))
    leaf, sun = mission(control="leaf size slider"), mission(control="sun")
    assert kind.distinct(leaf) != kind.distinct(sun)
    cutter, kuih_cutter = mission(control="the cutter"), mission(control="the kuih cutter")
    assert kind.distinct(cutter) == kind.distinct(kuih_cutter)
    assert kind.batch >= kind.max_count  # the whole lesson written in one go


def test_the_next_batch_is_told_each_missions_idea_and_control() -> None:
    half = mission(learn="A half is 1 of 2 equal parts.", control="the cutter")
    told = GameKind().summary(half)
    assert "A half is 1 of 2 equal parts." in told and "the cutter" in told


def test_missions_are_played_simplest_first_keeping_their_order_otherwise() -> None:
    kind = GameKind()
    levels = ["hard", "easy", "easy"]
    items = [mission(difficulty=d, goal=f"Goal {n}.") for n, d in enumerate(levels)]
    assert [i["goal"] for i in kind.arrange(items)] == ["Goal 1.", "Goal 2.", "Goal 0."]


def test_the_writing_rules_ask_for_one_idea_at_a_time_never_options_to_pick() -> None:
    rules = GameKind().rules_for({"world": "reef", "story": "Siti the turtle is lost."})
    assert '"goal"' in rules and '"win"' in rules and '"learn"' in rules
    assert "ONE idea" in rules and "adds ONE new control" in rules
    assert "never options" in rules.lower()
    assert "Sipadan" in rules
    assert "Siti the turtle is lost." in rules
    assert GameKind().check_focus.startswith("These items are missions")


def test_choices_keep_where_it_happens_and_the_story_and_drop_the_rest() -> None:
    chosen = GameKind().choices({"world": "SPACE", "story": "A rocket.", "style": "runner"})
    assert chosen == {"world": "space", "story": "A rocket."}
    assert GameKind().choices({"world": "mars"})["world"] == "auto"


def test_a_long_story_is_cut_between_words_never_refused() -> None:
    long = "Siti swims. " * 400
    story_kept = GameKind().choices({"story": long})["story"]
    assert len(story_kept) <= LIMITS["story"]
    assert story_kept.endswith(".")


async def test_the_story_keeps_the_makers_and_its_setting() -> None:
    seen: dict[str, str] = {}

    def wrap(system: str, user: str) -> dict:
        seen["system"], seen["user"] = system, user
        return story(world="space")

    finishing = Finishing(
        title="Plants", topic="Photosynthesis", grade=None, language="en",
        items=(mission(),), sources=(), level="beginner",
        choices={"world": "kampung", "story": "Pak Ali's padi is wilting."},
    )  # fmt: skip
    extras = await GameKind().wrap(FakeModel({"wrap": wrap}, Meter()), finishing)
    assert "Pak Ali's padi is wilting." in seen["user"]
    assert "Keep the teacher's story" in seen["system"]
    assert "Grow the padi plant" in seen["user"]
    assert extras["world"] == "kampung"  # the maker chose it
    assert extras["authored"] is True
    assert extras["story"]["hook"] == "The padi is wilting!"


async def test_a_story_model_that_fails_keeps_the_makers_story_as_written() -> None:
    finishing = Finishing(
        title="Plants", topic="Photosynthesis", grade=None, language="en", items=(), sources=(),
        choices={"world": "auto", "story": "Pak Ali's padi is wilting.\n\nIt grew!"},
    )  # fmt: skip
    model = FakeModel({"wrap": GenerationUnavailable("down")}, Meter())
    extras = await GameKind().wrap(model, finishing)
    assert extras["story"]["hook"] == "Pak Ali's padi is wilting."
    assert extras["story"]["win"] == "It grew!"


def test_extras_never_raise_and_fall_back_to_a_setting() -> None:
    extras = GameKind().normalise_extras("nonsense")
    assert extras["world"] == "rainforest"
    assert extras["story"] == {"hook": "", "goal": "", "win": "", "opening": [], "ending": []}
    assert extras["beats"] == {} and extras["character"] == {"name": "", "about": ""}


def test_the_story_plan_keeps_its_character_panels_and_a_beat_for_each_mission() -> None:
    raw = story(
        character={"name": "Atuk Hassan", "about": "a padi farmer in Kedah"},
        story={
            "hook": "The padi is wilting!",
            "opening": [{"who": "Atuk Hassan", "says": "Help!"}, {"says": "We will!"}, "x"],
            "ending": [{"who": "Atuk Hassan", "says": "Thank you!"}],
        },
        beats=[
            {"mission": "m1", "before": [{"who": "{buddy}", "says": "Light!"}], "after": []},
            {"mission": "", "before": [{"says": "lost"}]},
        ],
    )
    extras = GameKind().normalise_extras(raw)
    assert extras["character"]["name"] == "Atuk Hassan"
    assert extras["story"]["opening"] == [
        {"who": "Atuk Hassan", "says": "Help!"},
        {"who": "{buddy}", "says": "We will!"},
    ]
    assert extras["beats"] == {
        "m1": {"before": [{"who": "{buddy}", "says": "Light!"}], "after": []}
    }
    # An editor sends the beats back keyed by mission: kept the same way.
    assert GameKind().normalise_extras(extras)["beats"] == extras["beats"]


def test_a_finished_game_is_described_by_its_title_and_setting() -> None:
    assert GameKind().finish_detail([], story()) == "Save the Padi · Kampung festival"


def test_the_games_writer_is_given_the_checked_missions_story_and_setting() -> None:
    spec = GameKind().sim_spec(
        title="Plants", topic="Photosynthesis", grade=grade_for("year_5"), language="en",
        level="advanced", items=[mission()], extras=story(),
    )  # fmt: skip
    assert spec.title == "Save the Padi"
    assert spec.level == "advanced"
    assert "kampung festival" in spec.setting
    assert spec.hook == "The padi is wilting!"
    assert "Year 5" in spec.audience
    assert spec.missions[0]["win"].startswith("The plant reaches")
    assert spec.missions[0]["guide"] == "Slide the sun all the way up!"
    assert "source_ids" not in spec.missions[0] and "hint" not in spec.missions[0]


def test_the_story_prompts_never_give_the_buddy_a_species_or_a_gender() -> None:
    from app.learning import game_prompts

    wrap, _ = game_prompts.wrap_game(
        title="t", topic="t", grade=None, language="en", level=None, world="reef",
        story="", outline="",
    )  # fmt: skip
    assert "Never say what kind of animal {buddy} is" in wrap
    assert "the only animal friend" in wrap and "invent no" in wrap
    assert "a beat before and after EVERY mission" in wrap
