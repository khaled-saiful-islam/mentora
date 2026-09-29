"""A parent and their child's teacher writing to each other: who may, what
each side sees, the bell, and the gate closing when a link ends."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select, update

from app.core.errors import NotFoundError, ValidationError
from app.core.notifications import Kind
from app.db.models.classroom import ClassMembership, Classroom
from app.db.models.family import FamilyLink
from app.db.models.notification import Notification
from app.services.parent_teacher.service import MAX_BODY, ParentTeacherService
from app.services.realtime import hub
from tests.play_helpers import class_with


@pytest.fixture
async def family(session, account, teacher, student):
    """Adam in Cikgu Aisyah's class, and his mum following along."""
    mum = await account("parent", "Puan Rohana")
    session.add(FamilyLink(parent_id=mum.id, student_id=student.id, label="Mum"))
    class_id = await class_with(session, teacher, [student])
    await session.flush()
    return mum, class_id


async def _bell(session, user_id) -> list[Notification]:
    found = await session.scalars(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == Kind.PARENT_TEACHER_MESSAGE.value,
        )
    )
    return list(found.all())


async def test_each_side_sees_the_other_as_a_contact(session, family, teacher, student) -> None:
    mum, class_id = family
    talk = ParentTeacherService(session)
    [to_teacher] = await talk.contacts(mum)
    assert (to_teacher.person_id, to_teacher.student_id) == (teacher.id, student.id)
    assert to_teacher.relation == "Teacher"
    assert to_teacher.class_ids == (class_id,)
    [to_mum] = await talk.contacts(teacher)
    assert (to_mum.person_id, to_mum.relation, to_mum.student_name) == (mum.id, "Mum", "Adam")


async def test_a_student_cannot_message(session, family, student) -> None:
    from app.core.errors import ForbiddenError

    with pytest.raises(ForbiddenError):
        await ParentTeacherService(session).contacts(student)


async def test_opening_twice_is_one_thread(session, family, teacher, student) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    first = await talk.open(mum, student.id, teacher.id)
    again = await talk.open(teacher, student.id, mum.id)
    assert first.thread.id == again.thread.id


async def test_a_stranger_cannot_open_a_thread(session, account, family, student) -> None:
    other_teacher = await account("teacher", "Cikgu Lain")
    mum, _ = family
    with pytest.raises(NotFoundError):
        await ParentTeacherService(session).open(mum, student.id, other_teacher.id)
    with pytest.raises(NotFoundError):
        await ParentTeacherService(session).open(other_teacher, student.id, mum.id)


async def test_a_message_reaches_the_other_side_unread(session, family, teacher, student) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    await talk.send(mum, thread.id, "  How is Adam doing with fractions?  ")
    [inbox] = await talk.threads(teacher)
    assert inbox.unread == 1
    assert inbox.last is not None and inbox.last.body == "How is Adam doing with fractions?"
    # The writer has read their own message.
    assert (await talk.threads(mum))[0].unread == 0
    assert await talk.unread_total(teacher) == 1
    await talk.read(teacher, thread.id)
    assert await talk.unread_total(teacher) == 0


async def test_an_empty_thread_is_not_in_the_list(session, family, teacher, student) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    await talk.open(mum, student.id, teacher.id)
    assert await talk.threads(mum) == []
    assert await talk.threads(teacher) == []


async def test_the_bell_rings_once_a_thread_until_read(session, family, teacher, student) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    await talk.send(mum, thread.id, "Hello Cikgu")
    await talk.send(mum, thread.id, "One more thing")
    [note] = await _bell(session, teacher.id)
    assert note.count == 2
    assert note.payload["thread_id"] == str(thread.id)
    assert note.payload["student_name"] == "Adam"
    assert note.payload["from_side"] == "parent"
    assert await _bell(session, mum.id) == []
    await talk.read(teacher, thread.id)
    await session.refresh(note)
    assert note.read_at is not None


async def test_messages_page_back_in_time(session, family, teacher, student) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    for n in range(5):
        await talk.send(mum if n % 2 else teacher, thread.id, f"message {n}")
    newest = await talk.messages(mum, thread.id, limit=3)
    assert [m.body for m in newest.items] == ["message 2", "message 3", "message 4"]
    assert newest.has_more
    older = await talk.messages(mum, thread.id, before=newest.items[0].id, limit=3)
    assert [m.body for m in older.items] == ["message 0", "message 1"]
    assert not older.has_more


@pytest.mark.parametrize("body", ["", "   ", "x" * (MAX_BODY + 1)])
async def test_a_message_must_say_something_short_enough(
    session, family, teacher, student, body
) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    with pytest.raises(ValidationError):
        await talk.send(mum, thread.id, body)


async def test_the_thread_closes_when_the_child_leaves_the_class(
    session, family, teacher, student
) -> None:
    mum, class_id = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    await talk.send(mum, thread.id, "Hello")
    await session.execute(
        update(ClassMembership).where(ClassMembership.class_id == class_id).values(status="left")
    )
    assert await talk.threads(mum) == []
    assert await talk.threads(teacher) == []
    with pytest.raises(NotFoundError):
        await talk.send(teacher, thread.id, "Are you there?")


async def test_the_thread_closes_when_the_class_is_archived(
    session, family, teacher, student
) -> None:
    mum, class_id = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    room = await session.get(Classroom, class_id)
    room.archived_at = room.created_at
    await session.flush()
    with pytest.raises(NotFoundError):
        await talk.thread(mum, thread.id)


async def test_the_thread_closes_when_the_family_link_ends(
    session, family, teacher, student
) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    link = await session.scalar(select(FamilyLink).where(FamilyLink.parent_id == mum.id))
    await session.delete(link)
    await session.flush()
    with pytest.raises(NotFoundError):
        await talk.messages(teacher, thread.id)


async def test_someone_elses_thread_is_not_found(session, account, family, teacher, student):
    mum, _ = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    dad = await account("parent", "Encik Rahman")
    session.add(FamilyLink(parent_id=dad.id, student_id=student.id, label="Dad"))
    await session.flush()
    with pytest.raises(NotFoundError):
        await talk.thread(dad, thread.id)
    with pytest.raises(NotFoundError):
        await talk.thread(mum, uuid4())


# --- over HTTP ------------------------------------------------------------


async def test_the_api_round_trip(session, client, family, teacher, student) -> None:
    mum, _ = family
    async with client(mum) as as_mum, client(teacher) as as_teacher:
        inbox = (await as_mum.get("/api/messages")).json()
        [contact] = inbox["contacts"]
        opened = await as_mum.post(
            "/api/messages/threads",
            json={"student_id": contact["student_id"], "person_id": contact["person_id"]},
        )
        assert opened.status_code == 200
        thread_id = opened.json()["id"]
        sent = await as_mum.post(
            f"/api/messages/threads/{thread_id}/messages", json={"body": "Hi Cikgu"}
        )
        assert sent.status_code == 200 and sent.json()["mine"] is True
        assert (await as_teacher.get("/api/messages/unread")).json() == {"unread": 1}
        page = (await as_teacher.get(f"/api/messages/threads/{thread_id}/messages")).json()
        assert [(m["body"], m["mine"]) for m in page["items"]] == [("Hi Cikgu", False)]
        read = await as_teacher.post(f"/api/messages/threads/{thread_id}/read")
        assert read.json() == {"unread": 0}


async def test_a_student_is_refused_at_the_door(client, family, student) -> None:
    async with client(student) as as_student:
        assert (await as_student.get("/api/messages")).status_code == 403


async def test_an_empty_message_is_refused(client, family, teacher, student) -> None:
    mum, _ = family
    async with client(mum) as as_mum:
        opened = await as_mum.post(
            "/api/messages/threads",
            json={"student_id": str(student.id), "person_id": str(teacher.id)},
        )
        response = await as_mum.post(
            f"/api/messages/threads/{opened.json()['id']}/messages", json={"body": ""}
        )
        assert response.status_code == 422


async def test_both_sides_hear_a_message_live(session, family, teacher, student) -> None:
    mum, _ = family
    talk = ParentTeacherService(session)
    thread = (await talk.open(mum, student.id, teacher.id)).thread
    await talk.send(mum, thread.id, "Hello")
    pending = session.info.get("mentora.realtime.pending", [])
    pushed = {(user_id, m.get("topic")) for user_id, m in pending}
    assert (teacher.id, "messages") in pushed and (mum.id, "messages") in pushed
    assert hub is not None


# --- families not connected yet ---------------------------------------------


async def test_a_teacher_sees_who_has_no_family_yet(session, account, family, teacher, student):
    from app.services.parent_teacher.invites import unconnected

    mum, _ = family
    lone = await account("student", "Hana")
    await class_with(session, teacher, [lone])
    waiting = await unconnected(session, teacher)
    assert [w.student_name for w in waiting] == ["Hana"]
    assert await unconnected(session, mum) == []


async def test_asking_a_student_to_connect_rings_once_a_day(session, account, teacher) -> None:
    from datetime import UTC, datetime, timedelta

    from app.services.parent_teacher.invites import ask_family

    lone = await account("student", "Hana")
    await class_with(session, teacher, [lone])
    assert await ask_family(session, teacher, lone.id) is True
    assert await ask_family(session, teacher, lone.id) is False
    [note] = (
        await session.scalars(
            select(Notification).where(
                Notification.user_id == lone.id, Notification.type == Kind.FAMILY_ASKED.value
            )
        )
    ).all()
    assert note.payload == {"teacher_name": "Cikgu Aisyah", "class_name": "5 Bestari"}
    tomorrow = datetime.now(UTC) + timedelta(days=1, minutes=1)
    assert await ask_family(session, teacher, lone.id, now=tomorrow) is True


async def test_only_a_waiting_student_can_be_asked(session, account, family, teacher, student):
    from app.services.parent_teacher.invites import ask_family

    mum, _ = family
    with pytest.raises(NotFoundError):  # Adam's mum is already connected
        await ask_family(session, teacher, student.id)
    stranger = await account("student", "Zul")
    with pytest.raises(NotFoundError):  # not in this teacher's classes
        await ask_family(session, teacher, stranger.id)
    with pytest.raises(NotFoundError):  # a parent has no one to ask
        await ask_family(session, mum, student.id)


async def test_the_inbox_lists_who_to_ask(client, session, account, teacher) -> None:
    lone = await account("student", "Hana")
    await class_with(session, teacher, [lone])
    async with client(teacher) as as_teacher:
        inbox = (await as_teacher.get("/api/messages")).json()
        assert [w["student_name"] for w in inbox["waiting"]] == ["Hana"]
        asked = await as_teacher.post("/api/messages/ask-family", json={"student_id": str(lone.id)})
        assert asked.json() == {"sent": True}
