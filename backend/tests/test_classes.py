"""Classes, invites, memberships and groups — the rules, one by one."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.notifications import Kind
from app.db.models.classroom import GroupMember
from app.db.models.notification import Notification
from app.events.registry import build_bus
from app.services.class_service import ClassService
from app.services.group_service import GroupService
from app.services.invite_service import CODE_ALPHABET, InviteService
from app.services.membership_service import MembershipService


@pytest.fixture
def classes(session) -> ClassService:
    return ClassService(session)


@pytest.fixture
def invites(session) -> InviteService:
    return InviteService(session)


@pytest.fixture
def memberships(session) -> MembershipService:
    return MembershipService(session, build_bus())


@pytest.fixture
def groups(session) -> GroupService:
    return GroupService(session)


@pytest.fixture
async def room(classes, teacher):
    return await classes.create(teacher, name="5 Bestari", subject="Science", grade_level="year_5")


async def _notes(session, user_id, kind: Kind) -> list[Notification]:
    return list(
        (
            await session.execute(
                select(Notification).where(
                    Notification.user_id == user_id, Notification.type == kind
                )
            )
        )
        .scalars()
        .all()
    )


# --- classes ------------------------------------------------------------


async def test_a_teacher_creates_a_class_with_an_invite_ready(classes, invites, teacher) -> None:
    room = await classes.create(teacher, name="  4 Cerdik ", theme="mint")
    assert room.name == "4 Cerdik"
    assert room.theme == "mint"
    invite = await invites.for_class(teacher.id, room.id)
    assert len(invite.token) >= 32
    assert len(invite.code) == 6
    assert set(invite.code) <= set(CODE_ALPHABET)


@pytest.mark.parametrize(
    "fields",
    [
        {"name": ""},
        {"name": "x" * 121},
        {"name": "ok", "grade_level": "grade_9"},
        {"name": "ok", "theme": "neon"},
    ],
)
async def test_a_class_is_validated(classes, teacher, fields) -> None:
    with pytest.raises(ValidationError):
        await classes.create(teacher, **fields)


async def test_another_teacher_cannot_see_or_touch_a_class(classes, account, room) -> None:
    stranger = await account("teacher")
    with pytest.raises(NotFoundError):
        await classes.get(stranger.id, room.id)
    with pytest.raises(NotFoundError):
        await classes.update(stranger.id, room.id, name="Mine now")


async def test_the_list_counts_students_requests_and_groups(
    classes, memberships, invites, groups, teacher, account, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    first, second = await account("student"), await account("student")
    await memberships.request(first, code)
    pending = await memberships.request(second, code)
    await memberships.approve(
        teacher.id, room.id, (await _membership_id(memberships, teacher, room, first))
    )
    await groups.create(teacher.id, room.id, name="Team Rocket")

    [summary] = await classes.list_for(teacher.id)
    assert (summary.students, summary.pending, summary.groups) == (1, 1, 1)
    assert pending.status == "requested"


async def test_archiving_hides_a_class_and_restoring_brings_it_back(classes, teacher, room) -> None:
    await classes.archive(teacher.id, room.id)
    assert await classes.list_for(teacher.id) == []
    assert [s.classroom.id for s in await classes.list_for(teacher.id, archived=True)] == [room.id]
    await classes.restore(teacher.id, room.id)
    assert [s.classroom.id for s in await classes.list_for(teacher.id)] == [room.id]


# --- invites ------------------------------------------------------------


async def test_an_invite_is_found_by_its_link_or_its_code(invites, teacher, room) -> None:
    invite = await invites.for_class(teacher.id, room.id)
    by_token = await invites.lookup(invite.token)
    by_code = await invites.lookup(invite.code.lower())
    assert by_token.class_id == by_code.class_id == room.id
    assert by_token.class_name == "5 Bestari"
    assert by_token.teacher_name == "Cikgu Aisyah"


async def test_rotating_retires_the_old_link_and_code(invites, teacher, room) -> None:
    old = await invites.for_class(teacher.id, room.id)
    old_token, old_code = old.token, old.code
    new = await invites.rotate(teacher.id, room.id)
    assert (new.token, new.code) != (old_token, old_code)
    for dead in (old_token, old_code):
        with pytest.raises(NotFoundError):
            await invites.lookup(dead)


@pytest.mark.parametrize("how", ["disabled", "expired", "archived", "unknown"])
async def test_every_dead_invite_answers_the_same_way(invites, classes, teacher, room, how) -> None:
    """Disabled, expired, archived or never existed: one message. Telling them
    apart would say which codes are real."""
    invite = await invites.for_class(teacher.id, room.id)
    token = invite.token
    if how == "disabled":
        await invites.configure(teacher.id, room.id, enabled=False)
    elif how == "expired":
        await invites.configure(
            teacher.id, room.id, expires_at=datetime.now(UTC) - timedelta(minutes=1)
        )
    elif how == "archived":
        await classes.archive(teacher.id, room.id)
    else:
        token = "nope" + token
    with pytest.raises(NotFoundError) as error:
        await invites.lookup(token)
    assert "ask your teacher" in str(error.value)


async def test_an_expiry_can_be_cleared(invites, teacher, room) -> None:
    await invites.configure(
        teacher.id, room.id, expires_at=datetime.now(UTC) - timedelta(minutes=1)
    )
    await invites.configure(teacher.id, room.id, clear_expiry=True)
    invite = await invites.for_class(teacher.id, room.id)
    assert (await invites.lookup(invite.token)).class_id == room.id


# --- joining --------------------------------------------------------------


async def test_asking_to_join_waits_for_the_teacher_and_tells_them(
    session, memberships, invites, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    outcome = await memberships.request(student, code)
    assert outcome.status == "requested"
    [note] = await _notes(session, teacher.id, Kind.JOIN_REQUEST)
    assert note.payload["student_name"] == "Adam"
    assert note.payload["class_name"] == "5 Bestari"
    assert note.payload["grade_label"] == "Year 4"


async def test_asking_twice_is_one_request(
    session, memberships, invites, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    again = await memberships.request(student, code)
    assert again.status == "pending"
    assert len(await _notes(session, teacher.id, Kind.JOIN_REQUEST)) == 1


async def test_only_students_join(memberships, invites, teacher, account, room) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    with pytest.raises(ForbiddenError):
        await memberships.request(await account("teacher"), code)


async def test_approval_admits_and_tells_the_student(
    session, memberships, invites, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    member = await memberships.approve(
        teacher.id, room.id, await _membership_id(memberships, teacher, room, student)
    )
    assert member.status == "approved"
    [welcome] = await _notes(session, student.id, Kind.JOIN_APPROVED)
    assert welcome.payload["class_name"] == "5 Bestari"
    [request] = await _notes(session, teacher.id, Kind.JOIN_REQUEST)
    assert request.payload["resolution"] == "approved"
    assert (await memberships.request(student, code)).status == "member"


async def test_rejection_is_quiet_for_the_student(
    session, memberships, invites, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    await memberships.reject(
        teacher.id, room.id, await _membership_id(memberships, teacher, room, student)
    )
    assert await _notes(session, student.id, Kind.JOIN_APPROVED) == []
    [request] = await _notes(session, teacher.id, Kind.JOIN_REQUEST)
    assert request.payload["resolution"] == "rejected"


async def test_a_rejected_student_may_ask_again(
    memberships, invites, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    await memberships.reject(
        teacher.id, room.id, await _membership_id(memberships, teacher, room, student)
    )
    assert (await memberships.request(student, code)).status == "requested"


async def test_approve_all_admits_everyone_waiting(
    memberships, invites, teacher, account, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    for _ in range(3):
        await memberships.request(await account("student"), code)
    assert await memberships.approve_all(teacher.id, room.id) == 3
    page = await memberships.members(teacher.id, room.id, status="approved")
    assert page.total == 3


async def test_a_teacher_cannot_decide_for_another_teachers_class(
    memberships, invites, teacher, student, account, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    membership_id = await _membership_id(memberships, teacher, room, student)
    stranger = await account("teacher")
    with pytest.raises(NotFoundError):
        await memberships.approve(stranger.id, room.id, membership_id)


async def test_a_decided_request_cannot_be_decided_again(
    memberships, invites, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    membership_id = await _membership_id(memberships, teacher, room, student)
    await memberships.approve(teacher.id, room.id, membership_id)
    with pytest.raises(ConflictError):
        await memberships.reject(teacher.id, room.id, membership_id)


# --- leaving and removal ---------------------------------------------------


async def test_removing_a_student_takes_them_out_of_every_group_but_keeps_the_record(
    session, memberships, invites, groups, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    membership_id = await _membership_id(memberships, teacher, room, student)
    await memberships.approve(teacher.id, room.id, membership_id)
    group = await groups.create(teacher.id, room.id, name="Readers")
    await groups.set_members(teacher.id, room.id, group.id, [student.id])

    await memberships.revoke(teacher.id, room.id, membership_id)

    page = await memberships.members(teacher.id, room.id, status="revoked")
    assert [m.student_id for m in page.items] == [student.id]
    left = (
        await session.execute(select(GroupMember).where(GroupMember.student_id == student.id))
    ).all()
    assert left == []


async def test_a_student_can_leave_and_sees_their_classes(
    memberships, invites, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    await memberships.approve(
        teacher.id, room.id, await _membership_id(memberships, teacher, room, student)
    )
    [mine] = await memberships.classes_of(student.id)
    assert (mine.class_name, mine.teacher_name, mine.status) == (
        "5 Bestari",
        "Cikgu Aisyah",
        "approved",
    )
    await memberships.leave(student.id, room.id)
    [after] = await memberships.classes_of(student.id)
    assert after.status == "left"


async def test_leaving_a_class_you_are_not_in_is_not_found(memberships, student, room) -> None:
    with pytest.raises(NotFoundError):
        await memberships.leave(student.id, room.id)


# --- groups ---------------------------------------------------------------


async def test_groups_have_unique_names_in_a_class(groups, teacher, room) -> None:
    await groups.create(teacher.id, room.id, name="Team A")
    with pytest.raises(ConflictError):
        await groups.create(teacher.id, room.id, name="team a")


async def test_only_admitted_students_can_be_in_a_group(
    memberships, invites, groups, teacher, student, account, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)  # still pending
    outsider = await account("student")
    group = await groups.create(teacher.id, room.id, name="Readers")
    with pytest.raises(ValidationError, match="2 of these"):
        await groups.set_members(teacher.id, room.id, group.id, [student.id, outsider.id])


async def test_a_student_can_be_in_several_groups(
    memberships, invites, groups, teacher, student, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    await memberships.request(student, code)
    await memberships.approve(
        teacher.id, room.id, await _membership_id(memberships, teacher, room, student)
    )
    first = await groups.create(teacher.id, room.id, name="Readers")
    second = await groups.create(teacher.id, room.id, name="Mathletes", colour="sun")
    await groups.set_members(teacher.id, room.id, first.id, [student.id])
    await groups.set_members(teacher.id, room.id, second.id, [student.id])
    listed = {view.group.name: view.member_ids for view in await groups.list(teacher.id, room.id)}
    assert listed == {"Readers": [student.id], "Mathletes": [student.id]}


async def test_setting_members_replaces_them(
    memberships, invites, groups, teacher, account, room
) -> None:
    code = (await invites.for_class(teacher.id, room.id)).code
    kids = [await account("student") for _ in range(3)]
    for kid in kids:
        await memberships.request(kid, code)
    await memberships.approve_all(teacher.id, room.id)
    group = await groups.create(teacher.id, room.id, name="Readers")
    await groups.set_members(teacher.id, room.id, group.id, [kids[0].id, kids[1].id])
    view = await groups.set_members(teacher.id, room.id, group.id, [kids[2].id])
    assert view.member_ids == [kids[2].id]


async def test_a_group_in_someone_elses_class_is_not_found(groups, teacher, account, room) -> None:
    group = await groups.create(teacher.id, room.id, name="Readers")
    stranger = await account("teacher")
    with pytest.raises(NotFoundError):
        await groups.delete(stranger.id, room.id, group.id)
    with pytest.raises(NotFoundError):
        await groups.delete(teacher.id, uuid4(), group.id)


async def _membership_id(memberships, teacher, room, student):
    page = await memberships.members(teacher.id, room.id)
    return next(m.membership_id for m in page.items if m.student_id == student.id)
