"""The game kind (§26): an island, the round it is played in and that round's
rules, falling back to a Match Up, what a player sees, how it is marked from
what the round reports, points, and the story a game is told in."""

from __future__ import annotations

import pytest

from app.learning.base import LearningKind, Skill
from app.learning.enrich import Enriching, Finishing
from app.learning.game import FALLBACK_TASK, LIMITS, Answered, GameKind, piece_names
from app.learning.model import GenerationUnavailable, Meter
from app.learning.registry import build_learning_kinds, switched_on
from tests.learning_fakes import FakeModel

SKILLS = (Skill("light", "Light energy"), Skill("water", "Water"))
SOURCES = {"s1"}

SORT = {
    "baskets": [{"label": "Takes in", "icon": "⬇️"}, {"label": "Gives out", "icon": "⬆️"}],
    "cards": [
        {"text": "Water", "icon": "💧", "basket": "Takes in", "why": "Roots drink water."},
        {"text": "Sunlight", "icon": "☀️", "basket": "takes in", "why": "Leaves catch light."},
        {"text": "Carbon dioxide", "icon": "💨", "basket": "Takes in"},
        {"text": "Oxygen", "icon": "🫧", "basket": "Gives out", "why": "Leaves give it out."},
    ],
}
PAIRS = [
    {"left": "Roots", "right": "drink water", "why": "Roots take in water from the soil."},
    {
        "left": "Leaves",
        "right": "catch sunlight",
        "why": "Leaves hold the green that catches light.",
    },
    {"left": "Stomata", "right": "let air in", "why": "Tiny holes let carbon dioxide in."},
]
STEPS = [
    {"text": "The sun heats the sea", "icon": "☀️", "why": "Heat comes first."},
    {"text": "Water turns to vapour", "icon": "💨", "why": "Heat makes water evaporate."},
    {"text": "Vapour cools into clouds", "icon": "☁️", "why": "High up, vapour cools."},
    {"text": "Rain falls", "icon": "🌧️", "why": "Heavy clouds let the water fall."},
]


def raw_island(**overrides) -> dict:
    return {
        "learn": "Plants take some things in and give others out.",
        "icon": "🌱",
        "play": "sort",
        "task": "Sort what the plant takes in and what it gives out!",
        "sort": SORT,
        "pairs": PAIRS,
        "explanation": "Plants take in water, light and carbon dioxide, and give out oxygen.",
        "hint": "What does the plant need to make its food?",
        "skill": "light",
        "difficulty": "easy",
        "source_ids": ["s1", "s9"],
        **overrides,
    }


def island(**overrides) -> dict:
    item = GameKind().normalise(raw_island(**overrides), skills=SKILLS, source_ids=SOURCES)
    assert item is not None
    return item


def story(**overrides) -> dict:
    return {
        "title": "Save the Padi",
        "world": "kampung",
        "story": {"hook": "The padi is wilting!", "goal": "Grow it back.", "win": "Hooray!"},
        **overrides,
    }


def test_a_game_is_a_learning_kind_of_islands_with_a_story_and_a_switch() -> None:
    kind = GameKind()
    assert isinstance(kind, LearningKind)
    assert isinstance(kind, Enriching)
    assert not hasattr(kind, "coded")  # no code is written for a game (§26)
    assert build_learning_kinds()["game"].item_noun_plural == "islands"
    assert (kind.min_count, kind.default_count, kind.max_count) == (3, 4, 6)
    assert kind.batch >= kind.max_count  # the whole lesson written in one go

    class Off:
        games_enabled = False

    assert not switched_on(kind, Off())
    assert switched_on(build_learning_kinds()["quiz"], Off())


def test_a_sort_island_is_kept_with_every_card_in_its_basket() -> None:
    item = island()
    assert item["play"] == "sort" and item["task"].startswith("Sort what")
    baskets = item["sort"]["baskets"]
    assert [b["label"] for b in baskets] == ["Takes in", "Gives out"]
    by_card = {c["text"]: c["basket"] for c in item["sort"]["cards"]}
    # A basket named any way at all — its label in any case, or its id.
    assert by_card["Sunlight"] == baskets[0]["id"] and by_card["Oxygen"] == baskets[1]["id"]
    # A card with no why of its own says what the island teaches.
    co2 = next(c for c in item["sort"]["cards"] if c["text"] == "Carbon dioxide")
    assert co2["why"] == item["explanation"]
    assert item["source_ids"] == ["s1"]
    # The pairs are kept too: the island's Match Up, should it be wanted.
    assert len(item["match"]["pairs"]) == 3


@pytest.mark.parametrize("missing", ["learn", "explanation"])
def test_an_island_without_its_idea_or_lesson_is_refused(missing: str) -> None:
    raw = raw_island()
    raw.pop(missing)
    assert GameKind().normalise(raw, skills=SKILLS, source_ids=SOURCES) is None


@pytest.mark.parametrize(
    "sort",
    [
        # A basket no card goes in.
        {**SORT, "baskets": [*SORT["baskets"], {"label": "Keeps"}]},
        # One basket is no sorting at all.
        {**SORT, "baskets": SORT["baskets"][:1]},
        # Too few cards, once a card in no basket is dropped.
        {**SORT, "cards": [*SORT["cards"][:1], {"text": "Soil", "basket": "Nowhere"}]},
    ],
)
def test_a_sort_that_breaks_its_rules_is_played_as_a_match_up(sort: dict) -> None:
    item = island(sort=sort)
    assert item["play"] == "match"
    assert item["task"] == FALLBACK_TASK  # the sorting task would not fit
    assert "sort" not in item
    assert [p["left"] for p in item["match"]["pairs"]] == ["Roots", "Leaves", "Stomata"]


def test_an_island_with_no_round_that_keeps_its_rules_is_refused() -> None:
    raw = raw_island(sort={"baskets": []}, pairs=PAIRS[:2])
    assert GameKind().normalise(raw, skills=SKILLS, source_ids=SOURCES) is None


def test_a_line_up_keeps_its_steps_in_order_and_says_each_once() -> None:
    item = island(play="order", order={"steps": [*STEPS, {"text": "rain falls"}]}, sort=None)
    assert item["play"] == "order"
    assert [s["text"] for s in item["order"]["steps"]] == [s["text"] for s in STEPS]
    assert [s["id"] for s in item["order"]["steps"]] == ["s1", "s2", "s3", "s4"]
    # Too many steps is refused, not cut: what was left would not be the process.
    many = {"steps": [{"text": f"Step {n}"} for n in range(12)]}
    assert island(play="order", order=many)["play"] == "match"


def test_a_match_up_is_one_to_one() -> None:
    pairs = [
        *PAIRS,
        {"left": "roots", "right": "hold the soil"},
        {"left": "Sun", "right": "Drink water"},
    ]
    item = island(play="match", pairs=pairs, task="Join each part to its job!")
    assert item["play"] == "match" and item["task"] == "Join each part to its job!"
    assert [p["left"] for p in item["match"]["pairs"]] == ["Roots", "Leaves", "Stomata"]


def test_an_editor_sends_an_island_back_and_it_comes_back_the_same() -> None:
    kind, item = GameKind(), island()
    again = kind.normalise(item, skills=SKILLS, source_ids=SOURCES)
    assert again == item
    # An edit to a card keeps its id, so a slip recorded on it still names it.
    edited = {**item, "sort": {**item["sort"], "cards": [
        {**item["sort"]["cards"][0], "text": "Rain water"}, *item["sort"]["cards"][1:],
    ]}}  # fmt: skip
    kept = kind.normalise(edited, skills=SKILLS, source_ids=SOURCES)
    assert kept is not None and kept["sort"]["cards"][0]["id"] == item["sort"]["cards"][0]["id"]


def test_a_player_meets_the_idea_the_task_and_the_round_but_not_the_hint_or_lesson() -> None:
    item = island()
    shown = GameKind().public(item)
    assert shown == {
        "id": item["id"],
        "learn": "Plants take some things in and give others out.",
        "icon": "🌱",
        "play": "sort",
        "task": "Sort what the plant takes in and what it gives out!",
        "sort": item["sort"],
        "has_hint": True,
        "skill": "light",
        "difficulty": "easy",
    }


def test_an_island_is_marked_from_what_the_round_reported_and_always_teaches() -> None:
    kind, item = GameKind(), island()
    cleared = kind.grade(item, {"done": True, "tries": 2})
    missed = kind.grade(item, {"done": False})
    odd = kind.grade(item, {"done": "yes"})
    assert cleared.correct and not missed.correct and not odd.correct
    assert missed.reveal == {"explanation": item["explanation"], "task": item["task"]}


def test_points_pay_for_harder_islands_no_slips_and_cost_a_hint() -> None:
    points = GameKind().points
    first_go = Answered(correct=True, hinted=False, difficulty="easy", tries=1)
    assert points([first_go], grade_level=None, level=None) == 125
    hard_later = Answered(correct=True, hinted=False, difficulty="hard", tries=3)
    assert points([hard_later], grade_level=None, level=None) == 150
    hinted = Answered(correct=True, hinted=True, difficulty="medium", tries=1)
    assert points([hinted], grade_level=None, level=None) == 110
    missed = Answered(correct=False, hinted=True, difficulty="hard", tries=4)
    assert points([missed], grade_level=None, level=None) == 0
    # Cleared after the buddy showed a move: never zero, never the full count.
    shown = Answered(correct=True, hinted=False, difficulty="hard", tries=3, shown=True)
    assert points([shown], grade_level=None, level=None) == 50


def test_the_next_batch_is_told_each_islands_idea_and_round() -> None:
    told = GameKind().summary(island())
    assert "Plants take some things in" in told and "Sort It Out" in told


def test_islands_are_played_simplest_first_keeping_their_order_otherwise() -> None:
    kind = GameKind()
    levels = ["hard", "easy", "easy"]
    items = [island(difficulty=d, learn=f"Idea {n}.") for n, d in enumerate(levels)]
    assert [i["learn"] for i in kind.arrange(items)] == ["Idea 1.", "Idea 2.", "Idea 0."]


def test_the_writing_rules_fit_a_round_to_each_idea_at_the_years_size() -> None:
    rules = GameKind().rules_for({"world": "reef", "story": "Siti the turtle is lost."})
    assert '"play": "sort|order|match"' in rules and '"pairs"' in rules and '"why"' in rules
    assert "ONE idea" in rules and "ALWAYS `pairs`" in rules
    assert "Year 1–3: 4 to 6 cards" in rules and "Form 1–5" in rules
    assert "words only" in rules  # the picture goes in `icon`, not in the text too
    assert "never a warning" in rules
    assert "Sipadan" in rules and "Siti the turtle is lost." in rules
    assert GameKind().check_focus.startswith("These items are islands")
    # The maker's own choice of templates is the only one offered.
    only = GameKind().rules_for({"plays": ["order"]})
    assert "Use only order." in only and "`sort` when" not in only


def test_choices_keep_the_setting_the_story_and_the_templates_and_drop_the_rest() -> None:
    chosen = GameKind().choices(
        {"world": "SPACE", "story": "A rocket.", "plays": ["match", "sort", "x"], "style": "runner"}
    )
    assert chosen == {"world": "space", "story": "A rocket.", "plays": ["sort", "match"]}
    assert GameKind().choices({"world": "mars", "plays": "order, match"}) == {
        "world": "auto",
        "story": "",
        "plays": ["order", "match"],
    }


def test_a_long_story_is_cut_between_words_never_refused() -> None:
    long = "Siti swims. " * 400
    story_kept = GameKind().choices({"story": long})["story"]
    assert len(story_kept) <= LIMITS["story"]
    assert story_kept.endswith(".")


def test_a_teacher_reads_an_islands_pieces_by_name() -> None:
    sorted_names = piece_names(island())
    assert sorted_names["c4"] == "Oxygen (belongs in Gives out)"
    assert piece_names(island(play="order", order={"steps": STEPS}))["s2"] == (
        "Water turns to vapour (step 2)"
    )
    assert piece_names(island(play="match"))["p1"] == "Roots — drink water"
    assert piece_names({"prompt": "A quiz question?"}) == {}


async def test_the_story_keeps_the_makers_and_its_setting() -> None:
    seen: dict[str, str] = {}

    def wrap(system: str, user: str) -> dict:
        seen["system"], seen["user"] = system, user
        return story(world="space")

    finishing = Finishing(
        title="Plants", topic="Photosynthesis", grade=None, language="en",
        items=(island(),), sources=(), level="beginner",
        choices={"world": "kampung", "story": "Pak Ali's padi is wilting."},
    )  # fmt: skip
    extras = await GameKind().wrap(FakeModel({"wrap": wrap}, Meter()), finishing)
    assert "Pak Ali's padi is wilting." in seen["user"]
    assert "Keep the teacher's story" in seen["system"]
    assert "Plants take some things in" in seen["user"] and "Sort It Out" in seen["user"]
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


def test_the_story_plan_keeps_its_character_panels_and_a_beat_for_each_island() -> None:
    raw = story(
        character={"name": "Atuk Hassan", "about": "a padi farmer in Kedah"},
        story={
            "hook": "The padi is wilting!",
            "opening": [{"who": "Atuk Hassan", "says": "Help!"}, {"says": "We will!"}, "x"],
            "ending": [{"who": "Atuk Hassan", "says": "Thank you!"}],
        },
        beats=[
            {"island": "m1", "before": [{"who": "{buddy}", "says": "Light!"}], "after": []},
            {"island": "", "before": [{"says": "lost"}]},
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
    # An editor sends the beats back keyed by island: kept the same way.
    assert GameKind().normalise_extras(extras)["beats"] == extras["beats"]


def test_a_finished_game_is_described_by_its_title_and_setting() -> None:
    assert GameKind().finish_detail([], story()) == "Save the Padi · Kampung festival"


def test_the_story_prompts_never_give_the_buddy_a_species_or_a_gender() -> None:
    from app.learning import game_prompts

    wrap, _ = game_prompts.wrap_game(
        title="t", topic="t", grade=None, language="en", level=None, world="reef",
        story="", outline="",
    )  # fmt: skip
    assert "Never say what kind of animal {buddy} is" in wrap
    assert "the only animal friend" in wrap and "invent no" in wrap
    assert "a beat before and after EVERY island" in wrap
