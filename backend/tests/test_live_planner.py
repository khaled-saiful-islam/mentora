"""Writing a live lesson: settings held to, parts written in order, the
teacher's files first, the web only for gaps, and one repair."""

from __future__ import annotations

import io
import zipfile

import pytest
from pydantic import ValidationError

from app.guards.prompt_injection import PromptInjectionGuard
from app.learning.model import Meter
from app.learning.research import Researcher
from app.live.planner import (
    Document,
    LessonPlanner,
    PartWritten,
    PlanInput,
    PlanRefused,
    Stage,
    checkin_from,
)
from app.services.document_extract import classify, extract
from tests.learning_fakes import GOOD_RESULTS, FakeModel, FakeSearch
from tests.live_fakes import answers, settings


def _planner(model_answers=None, search=None):
    model = FakeModel(model_answers or answers(), Meter())
    researcher = Researcher(search, None, PromptInjectionGuard()) if search else None
    return LessonPlanner(model, researcher), model


async def _run(planner, request) -> list:
    return [e async for e in planner.plan(request)]


# --- settings -------------------------------------------------------------------


def test_settings_are_tidied_and_held_to_the_choices_on_offer() -> None:
    made = settings(topic="  photo   synthesis ", breakdown=["  Light ", "Water"])
    assert made.topic == "photo synthesis"
    assert made.breakdown == ["Light", "Water"]
    assert made.language == "en"
    for bad in (
        {"grade_level": "year_99"},
        {"breakdown": []},
        {"breakdown": ["Light", "light"]},
        {"duration_minutes": 17},
        {"language": "ms"},
        {"approach": "lecture"},
    ):
        with pytest.raises(ValidationError):
            settings(**bad)


def test_time_is_shared_out_as_segments_across_the_parts() -> None:
    assert settings(duration_minutes=15, breakdown=["A", "B"]).segments_per_part() == [5, 5]
    assert settings(duration_minutes=10, breakdown=["A", "B", "C"]).segments_per_part() == [3, 2, 2]
    # Never less than one segment a part, even when the time is short.
    many = [f"Part {n}" for n in range(12)]
    assert settings(duration_minutes=10, breakdown=many).segments_per_part() == [1] * 12


# --- planning -------------------------------------------------------------------


async def test_the_lesson_is_written_part_by_part_in_the_teachers_order() -> None:
    planner, model = _planner()
    events = await _run(planner, PlanInput(settings=settings()))
    parts = [e for e in events if isinstance(e, PartWritten)]
    assert [p.part for p in parts] == [0, 1]
    first = parts[0].segments
    assert len(first) + len(parts[1].segments) == 7  # 10 minutes at 90 s a segment
    assert first[0].subtopic == "What plants need"
    assert first[0].skill == "what-plants-need"
    # The check-in comes at the end of each part only.
    assert [s.checkin is not None for s in first] == [False, False, False, True]
    assert any(isinstance(e, Stage) and e.label.startswith("Writing part 2") for e in events)
    assert model.asked.count("live.part") == 2


async def test_a_topic_that_cannot_be_taught_is_refused_before_writing() -> None:
    planner, model = _planner(answers(**{"live.check": {"ok": False, "reason": "Not for school."}}))
    with pytest.raises(PlanRefused, match="Not for school"):
        await _run(planner, PlanInput(settings=settings()))
    assert "live.part" not in model.asked


async def test_problems_found_are_sent_back_once_to_be_repaired() -> None:
    planner, model = _planner(answers(**{"live.verify": {"problems": ["Water is not a gas."]}}))
    await _run(planner, PlanInput(settings=settings()))
    assert model.asked.count("live.repair") == 2  # once per part, never again


async def test_the_teachers_files_ground_the_lesson_and_come_first() -> None:
    seen: list[str] = []

    def part(system, user):
        seen.append(user)
        from tests.live_fakes import part_answer

        return part_answer(system, user)

    notes = Document("Chapter 3.pdf", "Plants need sunlight, water and air to make food. " * 60)
    planner, _ = _planner(answers(**{"live.part": part}), search=FakeSearch(GOOD_RESULTS))
    await _run(planner, PlanInput(settings=settings(), documents=(notes,)))
    assert "[D1] Chapter 3.pdf (your file)" in seen[0]


async def test_the_web_is_searched_only_when_the_files_are_thin() -> None:
    search = FakeSearch(GOOD_RESULTS)
    planner, _ = _planner(search=search)
    rich = Document("notes.txt", "Photosynthesis is how plants make food from light. " * 80)
    await _run(planner, PlanInput(settings=settings(), documents=(rich,)))
    assert search.queries == []

    await _run(planner, PlanInput(settings=settings()))
    assert search.queries


async def test_a_breakdown_is_suggested_as_short_parts() -> None:
    planner, _ = _planner()
    parts = await planner.breakdown(
        subject="Science", topic="photosynthesis", grade_level="year_5", difficulty="beginner"
    )
    assert parts == ["What plants need", "Inside a leaf", "Making food"]


def test_only_a_sound_check_in_question_is_kept() -> None:
    good = {"question": "Which?", "options": ["A", "B"], "answer": 1}
    assert checkin_from(good)["answer"] == 1
    assert checkin_from({**good, "answer": 2}) is None
    assert checkin_from({**good, "options": ["A", "A"]}) is None
    assert checkin_from({**good, "options": ["A"]}) is None
    assert checkin_from("nonsense") is None


# --- slides ---------------------------------------------------------------------------


P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'


def _pptx(slides: list[str], notes: dict[int, str]) -> bytes:
    run = '<a:t xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">{}</a:t>'
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for n, text in enumerate(slides, start=1):
            archive.writestr(f"ppt/slides/slide{n}.xml", f"<p:sld {P}>{run.format(text)}</p:sld>")
        for n, text in notes.items():
            archive.writestr(
                f"ppt/notesSlides/notesSlide{n}.xml", f"<p:notes {P}>{run.format(text)}</p:notes>"
            )
    return buffer.getvalue()


def test_slides_are_read_in_order_with_their_notes() -> None:
    data = _pptx([f"Slide text {n}" for n in range(1, 12)], {2: "Say this slowly"})
    assert classify(filename="Lesson.pptx", media_type="application/octet-stream") == "pptx"
    read = extract(data, filename="Lesson.pptx", media_type="application/octet-stream")
    assert read.unit == "slide" and read.count == 11
    assert read.text.index("Slide 2: Slide text 2") < read.text.index("Slide 10: Slide text 10")
    assert "Notes: Say this slowly" in read.text


def test_slides_carrying_a_dtd_are_refused_not_expanded() -> None:
    from app.services.document_extract import UnreadableDocument

    bomb = (
        '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">'
        '<!ENTITY lol2 "&lol;&lol;&lol;&lol;">]>'
        f'<p:sld {P}><a:t xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">&lol2;</a:t></p:sld>'
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("ppt/slides/slide1.xml", bomb)
    with pytest.raises(UnreadableDocument):
        extract(buffer.getvalue(), filename="x.pptx", media_type="application/octet-stream")


async def test_each_part_that_asks_for_a_picture_gets_a_safe_one() -> None:
    from app.tools.base import ToolResult

    class PictureSearch(FakeSearch):
        async def search_images(self, query, *, limit=6):
            return [
                ToolResult(
                    tool="image_search",
                    title="A leaf",
                    url="https://example.org/leaf",
                    snippet="Example",
                    rank=1,
                    thumbnail_url="https://example.org/t.png",
                    image_url="https://example.org/leaf.png",
                )
            ]

    def part(system, user):
        from tests.live_fakes import part_answer

        made = part_answer(system, user)
        for segment in made["segments"]:
            segment["image_query"] = "leaf close up"
        return made

    notes = Document("notes.txt", "Photosynthesis is how plants make food from light. " * 80)
    planner, _ = _planner(
        answers(**{"live.part": part, "live.repair": part}), search=PictureSearch(GOOD_RESULTS)
    )
    events = await _run(planner, PlanInput(settings=settings(), documents=(notes,)))
    first = next(e for e in events if isinstance(e, PartWritten)).segments[0]
    assert first.image["image"] == "https://example.org/leaf.png"
    assert first.as_dict()["image"]["page"] == "https://example.org/leaf"


def test_a_quick_check_is_open_longer_for_young_readers() -> None:
    from app.live.settings import check_size

    assert check_size("year_2").seconds == 30
    assert check_size("year_5").seconds == 20
    assert check_size("form_3").seconds == 15
    assert check_size("upper_6").seconds == 15


def test_a_quick_check_too_long_for_its_time_is_sent_back() -> None:
    from app.live.planner import check_problems
    from app.live.settings import CHECK_UPPER

    long = {"question": " ".join(["word"] * 20) + "?", "options": ["A", "B"], "answer": 0}
    wordy = {"question": "Which?", "options": ["one two three four five six", "B"], "answer": 0}
    assert "15 seconds" in check_problems(long, CHECK_UPPER)[0]
    assert "5 words or fewer" in check_problems(wordy, CHECK_UPPER)[0]
    assert (
        check_problems({"question": "Which?", "options": ["A", "B"], "answer": 0}, CHECK_UPPER)
        == []
    )
