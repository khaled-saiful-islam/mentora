"""The demo's parent–teacher conversation: there after a seed, and the same
after a second one."""

from __future__ import annotations

from uuid import uuid4

from app.db.models.family import FamilyLink
from app.scripts.demo_messages import EXCHANGE, seed_messages
from app.services.parent_teacher.service import ParentTeacherService
from tests.play_helpers import class_with


async def test_the_demo_teacher_has_a_message_waiting(session, account, teacher) -> None:
    child = await account("student", "Aina")
    mum = await account("parent", f"Nora {uuid4().hex[:4]}")
    session.add(FamilyLink(parent_id=mum.id, student_id=child.id, label="Mum"))
    await class_with(session, teacher, [child])
    await session.flush()
    await seed_messages(session, mum, teacher, child)
    await seed_messages(session, mum, teacher, child)
    talk = ParentTeacherService(session)
    [thread] = await talk.threads(teacher)
    page = await talk.messages(teacher, thread.thread.id)
    assert len(page.items) == len(EXCHANGE)
    assert thread.unread == 1  # the mum's thank-you, after the teacher's reply
