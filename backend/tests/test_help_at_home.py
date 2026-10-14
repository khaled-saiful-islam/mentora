"""Help at home and practice for these students (§28.3.3): what a skill
means for a parent, kept once; a challenge sent home; cheers the buddy acts
out; and a teacher's practice for just the students who found a skill hard."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.api.routes import help_at_home
from app.api.routes.practice_for import who_found_it_hard
from app.core.errors import UpstreamError, ValidationError
from app.core.notifications import Kind
from app.db.models.classroom import ClassGroup, GroupMember
from app.db.models.learning import LearningSet
from app.db.models.notification import Notification
from app.learning.model import GenerationUnavailable, Meter
from app.services.family_service import FamilyService
from app.services.skill_help_service import SkillHelpService, cleaned
from app.services.skill_practice import SkillPractice, build_then
from tests.learning_fakes import FakeModel
from tests.play_helpers import shared

HELP = {
    "meaning": "Light energy is energy we can see.",
    "example": "The sun gives us light; a torch does too.",
    "activity": {
        "title": "Shadow hunt",
        "minutes": 5,
        "needs": ["a torch", "a toy"],
        "steps": ["Switch off the lights.", "Shine the torch on the toy.", "Find its shadow."],
    },
}


# --- what a skill means ------------------------------------------------------------


def test_help_is_kept_to_what_a_parent_can_read() -> None:
    found = cleaned(HELP)
    assert found is not None and found.activity["title"] == "Shadow hunt"
    assert cleaned({**HELP, "activity": {**HELP["activity"], "steps": ["Only one."]}}) is None
    long_minutes = cleaned({**HELP, "activity": {**HELP["activity"], "minutes": 45}})
    assert long_minutes is not None and long_minutes.activity["minutes"] == 5
    assert cleaned({**HELP, "meaning": ""}) is None


async def test_help_is_written_once_for_each_skill_year_and_language(session) -> None:
    model = FakeModel({"help at home": HELP}, Meter())
    service = SkillHelpService(session, lambda: model)
    asked = {"subject": "Science", "slug": "light", "label": "Light energy", "grade": "year_4"}
    first = await service.help(**asked, language="en")
    again = await service.help(**asked, language="en")
    assert first == again and model.asked == ["help at home"]
    await service.help(**asked, language="ms")
    assert model.asked == ["help at home", "help at home"]


async def test_help_in_another_language_is_refused_and_a_bad_reply_said_plainly(session) -> None:
    service = SkillHelpService(session, lambda: FakeModel({"help at home": {}}, Meter()))
    with pytest.raises(ValidationError):
        await service.help(subject="S", slug="x", label="X", grade=None, language="zh")
    with pytest.raises(UpstreamError):
        await service.help(subject="S", slug="x", label="X", grade=None, language="en")
    down = SkillHelpService(
        session, lambda: FakeModel({"help at home": GenerationUnavailable("down")}, Meter())
    )
    with pytest.raises(UpstreamError):
        await down.help(subject="S", slug="y", label="Y", grade=None, language="en")


# --- a parent and their child --------------------------------------------------------


async def _family(session, account, child):
    parent = await account("parent", "Siti")
    family = FamilyService(session)
    await family.connect(parent, (await family.invite_for(child)).code, "Mum")
    return parent


async def _play(c, assignment_id, *, wrong_on: str | None = None) -> None:
    attempt = (await c.post(f"/api/me/assignments/{assignment_id}/attempts")).json()
    for item in attempt["items"]:
        n = int(item["id"][1:])
        skill = "light" if n % 2 else "water"
        right = next(i for i, text in enumerate(item["options"]) if text.startswith("Right"))
        choice = (right + 1) % 4 if skill == wrong_on else right
        await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "choice": choice, "time_ms": 800},
        )
    await c.post(f"/api/me/attempts/{attempt['id']}/complete")


async def test_a_parent_reads_what_a_skill_means(
    session, client, teacher, student, account, monkeypatch: pytest.MonkeyPatch
) -> None:
    parent = await _family(session, account, student)
    fake = FakeModel({"help at home": HELP}, Meter())
    monkeypatch.setattr(help_at_home, "build_model", lambda *_: fake)
    async with client(parent) as c:
        found = await c.get(
            f"/api/me/children/{student.id}/skills/light/help",
            params={"subject": "Science", "label": "Light energy"},
        )
    assert found.status_code == 200
    assert found.json()["activity"]["steps"][0] == "Switch off the lights."


async def test_only_a_linked_parent_reaches_a_child(session, client, student, account) -> None:
    stranger = await account("parent", "Not Mum")
    async with client(stranger) as c:
        assert (await c.get(f"/api/me/children/{student.id}/skills/light/help")).status_code == 404
        cheered = await c.post(f"/api/me/children/{student.id}/cheers", json={"cheer": "proud"})
        assert cheered.status_code == 404


async def test_a_challenge_is_begun_on_the_skill_from_the_child_s_own_work(
    session, client, teacher, student, account
) -> None:
    assignment = await shared(session, teacher, [student])
    parent = await _family(session, account, student)
    async with client(student) as c:
        await _play(c, assignment.id, wrong_on="light")
    async with client(parent) as c:
        made = await c.post(f"/api/me/children/{student.id}/challenges", json={"skill": "light"})
        missing = await c.post(f"/api/me/children/{student.id}/challenges", json={"skill": "nope"})
    assert made.status_code == 202 and made.json()["skill"] == "Light energy"
    assert missing.status_code == 404
    learning_set = await session.get(LearningSet, made.json()["set_id"])
    assert learning_set is not None and learning_set.owner_id == parent.id
    assert learning_set.topic == "Light energy, from plants"


class FakeGeneration:
    def __init__(self, ending: dict) -> None:
        self.ending = ending

    async def events(self, set_id, request):
        yield {"type": "stage"}
        yield self.ending


PLAN = SkillPractice(
    topic="Light energy, from plants",
    subject="Science",
    grade_level="year_4",
    language="en",
    skills=(("light", "Light energy"),),
    sources=(),
)


async def test_a_challenge_goes_home_only_once_it_is_made(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import skill_practice

    delivered: list = []

    class Scope:
        async def __aenter__(self):
            return "db"

        async def __aexit__(self, *_):
            return False

    monkeypatch.setattr(skill_practice, "session_scope", Scope)

    async def deliver(db, set_id, outcome) -> None:
        delivered.append((db, set_id, outcome["type"]))

    made, failed = uuid4(), uuid4()
    await build_then(made, PLAN, FakeGeneration({"type": "done"}), deliver)
    await build_then(failed, PLAN, FakeGeneration({"type": "failed", "message": "x"}), deliver)
    assert delivered == [("db", made, "done")]


async def test_a_cheer_reaches_the_child_for_their_buddy_to_act_out(
    session, client, student, account
) -> None:
    parent = await _family(session, account, student)
    async with client(parent) as c:
        offered = (await c.get(f"/api/me/children/{student.id}/cheers")).json()["items"]
        sent = await c.post(f"/api/me/children/{student.id}/cheers", json={"cheer": "proud"})
        odd = await c.post(f"/api/me/children/{student.id}/cheers", json={"cheer": "you rock"})
    assert "proud" in [c["key"] for c in offered]
    assert sent.status_code == 201 and odd.status_code == 422
    note = await session.scalar(
        select(Notification).where(
            Notification.user_id == student.id, Notification.type == Kind.CHEER
        )
    )
    assert note is not None
    assert note.payload == {
        "cheer": "proud",
        "sticker": "🌟",
        "line": "So proud of you!",
        "mood": "celebrate",
        "label": "Mum",
    }


# --- a teacher's practice for these students -------------------------------------------


def test_the_students_who_found_a_skill_hard_are_the_red_ones() -> None:
    a, b, c = uuid4(), uuid4(), uuid4()
    heat = {str(a): {"light": 0.2}, str(b): {"light": 0.9}, str(c): {"water": 0.1}}
    assert who_found_it_hard(heat, "light") == [a]


async def test_practice_goes_to_just_the_students_who_found_it_hard(
    session, client, teacher, account
) -> None:
    struggling = await account("student", "Adam")
    fine = await account("student", "Mei")
    assignment = await shared(session, teacher, [struggling, fine])
    async with client(struggling) as c:
        await _play(c, assignment.id, wrong_on="light")
    async with client(fine) as c:
        await _play(c, assignment.id)
    async with client(teacher) as c:
        made = await c.post(f"/api/assignments/{assignment.id}/practice", json={"skill": "light"})
        again = await c.post(f"/api/assignments/{assignment.id}/practice", json={"skill": "light"})
        none = await c.post(f"/api/assignments/{assignment.id}/practice", json={"skill": "water"})
    # Practised again: the same group, not a second one.
    assert again.status_code == 202 and again.json()["group"] == "Practise: Light energy"
    assert made.status_code == 202
    assert (made.json()["students"], made.json()["group"]) == (1, "Practise: Light energy")
    assert none.status_code == 422
    group = await session.scalar(
        select(ClassGroup).where(ClassGroup.name == "Practise: Light energy")
    )
    assert group is not None
    found = await session.execute(
        select(GroupMember.student_id).where(GroupMember.group_id == group.id)
    )
    members = found.scalars().all()
    assert members == [struggling.id]
