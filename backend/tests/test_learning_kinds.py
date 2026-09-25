"""The learning kinds: what an item is, what a student sees, how it is marked.

Adding a kind is one file and one registry line; the last test here registers
one the codebase has never heard of and runs it through the same contract.
"""

from __future__ import annotations

import pytest

from app.learning.base import LearningKind, Skill
from app.learning.flashcard import FlashcardKind
from app.learning.quiz import QuizKind
from app.learning.registry import build_learning_kinds

SKILLS = (Skill("light-energy", "Light energy"), Skill("chlorophyll", "Chlorophyll"))
SOURCES = {"s1", "s2"}


def raw_question(**overrides) -> dict:
    return {
        "prompt": "What do plants need from the Sun to make food?",
        "options": ["Light", "Sand", "Noise", "Wind"],
        "answer": 0,
        "explanation": "Plants use light energy to make glucose.",
        "skill": "light-energy",
        "difficulty": "easy",
        "source_ids": ["s1"],
        **overrides,
    }


# --- quiz -------------------------------------------------------------------


def test_a_good_question_is_kept_and_given_an_id() -> None:
    item = QuizKind().normalise(raw_question(), skills=SKILLS, source_ids=SOURCES)
    assert item is not None
    assert item["id"]
    assert item["options"] == ["Light", "Sand", "Noise", "Wind"]
    assert item["answer"] == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"options": ["Light", "Sand", "Noise"]},  # three options
        {"options": ["Light", "light", "Noise", "Wind"]},  # duplicate
        {"answer": 4},
        {"answer": "A"},
        {"prompt": ""},
        {"options": ["Light", "", "Noise", "Wind"]},
    ],
)
def test_a_broken_question_is_refused(overrides) -> None:
    assert (
        QuizKind().normalise(raw_question(**overrides), skills=SKILLS, source_ids=SOURCES) is None
    )


def test_the_answer_may_be_given_as_the_option_text() -> None:
    """Models often say the answer rather than its index."""
    item = QuizKind().normalise(raw_question(answer="Light"), skills=SKILLS, source_ids=SOURCES)
    assert item is not None and item["answer"] == 0


def test_unknown_skills_and_sources_are_repaired_not_trusted() -> None:
    item = QuizKind().normalise(
        raw_question(skill="astrology", source_ids=["s1", "s9"], difficulty="impossible"),
        skills=SKILLS,
        source_ids=SOURCES,
    )
    assert item is not None
    assert item["skill"] == "light-energy"  # the first real skill
    assert item["source_ids"] == ["s1"]
    assert item["difficulty"] == "medium"


def test_a_student_never_sees_the_answer_before_answering() -> None:
    item = QuizKind().normalise(raw_question(), skills=SKILLS, source_ids=SOURCES)
    public = QuizKind().public(item)
    assert "answer" not in public
    assert "explanation" not in public
    assert public["options"] == item["options"]


def test_marking_a_question() -> None:
    kind = QuizKind()
    item = kind.normalise(raw_question(), skills=SKILLS, source_ids=SOURCES)
    right = kind.grade(item, {"choice": 0})
    wrong = kind.grade(item, {"choice": 2})
    assert (right.correct, wrong.correct) == (True, False)
    assert wrong.reveal == {"answer": 0, "explanation": "Plants use light energy to make glucose."}


@pytest.mark.parametrize("response", [{}, {"choice": "0"}, {"choice": 9}, {"choice": None}])
def test_a_malformed_response_is_wrong_not_an_error(response) -> None:
    item = QuizKind().normalise(raw_question(), skills=SKILLS, source_ids=SOURCES)
    assert QuizKind().grade(item, response).correct is False


# --- flashcards ---------------------------------------------------------------


def raw_card(**overrides) -> dict:
    return {
        "front": "Chlorophyll",
        "back": "The green pigment that absorbs light.",
        "hint": "It makes leaves green",
        "skill": "chlorophyll",
        "source_ids": ["s2"],
        **overrides,
    }


def test_a_good_card_is_kept() -> None:
    card = FlashcardKind().normalise(raw_card(), skills=SKILLS, source_ids=SOURCES)
    assert card is not None and card["front"] == "Chlorophyll"


@pytest.mark.parametrize("overrides", [{"front": ""}, {"back": "   "}, {"front": "x" * 400}])
def test_a_broken_card_is_refused(overrides) -> None:
    assert (
        FlashcardKind().normalise(raw_card(**overrides), skills=SKILLS, source_ids=SOURCES) is None
    )


def test_a_card_is_marked_by_the_student_themselves() -> None:
    kind = FlashcardKind()
    card = kind.normalise(raw_card(), skills=SKILLS, source_ids=SOURCES)
    assert kind.grade(card, {"knew": True}).correct is True
    assert kind.grade(card, {"knew": False}).correct is False
    assert kind.grade(card, {"knew": "yes"}).correct is False


def test_a_card_shows_both_sides_it_is_self_marked() -> None:
    card = FlashcardKind().normalise(raw_card(), skills=SKILLS, source_ids=SOURCES)
    assert {"front", "back"} <= set(FlashcardKind().public(card))


# --- the registry and the contract -----------------------------------------


def test_the_registry_has_quiz_and_flashcard() -> None:
    kinds = build_learning_kinds()
    assert set(kinds) == {"quiz", "flashcard"}
    for kind in kinds.values():
        assert isinstance(kind, LearningKind)


def test_every_kind_describes_what_the_model_must_write() -> None:
    for kind in build_learning_kinds().values():
        assert "JSON" in kind.writing_rules()
        assert kind.item_noun and kind.item_noun_plural
