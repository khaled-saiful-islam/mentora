"""Making a quiz, flashcards or a study guide from a chat: only with the
topic, year and subject in hand, and exactly as the Make form does it."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from uuid import uuid4

import pytest

from app.core.config import get_settings
from app.core.errors import RateLimitError
from app.db.models.learning import LearningSet
from app.services.generation_service import GenerationDraft
from app.services.jobs import jobs
from app.services.set_builds import ChatSetMaker, Started
from app.tools.base import ToolUnavailable
from app.tools.learning_set import MakeLearningSetTool, grade_from
from app.tools.registry import build_tools
from tests.test_learning_api import scripted  # noqa: F401 — the scripted build


class _Maker:
    def __init__(self, error: Exception | None = None) -> None:
        self.drafts: list[GenerationDraft] = []
        self._error = error

    async def make(self, draft: GenerationDraft) -> Started:
        if self._error:
            raise self._error
        self.drafts.append(draft)
        return Started(uuid4(), draft.kind, f"All about {draft.topic}")


@pytest.mark.parametrize(
    ("said", "code"),
    [
        ("Year 4", "year_4"),
        ("year4", "year_4"),
        ("year_4", "year_4"),
        ("Tahun 3", "year_3"),
        ("Standard 6", "year_6"),
        ("Form 2", "form_2"),
        ("tingkatan 5", "form_5"),
        ("Lower Six", "lower_6"),
        ("Year 9", None),
        ("grade 4", None),
        ("", None),
    ],
)
def test_a_school_year_is_read_however_it_is_written(said, code) -> None:
    grade = grade_from(said)
    assert (grade.code if grade else None) == code


async def test_with_everything_it_starts_the_set_and_hands_back_a_card() -> None:
    maker = _Maker()
    tool = MakeLearningSetTool(maker, languages=("en", "ms"))
    [result] = await tool.run(
        kind="quiz", topic="fractions", subject="Mathematics", year="Year 4", count=8
    )
    [draft] = maker.drafts
    assert (draft.kind, draft.topic, draft.subject, draft.grade_level, draft.count) == (
        "quiz",
        "fractions",
        "Mathematics",
        "year_4",
        8,
    )
    assert result.is_made and result.url.startswith("/library/")
    assert result.snippet == "Quiz · Year 4 · Mathematics"
    assert "do not cite" in result.excerpt.lower()


@pytest.mark.parametrize(
    ("given", "asks"),
    [
        ({"kind": "quiz", "topic": "fractions", "subject": "Maths"}, "the school year"),
        ({"kind": "quiz", "year": "Year 4"}, "what it is about"),
        ({"topic": "fractions", "subject": "Maths", "year": "Year 4"}, "what to make"),
    ],
)
async def test_without_the_year_or_what_it_is_about_it_says_what_to_ask(given, asks) -> None:
    maker = _Maker()
    with pytest.raises(ToolUnavailable, match=asks):
        await MakeLearningSetTool(maker).run(**given)
    assert maker.drafts == []


async def test_a_topic_and_a_year_are_enough() -> None:
    maker = _Maker()
    [result] = await MakeLearningSetTool(maker).run(kind="quiz", topic="fractions", year="Year 3")
    [draft] = maker.drafts
    assert (draft.topic, draft.subject, draft.grade_level) == ("fractions", None, "year_3")
    assert result.snippet == "Quiz · Year 3"


async def test_a_subject_and_a_year_make_it_across_the_subject() -> None:
    maker = _Maker()
    await MakeLearningSetTool(maker).run(kind="flashcard", subject="Science", year="Year 2")
    [draft] = maker.drafts
    assert (draft.topic, draft.subject, draft.grade_level) == (
        "Science for Year 2",
        "Science",
        "year_2",
    )


def test_the_model_is_told_to_work_the_subject_out_rather_than_ask() -> None:
    tool = MakeLearningSetTool(_Maker())
    assert tool.parameters["required"] == ["kind", "year"]
    assert "fractions → Mathematics" in tool.description
    assert "leave the topic out" in tool.description


async def test_a_year_it_does_not_know_is_asked_about_not_guessed() -> None:
    maker = _Maker()
    with pytest.raises(ToolUnavailable, match="which year"):
        await MakeLearningSetTool(maker).run(
            kind="flashcards", topic="planets", subject="Science", year="Grade 12"
        )
    assert maker.drafts == []


async def test_other_words_for_a_kind_and_an_unknown_language_are_understood() -> None:
    maker = _Maker()
    await MakeLearningSetTool(maker, languages=("en", "ms")).run(
        kind="flashcards", topic="planets", subject="Science", year="Form 1", language="xx"
    )
    await MakeLearningSetTool(maker, languages=("en", "ms")).run(
        kind="study guide", topic="rain", subject="Science", year="Year 2", language="ms"
    )
    assert [(d.kind, d.language) for d in maker.drafts] == [
        ("flashcard", "en"),
        ("study_guide", "ms"),
    ]


async def test_a_limit_reached_is_said_plainly() -> None:
    maker = _Maker(RateLimitError("Too many at once. Try again in a minute.", retry_after=60))
    with pytest.raises(ToolUnavailable, match="Too many at once"):
        await MakeLearningSetTool(maker).run(
            kind="quiz", topic="fractions", subject="Maths", year="Year 4"
        )


def test_only_someone_who_can_make_sets_gets_the_tool() -> None:
    assert "make_learning_set" in build_tools(get_settings(), studio=False, maker=_Maker())
    assert "make_learning_set" not in build_tools(get_settings(), studio=False)


async def test_from_a_chat_the_set_is_built_just_like_the_make_form(
    session,
    scripted,  # noqa: F811
    teacher,
) -> None:
    _, build = scripted

    @asynccontextmanager
    async def same_session():
        yield session

    maker = ChatSetMaker(teacher.id, build(), get_settings(), same_session)
    started = await maker.make(
        GenerationDraft(
            kind="quiz", topic="photosynthesis", subject="Science", grade_level="year_5", count=5
        )
    )
    job = jobs.find(started.set_id, teacher.id)
    assert job is not None
    await asyncio.wait_for(job.task, 5)
    learning_set = await session.get(LearningSet, started.set_id)
    await session.refresh(learning_set)
    assert learning_set.owner_id == teacher.id
    assert (learning_set.status, learning_set.purpose, learning_set.grade_level) == (
        "ready",
        "assign",
        "year_5",
    )
