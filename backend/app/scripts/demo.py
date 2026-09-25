"""A classroom to try Mentora with: `make demo`.

Seeds a demo teacher, a class, three students who have already played, and
three shared sets with real content — so a fresh install shows a lively home
page, a leaderboard with people on it, and results worth reading. Add your
own student to the class with `make demo join=yourname`.

Development only: refuses to run when APP_ENV=production. Idempotent — run it
again and it finds what it made rather than making it twice.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.roles import Role
from app.core.security import hash_password
from app.db.models.classroom import Classroom
from app.db.models.learning import LearningSet, LearningSetVersion
from app.db.models.user import User
from app.db.session import session_scope
from app.events.registry import build_bus
from app.scripts.demo_content import (
    CARD_SKILLS,
    CARDS,
    PLANET_SKILLS,
    PLANETS,
    WATER_CYCLE,
    WATER_SKILLS,
)
from app.services.assignment_service import AssignmentService, ShareSettings
from app.services.attempt_service import AttemptService
from app.services.class_service import ClassService
from app.services.invite_service import InviteService
from app.services.membership_service import MembershipService
from app.services.play_service import PlayService

logger = logging.getLogger("demo")

TEACHER_EMAIL = "cikgu.demo@mentora.local"
# Demo-only accounts on a development install, printed when the seed runs.
TEACHER_PASSWORD = "demo-teacher-1"  # noqa: S105
STUDENT_PASSWORD = "demo-student-1"  # noqa: S105
CLASS_NAME = "4 Cerdik (demo)"


@dataclass(frozen=True, slots=True)
class DemoStudent:
    username: str
    name: str
    buddy: str
    # How many of the water-cycle questions they get right, first try.
    right: int


STUDENTS = (
    DemoStudent("aina.demo", "Aina", "momo", 6),
    DemoStudent("hafiz.demo", "Hafiz", "rimau", 4),
    DemoStudent("mei.demo", "Mei Ling", "ollie", 5),
)


async def _user(session: AsyncSession, **match: Any) -> User | None:
    column, value = next(iter(match.items()))
    return (
        await session.execute(select(User).where(getattr(User, column) == value))
    ).scalar_one_or_none()


async def _teacher(session: AsyncSession) -> User:
    found = await _user(session, email=TEACHER_EMAIL)
    if found:
        return found
    teacher = User(
        email=TEACHER_EMAIL,
        password_hash=hash_password(TEACHER_PASSWORD),
        display_name="Cikgu Demo",
        role=Role.TEACHER.value,
        is_active=True,
        onboarded_at=datetime.now(UTC),
    )
    session.add(teacher)
    await session.flush()
    return teacher


async def _student(session: AsyncSession, demo: DemoStudent) -> User:
    found = await _user(session, username=demo.username)
    if found:
        return found
    student = User(
        username=demo.username,
        password_hash=hash_password(STUDENT_PASSWORD),
        display_name=demo.name,
        role=Role.STUDENT.value,
        grade_level="year_4",
        buddy=demo.buddy,
        is_active=True,
        onboarded_at=datetime.now(UTC),
    )
    session.add(student)
    await session.flush()
    return student


async def _classroom(session: AsyncSession, teacher: User, students: list[User]) -> Classroom:
    room = (
        await session.execute(
            select(Classroom).where(
                Classroom.teacher_id == teacher.id, Classroom.name == CLASS_NAME
            )
        )
    ).scalar_one_or_none()
    if room is None:
        room = await ClassService(session).create(
            teacher, name=CLASS_NAME, subject="Science", grade_level="year_4", theme="lagoon"
        )
    code = (await InviteService(session).for_class(teacher.id, room.id)).code
    members = MembershipService(session, build_bus())
    for student in students:
        # Asking again as a member, or while waiting, is a no-op.
        await members.request(student, code)
    await members.approve_all(teacher.id, room.id)
    return room


async def _set(
    session: AsyncSession,
    teacher: User,
    *,
    kind: str,
    title: str,
    items: list[dict[str, Any]],
    skills: list[dict[str, str]],
) -> LearningSet:
    found = (
        await session.execute(
            select(LearningSet).where(
                LearningSet.owner_id == teacher.id, LearningSet.title == title
            )
        )
    ).scalar_one_or_none()
    if found:
        return found
    learning_set = LearningSet(
        owner_id=teacher.id,
        purpose="assign",
        kind=kind,
        title=title,
        topic=title,
        subject="Science",
        grade_level="year_4",
        status="ready",
        current_version=1,
        requested_count=len(items),
    )
    session.add(learning_set)
    await session.flush()
    session.add(
        LearningSetVersion(
            set_id=learning_set.id, version=1, items=items, skills=skills, sources=[]
        )
    )
    await session.flush()
    return learning_set


async def _share(
    session: AsyncSession, teacher: User, learning_set: LearningSet, room: Classroom, **settings
):
    service = AssignmentService(session, build_bus())
    for shared in await service.for_class(teacher.id, room.id):
        if shared.assignment.set_id == learning_set.id:
            return shared.assignment
    view = await service.share(teacher, learning_set.id, room.id, ShareSettings(**settings))
    return view.assignment


async def _play(session: AsyncSession, student: User, assignment_id, right: int) -> None:
    """Take the quiz as this student, getting the first `right` questions right."""
    attempts = AttemptService(session)
    view = await attempts.start(student, assignment_id)
    if view.attempt.status == "completed":
        return
    by_id = {i["id"]: i for i in WATER_CYCLE}
    for n, shown in enumerate(view.items):
        real = by_id[shown["id"]]["answer"]
        position = shown["options"].index(by_id[shown["id"]]["options"][real])
        choice = position if n < right else (position + 1) % len(shown["options"])
        await attempts.answer(student.id, view.attempt.id, shown["id"], {"choice": choice}, 4000)
    await PlayService(session, build_bus()).finish(student, view.attempt.id)


async def seed_demo(join: list[str]) -> None:
    async with session_scope() as session:
        teacher = await _teacher(session)
        demo_students = [await _student(session, s) for s in STUDENTS]
        extra = [u for name in join if (u := await _user(session, username=name.lower()))]
        missing = sorted({n.lower() for n in join} - {u.username for u in extra})
        room = await _classroom(session, teacher, [*demo_students, *extra])

        water = await _set(
            session,
            teacher,
            kind="quiz",
            title="The Water Cycle",
            items=WATER_CYCLE,
            skills=WATER_SKILLS,
        )
        cards = await _set(
            session,
            teacher,
            kind="flashcard",
            title="Animals of Malaysia",
            items=CARDS,
            skills=CARD_SKILLS,
        )
        planets = await _set(
            session,
            teacher,
            kind="quiz",
            title="Our Solar System",
            items=PLANETS,
            skills=PLANET_SKILLS,
        )
        quiz = await _share(session, teacher, water, room, allow_retakes=True, max_attempts=3)
        await _share(session, teacher, cards, room, leaderboard_enabled=False)
        await _share(
            session,
            teacher,
            planets,
            room,
            feedback_mode="end",
            due_at=datetime.now(UTC) + timedelta(days=3),
        )
        for student, demo in zip(demo_students, STUDENTS, strict=True):
            await _play(session, student, quiz.id, demo.right)

    print(f"\nDemo class: {CLASS_NAME}")
    print(f"  teacher   {TEACHER_EMAIL} / {TEACHER_PASSWORD}")
    for demo in STUDENTS:
        print(f"  student   {demo.username} / {STUDENT_PASSWORD}")
    for student in extra:
        print(f"  joined    {student.username} (your own password)")
    for name in missing:
        print(f"  not found {name} — sign them up first, then run this again")


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    if settings.app_env == "production":
        raise SystemExit("make demo is for development; APP_ENV is production.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--join", nargs="*", default=[], help="student usernames to add")
    asyncio.run(seed_demo(parser.parse_args().join))


if __name__ == "__main__":
    main()
