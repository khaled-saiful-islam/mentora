"""Read it to me: the tutor's voice saying what is on screen, and nothing else."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.api.deps import get_narrator
from app.core.errors import ValidationError
from app.live.audio import AudioCache, Narrator
from app.providers.speech import SpeechError
from app.services.read_aloud import words_for
from tests.play_helpers import ready_set, shared
from tests.test_live_voice import FakeSpeech


class _Silent:
    async def synthesize(self, text, *, voice, speed, model=None):
        raise SpeechError("The voice could not be reached.")


@pytest.fixture
def voiced(client, tmp_path: Path):
    """`voiced(user)`: a client whose voice is a fake that records what it said."""
    voice = FakeSpeech()

    def make(user, *, speech=None):
        c = client(user)
        narrator = Narrator(speech or voice, AudioCache(tmp_path))
        c._transport.app.dependency_overrides[get_narrator] = lambda: narrator  # noqa: SLF001
        return c

    make.voice = voice
    return make


def test_each_part_says_what_the_student_sees() -> None:
    quiz = {"id": "q1", "prompt": "What do plants need?", "options": ["Light", "Salt"]}
    card = {"id": "c1", "front": "Evaporation", "back": "Water turning to vapour"}
    assert words_for(quiz, "question") == "What do plants need?"
    assert words_for(quiz, "option", 0) == "Triangle: Light"
    assert words_for(quiz, "option", 1) == "Diamond: Salt"
    assert words_for(card, "front") == "Evaporation"
    assert words_for(card, "back") == "Water turning to vapour"


@pytest.mark.parametrize(
    ("item", "part", "n"),
    [
        ({"prompt": "Q?", "options": ["A"]}, "option", 1),
        ({"prompt": "Q?", "options": ["A"]}, "option", None),
        ({"prompt": "Q?", "options": ["A"]}, "front", None),
        ({"front": "F", "back": "B"}, "question", None),
    ],
)
def test_a_part_the_item_does_not_have_is_refused(item, part, n) -> None:
    with pytest.raises(ValidationError):
        words_for(item, part, n)


async def test_a_student_hears_the_question_and_each_answer_in_shown_order(
    session, voiced, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], shuffle_options=True)
    async with voiced(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        item = attempt["items"][0]
        base = f"/api/me/attempts/{attempt['id']}/speech?item={item['id']}"
        question = await c.get(f"{base}&part=question")
        second = await c.get(f"{base}&part=option&n=1")
    assert question.status_code == second.status_code == 200, question.text
    assert question.headers["content-type"] == "audio/mpeg"
    assert "max-age" in question.headers["cache-control"]
    assert voiced.voice.said == [item["prompt"], f"Diamond: {item['options'][1]}"]


async def test_a_card_is_read_front_and_back(session, voiced, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], kind="flashcard")
    async with voiced(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        card = attempt["items"][0]
        base = f"/api/me/attempts/{attempt['id']}/speech?item={card['id']}"
        assert (await c.get(f"{base}&part=front")).status_code == 200
        assert (await c.get(f"{base}&part=back")).status_code == 200
    assert voiced.voice.said == [card["front"], card["back"]]


async def test_only_the_student_whose_attempt_it_is_hears_it(
    session, voiced, account, teacher, student
) -> None:
    other = await account("student", "Mei")
    assignment = await shared(session, teacher, [student, other])
    async with voiced(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
    item = attempt["items"][0]["id"]
    async with voiced(other) as c:
        response = await c.get(f"/api/me/attempts/{attempt['id']}/speech?item={item}&part=question")
    assert response.status_code == 404
    assert voiced.voice.said == []


async def test_an_item_not_in_the_attempt_or_a_bad_part_is_refused(
    session, voiced, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    async with voiced(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        base = f"/api/me/attempts/{attempt['id']}/speech"
        missing = await c.get(f"{base}?item=nope&part=question")
        wrong = await c.get(f"{base}?item={attempt['items'][0]['id']}&part=front")
        unknown = await c.get(f"{base}?item={attempt['items'][0]['id']}&part=shout")
    assert (missing.status_code, wrong.status_code, unknown.status_code) == (404, 422, 422)
    assert voiced.voice.said == []


async def test_a_language_the_voice_does_not_read_is_refused(session, voiced, teacher) -> None:
    learning_set = await ready_set(session, teacher)
    learning_set.language = "ta"
    await session.flush()
    async with voiced(teacher) as c:
        response = await c.get(f"/api/learning-sets/{learning_set.id}/speech?item=q1&part=question")
    assert response.status_code == 422
    assert voiced.voice.said == []


async def test_the_owner_hears_their_set_while_previewing(
    session, voiced, account, teacher
) -> None:
    learning_set = await ready_set(session, teacher)
    async with voiced(teacher) as c:
        base = f"/api/learning-sets/{learning_set.id}/speech?item=q2"
        question = await c.get(f"{base}&part=question")
        first = await c.get(f"{base}&part=option&n=0")
    assert question.status_code == first.status_code == 200
    assert question.headers["cache-control"] == "no-store"
    assert voiced.voice.said == ["Question 2?", "Triangle: Right 2"]
    async with voiced(await account("teacher", "Cikgu Lain")) as c:
        stranger = await c.get(f"/api/learning-sets/{learning_set.id}/speech?item=q2&part=question")
    assert stranger.status_code == 404


async def test_a_student_cannot_preview_a_set(session, voiced, teacher, student) -> None:
    learning_set = await ready_set(session, teacher)
    async with voiced(student) as c:
        response = await c.get(f"/api/learning-sets/{learning_set.id}/speech?item=q1&part=question")
    assert response.status_code == 403


async def test_a_voice_that_fails_says_so_plainly(session, voiced, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    async with voiced(student, speech=_Silent()) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        item = attempt["items"][0]["id"]
        response = await c.get(f"/api/me/attempts/{attempt['id']}/speech?item={item}&part=question")
    assert response.status_code == 502
    assert response.json()["error"]["message"] == "The voice could not be reached."
