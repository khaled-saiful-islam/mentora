"""The admin console: accounts, the overview, moderation and content."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.errors import ValidationError
from app.core.passwords import temporary_password
from app.core.security import verify_password
from app.db.models.classroom import Classroom
from app.db.models.conversation import Conversation
from app.db.models.user import User
from app.db.repositories.artifacts import SqlArtifactRepository
from app.moderation.base import Flag
from app.services.admin_service import AdminService
from app.services.auth_service import mark_seen
from app.services.moderation_service import ModerationService, Where
from app.services.quota import TokenQuota
from tests.play_helpers import class_with, ready_set, shared


@pytest.fixture
async def admin(account) -> User:
    return await account("admin", "Puan Admin")


# --- accounts --------------------------------------------------------------


async def test_the_users_page_filters_counts_and_pages(session, admin, account) -> None:
    await account("student", "Siti Nurhaliza")
    await account("teacher", "Cikgu Siti")
    service = AdminService(session)

    sitis = await service.page(q="siti")
    assert sitis.total >= 2 and all(
        "siti" in (m.user.display_name or "").lower() for m in sitis.items
    )
    students = await service.page(q="siti", role="student")
    assert [m.user.role for m in students.items] == ["student"]
    first = await service.page(limit=1)
    assert len(first.items) == 1 and first.total > 1


async def test_a_page_of_usage_matches_one_account_at_a_time(session, teacher, student) -> None:
    quota = TokenQuota(session)
    many = await quota.usage_many({teacher.id: 100, student.id: None})
    assert many[teacher.id] == await quota.usage(teacher.id, 100)
    assert many[student.id] == await quota.usage(student.id, None)


async def test_deleting_needs_the_name_typed_and_takes_everything_with_it(
    session, admin, teacher, student
) -> None:
    class_id = await class_with(session, teacher, [student])
    service = AdminService(session)
    footprint = await service.footprint(teacher.id)
    assert (footprint.classes, footprint.students) == (1, 1)

    with pytest.raises(ValidationError, match="to confirm"):
        await service.delete(teacher.id, acting_admin_id=admin.id, confirm="someone else")
    teacher_id, student_id = teacher.id, student.id
    await service.delete(teacher_id, acting_admin_id=admin.id, confirm=teacher.email.upper())
    session.expire_all()
    assert await session.get(User, teacher_id) is None
    assert await session.get(Classroom, class_id) is None
    assert await session.get(User, student_id) is not None


async def test_an_admin_cannot_delete_themselves(session, admin) -> None:
    with pytest.raises(ValidationError, match="your own"):
        await AdminService(session).delete(admin.id, acting_admin_id=admin.id, confirm=admin.email)


async def test_a_reset_gives_a_readable_password_that_works_once_given(
    session, admin, student
) -> None:
    user, password = await AdminService(session).reset_password(
        student.id, acting_admin_id=admin.id
    )
    assert user.id == student.id
    assert re.fullmatch(r"[a-z]+-[a-z]+-\d{2}", password)
    assert verify_password(password, student.password_hash)
    with pytest.raises(ValidationError):
        await AdminService(session).reset_password(admin.id, acting_admin_id=admin.id)


def test_temporary_passwords_are_long_enough_and_vary() -> None:
    found = {temporary_password() for _ in range(50)}
    assert len(found) > 40 and all(len(p) >= 8 for p in found)


async def test_a_teacher_resets_only_their_own_students(
    session, client, teacher, student, account
) -> None:
    class_id = await class_with(session, teacher, [student])
    stranger = await account("teacher", "Cikgu Lain")
    async with client(teacher) as c:
        members = (await c.get(f"/api/classes/{class_id}/members")).json()["items"]
        membership = members[0]["membership_id"]
        reset = await c.post(f"/api/classes/{class_id}/members/{membership}/password")
    assert reset.status_code == 200
    assert reset.json()["sign_in_name"] == student.username
    await session.refresh(student)
    assert verify_password(reset.json()["password"], student.password_hash)
    async with client(stranger) as c:
        refused = await c.post(f"/api/classes/{class_id}/members/{membership}/password")
    assert refused.status_code == 404


def test_being_seen_is_noted_at_most_every_ten_minutes() -> None:
    user = User(role="student")
    now = datetime.now(UTC)
    assert mark_seen(user, now) is True
    assert mark_seen(user, now + timedelta(minutes=5)) is False
    assert mark_seen(user, now + timedelta(minutes=11)) is True


# --- overview, moderation and content, over HTTP ----------------------------


async def test_the_overview_counts_people_learning_and_safety(
    session, client, admin, teacher, student
) -> None:
    await shared(session, teacher, [student])
    await ModerationService(session).record(
        Flag(kind="support", source="user_input", severity="high"), Where(user_id=student.id)
    )
    async with client(admin) as c:
        body = (await c.get("/api/admin/overview")).json()
    assert body["users"]["students"] >= 1 and body["users"]["teachers"] >= 1
    assert body["learning"]["assignments"] >= 1
    assert body["safety"]["high"] >= 1 and body["safety"]["open"] >= 1
    assert len(body["trend"]) == 14


async def test_the_moderation_queue_is_reviewed_over_http(session, client, admin, student) -> None:
    event = await ModerationService(session).record(
        Flag(kind="held", source="user_input", severity="medium", excerpt="show me porn"),
        Where(user_id=student.id),
    )
    async with client(admin) as c:
        queue = (await c.get("/api/admin/moderation")).json()
        mine = [i for i in queue["items"] if i["id"] == str(event.id)]
        reviewed = await c.patch(
            f"/api/admin/moderation/{event.id}", json={"status": "dismissed", "note": "a test"}
        )
        after = (await c.get("/api/admin/moderation")).json()
    assert mine and mine[0]["user"]["name"] == "Adam" and mine[0]["excerpt"] == "show me porn"
    assert reviewed.json()["status"] == "dismissed"
    assert str(event.id) not in [i["id"] for i in after["items"]]


async def test_content_is_browsed_and_documents_stay_sandboxed(
    session, client, admin, teacher
) -> None:
    conversation = Conversation(user_id=teacher.id, title="Posters")
    session.add(conversation)
    await session.flush()
    artifact = await SqlArtifactRepository(session).create(
        conversation_id=conversation.id,
        user_id=teacher.id,
        message_id=None,
        kind="poster",
        title="Hari Sukan poster",
        html="<!doctype html><title>x</title><p>Hari Sukan</p>",
        design_spec={},
    )
    learning_set = await ready_set(session, teacher)
    async with client(admin) as c:
        found = (await c.get("/api/admin/content/artifacts", params={"q": "sukan"})).json()
        raw = await c.get(f"/api/admin/content/artifacts/{artifact.id}/raw")
        sets = (await c.get("/api/admin/content/sets", params={"kind": "quiz"})).json()
        detail = (await c.get(f"/api/admin/content/sets/{learning_set.id}")).json()
    assert [a["title"] for a in found] == ["Hari Sukan poster"]
    assert found[0]["owner"]["id"] == str(teacher.id)
    assert "sandbox" in raw.headers["content-security-policy"]
    assert str(learning_set.id) in [s["id"] for s in sets]
    assert detail["item_count"] == 5 and len(detail["items"]) == 5


async def test_the_console_is_for_admins_only(client, teacher, student) -> None:
    for user in (teacher, student):
        async with client(user) as c:
            for path in ("/api/admin/overview", "/api/admin/moderation", "/api/admin/content/sets"):
                assert (await c.get(path)).status_code == 403, (user.role, path)


async def test_a_deleted_student_s_moderation_record_goes_with_them(
    session, admin, student
) -> None:
    await ModerationService(session).record(
        Flag(kind="support", source="user_input", severity="high"), Where(user_id=student.id)
    )
    student_id = student.id
    await AdminService(session).delete(
        student_id, acting_admin_id=admin.id, confirm=student.username
    )
    session.expire_all()
    left = await ModerationService(session).queue(status=None)
    assert all(item.event.user_id != student_id for item in left)
    assert (await session.execute(select(User).where(User.id == student_id))).first() is None
