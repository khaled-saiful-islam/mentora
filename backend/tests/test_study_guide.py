"""Study guides: a section's shape, its pictures, and the finishing stage."""

from __future__ import annotations

from typing import Any

import pytest

from app.guards.prompt_injection import PromptInjectionGuard
from app.learning.base import Skill
from app.learning.enrich import Enriching, Finishing
from app.learning.generator import (
    Built,
    GenerationRequest,
    LearningGenerator,
    Pictured,
    Stage,
)
from app.learning.model import Meter
from app.learning.research import Picture, Researcher
from app.learning.study_guide import StudyGuideKind, clean_paragraphs, picture_from
from app.providers.base import ToolResult
from tests.learning_fakes import GOOD_RESULTS, FakeModel, FakeSearch, all_ok, happy

KIND = StudyGuideKind()
SKILLS = (Skill("water-cycle", "The water cycle"), Skill("clouds", "Clouds"))


def section(n: int = 1, **overrides: Any) -> dict[str, Any]:
    return {
        "heading": f"Part {n}: where rain comes from",
        "explain": {
            "simple": "The Sun warms water. It rises.",
            "core": "The Sun warms the sea.\n\nSome of the water rises as vapour.",
            "stretch": "Energy from the Sun lets molecules escape the surface as vapour.",
        },
        "points": ["The Sun gives the energy.", "Vapour is invisible."],
        "terms": [{"term": "vapour", "meaning": "Water as a gas.", "translation": "wap"}],
        "hook": "Sun up, water up!",
        "fact": "A cloud can weigh as much as 100 elephants.",
        "example": "Puddles in Kuala Lumpur dry up after the afternoon rain.",
        "image_query": "evaporation diagram",
        "prompt": f"Question {n}: what warms the sea?",
        "options": [f"The Sun {n}", f"The Moon {n}", f"Fish {n}", f"Rocks {n}"],
        "answer": 0,
        "explanation": "The Sun's heat makes water evaporate.",
        "skill": "water-cycle",
        "difficulty": "easy",
        "source_ids": ["s1"],
        **overrides,
    }


def normalised(**overrides: Any) -> dict[str, Any] | None:
    return KIND.normalise(section(**overrides), skills=SKILLS, source_ids={"s1"})


# --- a section --------------------------------------------------------------


def test_a_whole_section_is_kept_with_its_paragraphs() -> None:
    item = normalised()
    assert item is not None
    assert item["heading"] == "Part 1: where rain comes from"
    assert item["explain"]["core"] == "The Sun warms the sea.\n\nSome of the water rises as vapour."
    assert item["terms"] == [{"term": "vapour", "meaning": "Water as a gas.", "translation": "wap"}]
    assert item["answer"] == 0 and item["skill"] == "water-cycle"


@pytest.mark.parametrize(
    "broken",
    [
        {"heading": ""},
        {"explain": {"simple": "only simple"}},
        {"explain": "not an object"},
        {"options": ["one", "two", "three"]},
        {"answer": 7},
        {"prompt": ""},
    ],
)
def test_a_section_missing_what_it_needs_is_refused(broken: dict[str, Any]) -> None:
    assert normalised(**broken) is None


def test_a_missing_easier_or_harder_version_falls_back_to_the_core() -> None:
    item = normalised(explain={"core": "Just the core."})
    assert item is not None
    assert item["explain"] == {
        "simple": "Just the core.",
        "core": "Just the core.",
        "stretch": "Just the core.",
    }


def test_a_translation_that_is_the_same_word_is_dropped() -> None:
    item = normalised(terms=[{"term": "Sun", "meaning": "Our star.", "translation": "sun"}])
    assert item is not None and item["terms"][0]["translation"] == ""


def test_the_check_answer_is_hidden_until_answered() -> None:
    item = normalised(image={"image": "https://img.test/a.png", "page": "https://page.test"})
    assert item is not None
    shown = KIND.public(item)
    for secret in ("answer", "explanation", "alternatives", "image_query"):
        assert secret not in shown
    assert (
        shown["explain"]
        and shown["options"]
        and shown["image"]["image"] == "https://img.test/a.png"
    )


def test_the_check_is_graded_like_a_quiz_question() -> None:
    item = normalised()
    assert item is not None
    assert KIND.grade(item, {"choice": 0}).correct is True
    assert KIND.grade(item, {"choice": 2}).correct is False
    assert KIND.grade(item, {"choice": True}).correct is False


# --- pictures ---------------------------------------------------------------


@pytest.mark.parametrize(
    "unsafe",
    [
        {"image": "http://plain.test/a.png"},
        {"image": "javascript:alert(1)"},
        {"image": "data:image/png;base64,AAAA"},
        {},
        "https://not-an-object.test",
    ],
)
def test_only_https_pictures_are_kept(unsafe: Any) -> None:
    assert picture_from(unsafe) is None


def test_a_picture_keeps_its_credit_and_drops_an_unsafe_page() -> None:
    kept = picture_from({"image": "https://i.test/x.png", "page": "javascript:x", "source": "NASA"})
    assert kept == {
        "image": "https://i.test/x.png",
        "thumbnail": "https://i.test/x.png",
        "page": "",
        "source": "NASA",
        "title": "",
    }


class Pictures:
    def __init__(self, found: list[Picture]) -> None:
        self.found = found
        self.asked: list[str] = []

    async def pictures(self, query: str, *, limit: int) -> list[Picture]:
        self.asked.append(query)
        return self.found[:limit]


def picture(n: int) -> Picture:
    return Picture(
        f"https://i.test/{n}.png",
        f"https://t.test/{n}.png",
        f"https://p.test/{n}",
        "Site",
        f"Pic {n}",
    )


async def test_each_section_gets_a_picture_and_spares_to_swap_in() -> None:
    item = normalised()
    assert item is not None
    finder = Pictures([picture(1), picture(2), picture(3)])
    [done] = await KIND.illustrate([item], topic="the water cycle", pictures=finder)
    assert done["image"]["image"] == "https://i.test/1.png"
    assert [p["image"] for p in done["alternatives"]] == [
        "https://i.test/2.png",
        "https://i.test/3.png",
    ]
    assert finder.asked == ["evaporation diagram the water cycle"]


async def test_a_section_with_a_picture_or_no_results_is_left_alone() -> None:
    chosen = normalised(image={"image": "https://mine.test/a.png"})
    bare = normalised()
    assert chosen is not None and bare is not None
    finder = Pictures([])
    kept, untouched = await KIND.illustrate([chosen, bare], topic="rain", pictures=finder)
    assert kept["image"]["image"] == "https://mine.test/a.png"
    assert untouched["image"] is None
    assert len(finder.asked) == 1


# --- the opening and ending -------------------------------------------------


def test_extras_are_cleaned_and_a_half_written_challenge_is_dropped() -> None:
    extras = KIND.normalise_extras(
        {
            "big_question": "Where does rain come from?",
            "intro": "Rain is water on a journey.\n\nLet's follow it.",
            "summary": ["The Sun warms water.", "", "Vapour cools into clouds."],
            "challenge": {"title": "Make a cloud in a jar", "steps": []},
            "unknown": "ignored",
        }
    )
    assert extras == {
        "big_question": "Where does rain come from?",
        "intro": "Rain is water on a journey.\n\nLet's follow it.",
        "summary": ["The Sun warms water.", "Vapour cools into clouds."],
        "challenge": None,
    }
    assert KIND.normalise_extras("not an object")["summary"] == []


def test_paragraphs_keep_their_breaks_and_lose_the_rest() -> None:
    assert clean_paragraphs("  one\n\n\n two   words \n", 100) == "one\n\ntwo words"
    assert clean_paragraphs("x" * 50, 10) is None


def test_the_kind_is_enriching_and_for_teachers() -> None:
    assert isinstance(KIND, Enriching)
    assert KIND.for_students is False
    assert KIND.batch < 5


# --- the whole build --------------------------------------------------------


class PictureSearch(FakeSearch):
    async def search_images(self, query, *, limit=6):
        return [
            ToolResult(
                tool="image_search",
                title="Evaporation",
                url="https://www.britannica.com/evaporation",
                snippet="Britannica",
                rank=1,
                thumbnail_url="https://encrypted.test/t.png",
                image_url="https://cdn.test/evaporation.png",
            ),
            ToolResult(
                tool="image_search",
                title="Somewhere to avoid",
                url="https://www.reddit.com/r/pics",
                snippet="reddit",
                rank=2,
                thumbnail_url="https://encrypted.test/r.png",
                image_url="https://cdn.test/reddit.png",
            ),
        ]


def sections(system: str, user: str) -> dict[str, Any]:
    want = int(user.rsplit("Write ", 1)[1].split()[0])
    start = user.count("\n- Part ") + 1
    return {"items": [section(start + i) for i in range(want)]}


WRAP = {
    "big_question": "Where does rain come from?",
    "intro": "Follow a raindrop.",
    "summary": ["Water goes round and round."],
    "challenge": {"title": "Cloud in a jar", "steps": ["Fill a jar with warm water."]},
}


def builder(answers: dict[str, Any], search: FakeSearch | None = None) -> LearningGenerator:
    meter = Meter()
    researcher = Researcher(search or PictureSearch(GOOD_RESULTS), None, PromptInjectionGuard())
    return LearningGenerator(FakeModel(answers, meter), researcher, KIND, meter)


async def build(gen: LearningGenerator, count: int = 3) -> list[Any]:
    request = GenerationRequest(
        kind="study_guide", topic="the water cycle", grade_level="year_4", count=count
    )
    return [update async for update in gen.run(request)]


async def test_a_guide_is_written_two_sections_at_a_time_then_finished() -> None:
    gen = builder(happy(draft=sections, verify=all_ok, wrap=WRAP))
    updates = await build(gen, count=3)

    keys = [u.key for u in updates if isinstance(u, Stage) and u.state == "done"]
    assert keys == ["check", "research", "skills", "write", "finish"]
    [built] = [u for u in updates if isinstance(u, Built)]
    items = built.result.items
    assert len(items) == 3
    # Pictures from hosts a child may be sent to only — never the blocked one.
    assert all(i["image"]["image"] == "https://cdn.test/evaporation.png" for i in items)
    assert all(i["alternatives"] == [] for i in items)
    assert built.result.extras["big_question"] == "Where does rain come from?"
    [pictured] = [u for u in updates if isinstance(u, Pictured)]
    assert set(pictured.pictures) == {i["id"] for i in items}


async def test_a_finishing_stage_that_fails_still_leaves_a_guide() -> None:
    gen = builder(happy(draft=sections, verify=all_ok, wrap=RuntimeError("model fell over")))
    updates = await build(gen, count=2)

    [built] = [u for u in updates if isinstance(u, Built)]
    assert len(built.result.items) == 2
    assert built.result.extras == {}


async def test_the_finish_stage_says_how_many_sections_have_a_picture() -> None:
    gen = builder(happy(draft=sections, verify=all_ok, wrap=WRAP), search=FakeSearch(GOOD_RESULTS))
    updates = await build(gen, count=2)

    [done] = [
        u for u in updates if isinstance(u, Stage) and u.key == "finish" and u.state == "done"
    ]
    assert done.detail == "0 of 2 with a picture"


async def test_a_teacher_can_add_one_more_section_with_its_picture() -> None:
    gen = builder(happy(add={"item": section(9, heading="Part 9: rainbows")}))
    first = normalised()
    assert first is not None
    added = await gen.add(
        topic="the water cycle",
        existing=[first],
        skills=SKILLS,
        sources=(),
        grade_level="year_4",
        language="en",
        instruction="a section about rainbows",
    )
    assert added is not None and added["heading"] == "Part 9: rainbows"
    assert added["image"]["image"] == "https://cdn.test/evaporation.png"


async def test_the_wrap_is_told_every_section_it_is_finishing() -> None:
    seen: list[str] = []

    def wrap(system: str, user: str) -> dict[str, Any]:
        seen.append(user)
        return WRAP

    gen = builder(happy(draft=sections, verify=all_ok, wrap=wrap))
    await build(gen, count=2)
    assert "Part 1: where rain comes from" in seen[0] and "Part 2" in seen[0]
    finishing = Finishing(title="t", topic="t", grade=None, language="en", items=(), sources=())
    assert await KIND.wrap(FakeModel({"wrap": WRAP}, Meter()), finishing) == KIND.normalise_extras(
        WRAP
    )


def test_a_long_skill_label_is_cut_between_words() -> None:
    from app.learning.generator import _words

    label = "Describing the importance of the water cycle for life on Earth"
    assert _words(label, 60) == "Describing the importance of the water cycle for life on"
    assert _words("Evaporation", 60) == "Evaporation"
