"""Pictures beside questions for Year 1–3: written so they never give the
answer away, looked at before they are kept, found once per set."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.api.deps import get_picture_filler
from app.db.models.item_picture import ItemPicture
from app.learning.item_pictures import (
    ItemPictureFinder,
    SpoilerCheck,
    item_key,
    searches_from,
    shown,
)
from app.learning.model import Meter
from app.learning.research import Picture
from app.services.item_picture_service import PictureFiller, Wanted
from tests.learning_fakes import FakeModel
from tests.play_helpers import quiz_items, ready_set, shared

PHOTO = Picture(
    image="https://pics.test/field.jpg",
    thumbnail="https://pics.test/field-small.jpg",
    page="https://pics.test/field",
    source="Cows eat grass all day",
    title="Cow eating grass",
)


class _Pictures:
    def __init__(self, found: list[Picture]) -> None:
        self.found = found
        self.asked: list[str] = []

    async def pictures(self, query, *, limit):
        self.asked.append(query)
        return self.found[:limit]


class _Filler:
    def __init__(self, *, resting: bool = False) -> None:
        self.started: list[Wanted] = []
        self._resting = resting

    def start(self, wanted: Wanted) -> None:
        self.started.append(wanted)

    def resting(self, set_id) -> bool:
        return self._resting


@pytest.fixture
def pictured(client):
    """`pictured(user, filler)`: a client whose picture filler is a fake."""

    def make(user, filler):
        c = client(user)
        c._transport.app.dependency_overrides[get_picture_filler] = lambda: filler  # noqa: SLF001
        return c

    return make


# --- the searches -------------------------------------------------------------


def test_an_item_is_known_by_what_it_shows() -> None:
    [one, two] = quiz_items(2)
    assert item_key(one) == item_key(dict(one))
    assert item_key(one) != item_key(two)
    assert item_key(one) != item_key({**one, "prompt": "Something else?"})
    assert item_key(one) == item_key({**one, "explanation": "Reworded."})


def test_searches_are_cleaned_and_kept_to_the_items_asked_about() -> None:
    raw = {
        "pictures": [
            {"id": "q1", "search": "  grassy <b>field</b>!! "},
            {"id": "q2", "search": ""},
            {"id": "stranger", "search": "anything"},
            {"id": "q3", "search": "x" * 200},
            "not a row",
        ]
    }
    found = searches_from(raw, {"q1", "q2", "q3"})
    assert found["q1"] == "grassy b field b"
    assert found["q2"] == ""
    assert "stranger" not in found
    assert len(found["q3"]) == 80
    assert searches_from("nonsense", {"q1"}) == {}


def test_a_kept_picture_drops_the_page_title_which_can_name_the_answer() -> None:
    kept = shown(PHOTO, "grassy field")
    assert kept is not None
    assert kept["title"] == "" and kept["alt"] == "grassy field"
    assert kept["image"] == PHOTO.image and kept["source"] == "pics.test"
    assert shown(Picture("http://plain.test/a.jpg", "", "", "", ""), "field") is None


async def test_the_model_sees_the_answer_so_it_can_avoid_it() -> None:
    seen: dict[str, str] = {}

    def reply(system, user):
        seen["system"], seen["user"] = system, user
        return {"pictures": [{"id": "q1", "search": "grassy field"}]}

    finder = ItemPictureFinder(FakeModel({"pictures": reply}, Meter()), _Pictures([]))
    searches = await finder.searches(quiz_items(1), topic="Plants", grade=None)
    assert searches == {"q1": "grassy field"}
    assert "right answer: Right 1" in seen["user"]
    assert "must not show the right answer or any of the choices" in seen["system"]


class _Eyes:
    """A vision model that says the same about every picture."""

    def __init__(self, *replies: str | None) -> None:
        self.replies = list(replies)
        self.asked: list[str] = []

    async def look(self, picture, question):
        self.asked.append(question)
        return self.replies.pop(0) if self.replies else None


CARD = {"id": "c1", "front": "Frog", "back": "An animal that lives near water"}
QUESTION = {
    "id": "q1",
    "prompt": "Which animal eats grass?",
    "options": ["Cow", "Frogs", "Spider", "Snake"],
    "answer": 0,
}
OTHER = Picture("https://pics.test/b.jpg", "https://pics.test/b-s.jpg", "https://b.test/", "", "")


async def test_no_search_means_no_picture_and_no_lookup() -> None:
    source = _Pictures([PHOTO])
    finder = ItemPictureFinder(FakeModel({}, Meter()), source)
    assert await finder.picture("", CARD) is None
    assert source.asked == []
    assert (await finder.picture("green frog", CARD))["alt"] == "green frog"
    assert source.asked == ["green frog"]


@pytest.mark.parametrize(
    ("search", "names"),
    [("a cow in a field", True), ("frog on a lily pad", True), ("grassy field", False)],
)
def test_a_search_that_names_a_choice_is_refused(search, names) -> None:
    from app.learning.item_pictures import names_a_choice

    assert names_a_choice(search, QUESTION) is names


async def test_a_question_keeps_only_a_picture_that_gives_nothing_away() -> None:
    eyes = _Eyes('{"gives_away": true, "why": "shows a cow"}', '{"gives_away": false}')
    source = _Pictures([PHOTO, OTHER])
    finder = ItemPictureFinder(FakeModel({}, Meter()), source, SpoilerCheck(eyes))
    kept = await finder.picture("grassy field", QUESTION)
    assert kept is not None and kept["image"] == OTHER.image
    assert "Right answer: Cow" in eyes.asked[0]
    assert await finder.picture("a cow in a field", QUESTION) is None
    assert source.asked == ["grassy field"]


@pytest.mark.parametrize("reply", [None, "not json", '{"gives_away": "no"}', "{broken"])
async def test_anything_but_a_clear_no_counts_as_giving_it_away(reply) -> None:
    finder = ItemPictureFinder(
        FakeModel({}, Meter()), _Pictures([PHOTO]), SpoilerCheck(_Eyes(reply))
    )
    assert await finder.picture("grassy field", QUESTION) is None


async def test_a_question_without_a_spoiler_check_gets_no_picture() -> None:
    finder = ItemPictureFinder(FakeModel({}, Meter()), _Pictures([PHOTO]))
    assert await finder.picture("grassy field", QUESTION) is None
    assert await finder.picture("green frog", CARD) is not None


# --- finding the rest ---------------------------------------------------------


async def test_the_filler_keeps_an_answer_for_every_item_found_or_not() -> None:
    items = quiz_items(2)
    reply = {"pictures": [{"id": "q1", "search": "grassy field"}, {"id": "q2", "search": ""}]}
    saved: list[tuple] = []

    async def save(set_id, key, query, picture):
        saved.append((key, query, picture))

    filler = PictureFiller(
        lambda topic, grade: ItemPictureFinder(
            FakeModel({"pictures": reply}, Meter()),
            _Pictures([PHOTO]),
            SpoilerCheck(_Eyes('{"gives_away": false}')),
        ),
        save=save,
    )
    await filler.fill(Wanted(uuid4(), "Plants", "year_2", tuple(items)))
    by_key = {key: (query, picture) for key, query, picture in saved}
    assert by_key[item_key(items[0])][1]["image"] == PHOTO.image
    assert by_key[item_key(items[1])] == ("", None)


async def test_a_set_whose_searches_failed_rests_before_trying_again() -> None:
    saved: list[tuple] = []

    async def save(*row):
        saved.append(row)

    set_id = uuid4()
    filler = PictureFiller(
        lambda topic, grade: ItemPictureFinder(
            FakeModel({"pictures": RuntimeError("down")}, Meter()), _Pictures([])
        ),
        save=save,
    )
    await filler.fill(Wanted(set_id, "Plants", None, tuple(quiz_items(1))))
    assert saved == []
    assert filler.resting(set_id) and not filler.resting(uuid4())


# --- over HTTP ----------------------------------------------------------------


async def test_a_student_gets_what_is_known_and_the_rest_is_looked_for(
    session, pictured, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], n=3)
    filler = _Filler()
    async with pictured(student, filler) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        first = (await c.get(f"/api/me/attempts/{attempt['id']}/pictures")).json()
    assert first == {"pictures": {}, "done": False}
    [wanted] = filler.started
    assert wanted.set_id == assignment.set_id
    assert [item["id"] for item in wanted.items] == ["q1", "q2", "q3"]
    # q1 has a picture, q2 none fits; q3 is still to be looked at.
    q1, q2, _ = quiz_items(3)
    picture = {**shown(PHOTO, "grassy field")}
    session.add(ItemPicture(set_id=assignment.set_id, item_key=item_key(q1), picture=picture))
    session.add(ItemPicture(set_id=assignment.set_id, item_key=item_key(q2), picture=None))
    await session.flush()
    async with pictured(student, filler) as c:
        second = (await c.get(f"/api/me/attempts/{attempt['id']}/pictures")).json()
    assert second == {"pictures": {"q1": picture}, "done": False}
    assert [item["id"] for item in filler.started[-1].items] == ["q3"]


async def test_once_every_item_is_looked_at_nothing_more_is_asked(
    session, pictured, teacher
) -> None:
    learning_set = await ready_set(session, teacher, n=1)
    [q1] = quiz_items(1)
    session.add(ItemPicture(set_id=learning_set.id, item_key=item_key(q1), picture=None))
    await session.flush()
    filler = _Filler()
    async with pictured(teacher, filler) as c:
        found = (await c.get(f"/api/learning-sets/{learning_set.id}/pictures")).json()
    assert found == {"pictures": {}, "done": True}
    assert filler.started == []


@pytest.mark.parametrize("filler", [None, _Filler(resting=True)])
async def test_without_a_way_to_look_or_while_resting_it_is_done(
    session, pictured, teacher, filler
) -> None:
    learning_set = await ready_set(session, teacher, n=2)
    async with pictured(teacher, filler) as c:
        found = (await c.get(f"/api/learning-sets/{learning_set.id}/pictures")).json()
    assert found["done"] is True and found["pictures"] == {}


async def test_only_quizzes_and_flashcards_get_pictures(session, pictured, teacher) -> None:
    learning_set = await ready_set(session, teacher, kind="flashcard", n=2)
    learning_set.kind = "study_guide"
    await session.flush()
    filler = _Filler()
    async with pictured(teacher, filler) as c:
        found = (await c.get(f"/api/learning-sets/{learning_set.id}/pictures")).json()
    assert found == {"pictures": {}, "done": True}
    assert filler.started == []


async def test_pictures_are_the_owners_and_their_students_only(
    session, pictured, account, teacher, student
) -> None:
    learning_set = await ready_set(session, teacher)
    assignment = await shared(session, teacher, [student])
    async with pictured(student, _Filler()) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        as_student = await c.get(f"/api/learning-sets/{learning_set.id}/pictures")
    async with pictured(await account("teacher", "Cikgu Lain"), _Filler()) as c:
        as_stranger = await c.get(f"/api/learning-sets/{learning_set.id}/pictures")
    async with pictured(await account("student", "Mei"), _Filler()) as c:
        someone_else = await c.get(f"/api/me/attempts/{attempt['id']}/pictures")
    assert (as_student.status_code, as_stranger.status_code) == (403, 404)
    assert someone_else.status_code == 404
