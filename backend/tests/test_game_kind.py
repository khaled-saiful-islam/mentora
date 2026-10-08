"""The game kind (§23): a challenge, what a player sees, how it is marked, and
the story and world a game is wrapped in."""

from __future__ import annotations

import pytest

from app.learning.base import LearningKind, Skill
from app.learning.enrich import Enriching, Finishing
from app.learning.game import STYLES, WORLDS, Answered, GameKind
from app.learning.model import Meter
from app.learning.registry import build_learning_kinds
from tests.learning_fakes import FakeModel

SKILLS = (Skill("equal-parts", "Equal parts"), Skill("compare", "Comparing fractions"))
SOURCES = {"s1"}


def raw_challenge(**overrides) -> dict:
    return {
        "prompt": "Momo cuts a durian into 4 equal parts and eats 1. What did Momo eat?",
        "options": ["1/4", "1/2", "4/1"],
        "answer": 0,
        "explanation": "One part out of four equal parts is one quarter, 1/4.",
        "hint": "Count all the equal parts first.",
        "skill": "equal-parts",
        "difficulty": "easy",
        "source_ids": ["s1"],
        **overrides,
    }


def story(**overrides) -> dict:
    return {
        "title": "Momo's Durian Rescue",
        "style": "runner",
        "world": "rainforest",
        "story": {
            "hook": "Deep in Taman Negara, the durian tree has lost its fruit!\n\n"
            "{buddy} needs your help to share it fairly.",
            "goal": "Share the durians fairly before sunset.",
            "chapters": [
                {"title": "The River Crossing", "intro": "Cross the river.", "outro": "Across!"},
                {"title": "The Canopy Walk", "intro": "Up we go.", "outro": "What a view."},
                {"title": "The Big Feast", "intro": "Time to share.", "outro": "Everyone ate."},
            ],
            "win": "You did it! Every friend got a fair share.",
            "retry": "So close — {buddy} believes in you. Try again!",
        },
        **overrides,
    }


# --- the challenge ----------------------------------------------------------------


def test_a_game_is_a_learning_kind_and_finishes_with_a_story() -> None:
    kind = GameKind()
    assert isinstance(kind, LearningKind)
    assert isinstance(kind, Enriching)
    assert build_learning_kinds()["game"].label == "Game"


def test_a_good_challenge_is_kept_with_its_hint() -> None:
    item = GameKind().normalise(raw_challenge(), skills=SKILLS, source_ids=SOURCES)
    assert item is not None
    assert item["id"]
    assert item["options"] == ["1/4", "1/2", "4/1"]
    assert item["answer"] == 0
    assert item["hint"] == "Count all the equal parts first."
    assert item["difficulty"] == "easy"


@pytest.mark.parametrize("count", [2, 3, 4])
def test_two_to_four_options_are_fine(count: int) -> None:
    options = ["1/4", "1/2", "3/4", "4/4"][:count]
    item = GameKind().normalise(raw_challenge(options=options), skills=SKILLS, source_ids=SOURCES)
    assert item is not None and len(item["options"]) == count


@pytest.mark.parametrize(
    "overrides",
    [
        {"options": ["1/4"]},  # one option is not a choice
        {"options": ["1/4", "1/2", "3/4", "4/4", "5/4"]},  # five do not fit a lane
        {"options": ["1/4", "1/4", "1/2"]},  # the same twice
        {"options": ["1/4", "x" * 61, "1/2"]},  # too long for a bubble
        {"answer": 3},  # no fourth option
        {"answer": True},
        {"prompt": ""},
    ],
)
def test_a_broken_challenge_is_refused(overrides) -> None:
    assert (
        GameKind().normalise(raw_challenge(**overrides), skills=SKILLS, source_ids=SOURCES) is None
    )


def test_a_player_sees_the_challenge_but_never_the_answer_or_the_hint() -> None:
    kind = GameKind()
    item = kind.normalise(raw_challenge(), skills=SKILLS, source_ids=SOURCES)
    shown = kind.public(item)
    # A hint is asked for, which is what costs points (`AttemptService.hint`).
    assert not {"answer", "explanation", "hint"} & set(shown)
    assert shown["options"] == ["1/4", "1/2", "4/1"]
    assert shown["has_hint"] is True


def test_a_challenge_is_marked_by_the_choice_and_reveals_why() -> None:
    kind = GameKind()
    item = kind.normalise(raw_challenge(), skills=SKILLS, source_ids=SOURCES)
    right = kind.grade(item, {"choice": 0})
    wrong = kind.grade(item, {"choice": 2})
    assert right.correct is True and wrong.correct is False
    assert wrong.reveal == {"answer": 0, "explanation": item["explanation"]}
    assert kind.grade(item, {"choice": "0"}).correct is False
    assert kind.grade(item, {}).correct is False


def test_the_writing_rules_ask_for_short_options_a_hint_and_no_answer_in_the_hint() -> None:
    rules = GameKind().writing_rules()
    assert '"hint"' in rules
    assert "40 characters" in rules
    assert "never gives the answer away" in rules


def test_challenges_are_arranged_easiest_first_keeping_their_order_within_a_level() -> None:
    kind = GameKind()
    items = [
        {"id": "a", "difficulty": "hard"},
        {"id": "b", "difficulty": "easy"},
        {"id": "c", "difficulty": "medium"},
        {"id": "d", "difficulty": "easy"},
        {"id": "e"},
    ]
    assert [i["id"] for i in kind.arrange(items)] == ["b", "d", "c", "e", "a"]


# --- the creator's choices -------------------------------------------------------


def test_choices_keep_what_a_game_understands_and_drop_the_rest() -> None:
    chosen = GameKind().choices(
        {"style": "catch", "world": "reef", "story": "  Ali   finds a map.\n\nIt glows. ", "x": 1}
    )
    assert chosen == {"style": "catch", "world": "reef", "story": "Ali finds a map.\n\nIt glows."}


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ({}, {"style": "auto", "world": "auto", "story": ""}),
        ({"style": "tetris", "world": "mars"}, {"style": "auto", "world": "auto", "story": ""}),
        ({"style": "AUTO", "story": 42}, {"style": "auto", "world": "auto", "story": ""}),
    ],
)
def test_unknown_or_missing_choices_fall_back_to_letting_mentora_decide(given, expected) -> None:
    assert GameKind().choices(given) == expected


def test_a_story_longer_than_the_limit_is_cut_between_words_not_refused() -> None:
    long_story = "word " * 1000
    chosen = GameKind().choices({"story": long_story})
    assert 0 < len(chosen["story"]) <= 2000
    assert not chosen["story"].endswith("wor")


# --- the story and world ---------------------------------------------------------


def test_a_good_story_is_kept_with_its_buddy_placeholder() -> None:
    extras = GameKind().normalise_extras(story())
    assert extras["title"] == "Momo's Durian Rescue"
    assert extras["style"] == "runner" and extras["world"] == "rainforest"
    assert "{buddy}" in extras["story"]["hook"]
    assert "\n\n" in extras["story"]["hook"]
    assert [c["title"] for c in extras["story"]["chapters"]] == [
        "The River Crossing",
        "The Canopy Walk",
        "The Big Feast",
    ]


def test_a_story_short_of_chapters_is_given_plain_ones_so_there_are_always_three() -> None:
    raw = story()
    raw["story"]["chapters"] = raw["story"]["chapters"][:1]
    chapters = GameKind().normalise_extras(raw)["story"]["chapters"]
    assert len(chapters) == 3
    assert chapters[1] == {"title": "Chapter 2", "intro": "", "outro": ""}


def test_extras_never_raise_and_fall_back_to_a_playable_world() -> None:
    for raw in (None, "nonsense", {"style": "tetris", "world": 7, "story": "x"}):
        extras = GameKind().normalise_extras(raw)
        assert extras["style"] in STYLES and extras["world"] in WORLDS
        assert len(extras["story"]["chapters"]) == 3


def test_a_teachers_own_story_is_marked_as_theirs() -> None:
    assert GameKind().normalise_extras(story(authored=True))["authored"] is True
    assert GameKind().normalise_extras(story())["authored"] is False


async def test_the_wrap_tells_the_model_the_teachers_story_and_choices() -> None:
    seen: dict[str, str] = {}

    def wrap(system: str, user: str) -> dict:
        seen["system"], seen["user"] = system, user
        return story(style="match", world="space")

    model = FakeModel({"wrap": wrap}, Meter())
    kind = GameKind()
    item = kind.normalise(raw_challenge(), skills=SKILLS, source_ids=SOURCES)
    finishing = Finishing(
        title="Fractions",
        topic="Fractions",
        grade=None,
        language="en",
        items=(item,),
        sources=(),
        level="beginner",
        choices={"style": "auto", "world": "space", "story": "Ali the astronaut lost his map."},
    )
    extras = await kind.wrap(model, finishing)

    assert "Ali the astronaut lost his map." in seen["user"]
    assert "Keep the teacher's story" in seen["system"]
    assert "space" in seen["user"]
    assert "{buddy}" in seen["system"]
    assert extras["authored"] is True
    assert extras["world"] == "space"  # the teacher chose it: the model cannot move it


async def test_a_style_chosen_by_the_teacher_wins_over_the_models_pick() -> None:
    model = FakeModel({"wrap": story(style="catch")}, Meter())
    finishing = Finishing(
        title="Fractions", topic="Fractions", grade=None, language="en", items=(), sources=(),
        choices={"style": "runner", "world": "auto", "story": ""},
    )  # fmt: skip
    extras = await GameKind().wrap(model, finishing)
    assert extras["style"] == "runner"
    assert extras["authored"] is False


# --- points ------------------------------------------------------------------------


def answered(correct=True, time_ms=10_000, hinted=False, difficulty="easy"):
    return Answered(correct=correct, time_ms=time_ms, hinted=hinted, difficulty=difficulty)


def test_a_right_answer_is_worth_more_the_harder_it_is() -> None:
    kind = GameKind()
    no_timer = {"grade_level": "year_4", "level": "beginner"}
    assert kind.points([answered(difficulty="easy")], **no_timer) == 100
    assert kind.points([answered(difficulty="medium")], **no_timer) == 125
    assert kind.points([answered(difficulty="hard")], **no_timer) == 150
    assert kind.points([answered(correct=False)], **no_timer) == 0


def test_a_run_of_right_answers_builds_a_combo_up_to_a_cap() -> None:
    kind = GameKind()
    run = [answered() for _ in range(8)]
    # 100 each, plus 10, 20, 30, 40, 50, 50, 50 for the run after the first.
    assert kind.points(run, grade_level="year_4", level="beginner") == 800 + 250


def test_a_wrong_answer_breaks_the_combo() -> None:
    kind = GameKind()
    played = [answered(), answered(), answered(correct=False), answered()]
    assert kind.points(played, grade_level="year_4", level="beginner") == 100 + 110 + 0 + 100


def test_asking_for_a_hint_costs_a_little_but_a_right_answer_still_scores() -> None:
    kind = GameKind()
    assert kind.points([answered(hinted=True)], grade_level="year_4", level="beginner") == 60


def test_quick_answers_earn_a_speed_bonus_only_when_the_game_is_timed() -> None:
    kind = GameKind()
    quick = [answered(time_ms=2_000)]
    # Year 4: 20 s. Two seconds in: 50 × (1 − 2/20) = 45.
    assert kind.points(quick, grade_level="year_4", level="intermediate") == 145
    assert kind.points(quick, grade_level="year_4", level="beginner") == 100
    # Year 2 gets 30 s, so the same two seconds earn a little more.
    assert kind.points(quick, grade_level="year_2", level="advanced") == 147


def test_an_impossible_answer_time_earns_no_more_than_a_one_second_one() -> None:
    kind = GameKind()
    instant = kind.points([answered(time_ms=0)], grade_level="form_2", level="advanced")
    second = kind.points([answered(time_ms=1_000)], grade_level="form_2", level="advanced")
    assert instant == second


@pytest.mark.parametrize(
    ("grade_level", "level", "seconds"),
    [
        ("year_2", "intermediate", 30),
        ("year_5", "advanced", 20),
        ("form_3", None, 15),
        ("year_5", "beginner", None),
    ],
)
def test_the_timer_follows_the_year_and_beginners_have_none(grade_level, level, seconds) -> None:
    assert GameKind().seconds(grade_level=grade_level, level=level) == seconds


def test_a_half_point_rounds_up_as_the_game_counts_it() -> None:
    # Year 4 has 20 s: 5 s in earns 50 × (1 − 5/20) = 37.5 → 38; 3.5 s, 41.25 → 41.
    kind = GameKind()
    timed = {"grade_level": "year_4", "level": "intermediate"}
    assert kind.points([answered(time_ms=5_000)], **timed) == 138
    assert kind.points([answered(time_ms=3_500)], **timed) == 141
    # 42.5 is where rounding to even and rounding up part: 50 × (1 − 3/20).
    assert kind.points([answered(time_ms=3_000)], **timed) == 143


def test_a_long_story_is_cut_at_a_paragraph_or_a_sentence_never_mid_word() -> None:
    # A paragraph break past halfway is where it stops; before that, the last
    # sentence that fits, so less is lost.
    first = "Ali finds a map. " * 70  # about 1 200 characters
    cut = GameKind().choices({"story": f"{first.strip()}\n\n" + "Then more. " * 300})["story"]
    assert cut == first.strip()
    short = "Ali finds a map. " * 10
    early = GameKind().choices({"story": f"{short.strip()}\n\n" + "Then more. " * 300})["story"]
    assert early.startswith(short.strip()) and early.endswith("Then more.") and len(early) <= 2000
    long_words = "Ali walks along the long river bank " * 80
    words = GameKind().choices({"story": long_words})["story"]
    assert len(words) <= 2000 and words == words.strip()
    assert long_words.startswith(words) and long_words[len(words)] == " "


def test_the_story_prompts_never_give_the_buddy_a_species_or_a_gender() -> None:
    from app.learning import game_prompts

    wrap, _ = game_prompts.wrap_game(
        title="T", topic="t", grade=None, language="en", level=None,
        style="auto", world="auto", story="", outline="",
    )  # fmt: skip
    draft, _ = game_prompts.draft_story(
        topic="t", subject=None, grade=None, language="en", level=None, world="auto"
    )
    for system in (wrap, draft):
        assert "never call {buddy} he, she" in system


def test_the_story_has_no_friend_but_the_buddy() -> None:
    from app.learning import game_prompts

    system, _ = game_prompts.wrap_game(
        title="T", topic="t", grade=None, language="en", level=None,
        style="auto", world="auto", story="", outline="",
    )  # fmt: skip
    assert "invent no other animal friend" in system
