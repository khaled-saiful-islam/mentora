"""Building a class with a shared quiz, straight in the database, for the
play tests — no model, no HTTP, just the rows the engine needs."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.db.models.learning import LearningSet, LearningSetVersion
from app.events.registry import build_bus
from app.services.assignment_service import AssignmentService, ShareSettings
from app.services.class_service import ClassService
from app.services.invite_service import InviteService
from app.services.membership_service import MembershipService

SKILLS = [{"slug": "light", "label": "Light energy"}, {"slug": "water", "label": "Water"}]


def quiz_items(n: int = 5) -> list[dict]:
    return [
        {
            "id": f"q{i}",
            "prompt": f"Question {i}?",
            "options": [f"Right {i}", f"Wrong {i}a", f"Wrong {i}b", f"Wrong {i}c"],
            "answer": 0,
            "explanation": f"Because {i}.",
            "skill": "light" if i % 2 else "water",
            "difficulty": "easy",
            "source_ids": [],
        }
        for i in range(1, n + 1)
    ]


def card_items(n: int = 4) -> list[dict]:
    return [
        {
            "id": f"c{i}",
            "front": f"Front {i}",
            "back": f"Back {i}",
            "hint": "",
            "skill": "light",
            "source_ids": [],
        }
        for i in range(1, n + 1)
    ]


async def ready_set(
    session, owner, *, kind: str = "quiz", purpose: str = "assign", n: int = 5
) -> LearningSet:
    learning_set = LearningSet(
        owner_id=owner.id, purpose=purpose, kind=kind, title=f"A {kind}", topic="plants",
        subject="Science", status="ready", current_version=1, requested_count=n,
    )  # fmt: skip
    session.add(learning_set)
    await session.flush()
    items = quiz_items(n) if kind == "quiz" else card_items(n)
    session.add(
        LearningSetVersion(
            set_id=learning_set.id, version=1, items=items, skills=SKILLS, sources=[]
        )
    )
    await session.flush()
    return learning_set


async def class_with(session, teacher, students) -> UUID:
    room = await ClassService(session).create(teacher, name="5 Bestari")
    code = (await InviteService(session).for_class(teacher.id, room.id)).code
    members = MembershipService(session, build_bus())
    for student in students:
        await members.request(student, code)
    await members.approve_all(teacher.id, room.id)
    return room.id


async def shared(
    session, teacher, students, *, kind="quiz", n=5, due_at: datetime | None = None, **settings
):
    learning_set = await ready_set(session, teacher, kind=kind, n=n)
    class_id = await class_with(session, teacher, students)
    view = await AssignmentService(session, build_bus()).share(
        teacher, learning_set.id, class_id, ShareSettings(due_at=due_at, **settings)
    )
    return view.assignment


def right_choice(attempt_view, item_id: str) -> int:
    """The shown position of the right answer (option text starts 'Right')."""
    item = next(i for i in attempt_view.items if i["id"] == item_id)
    return next(n for n, text in enumerate(item["options"]) if text.startswith("Right"))
