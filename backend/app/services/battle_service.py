"""Class Battle (§28.3.6): a teacher opens a battle for a class, from a quiz
or a game of theirs; the class's students are told and join on their own
devices; the class screen and every device follow the room.

Who may do what is checked here, against the database: the battle itself
lives in memory (`app/battles/hub.py`).
"""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.battles.hub import BattleHub
from app.battles.questions import LEAST_QUESTIONS, battle_questions
from app.battles.room import BattleRoom, Mode
from app.core.errors import NotFoundError, ValidationError
from app.core.notifications import Kind
from app.db.models.classroom import ClassMembership
from app.db.models.learning import LearningSet, LearningSetVersion
from app.db.models.user import User
from app.db.repositories.classes import ClassRepository
from app.services.notification_service import NotificationService

MODES: tuple[Mode, ...] = ("tug", "boss")
KINDS = ("quiz", "game")


class BattleService:
    def __init__(self, session: AsyncSession, hub: BattleHub) -> None:
        self._session = session
        self._hub = hub

    async def open(self, teacher: User, *, class_id: UUID, set_id: UUID, mode: str) -> BattleRoom:
        """A battle for the class, in its lobby, and the students told."""
        if mode not in MODES:
            raise ValidationError("A battle is a Tug-of-War or Class vs Boss.")
        classroom = await ClassRepository(self._session).owned(class_id, teacher.id)
        if classroom is None:
            raise NotFoundError("No such class.")
        if self._hub.of_class(class_id) is not None:
            raise ValidationError("This class already has a battle going. End it first.")
        learning_set, items = await self._set(teacher.id, set_id)
        questions = battle_questions(learning_set.kind, items, seed=str(uuid4()))
        if len(questions) < LEAST_QUESTIONS:
            raise ValidationError("This needs at least 4 questions for a battle.")
        room = self._hub.add(
            BattleRoom(
                id=uuid4(),
                class_id=class_id,
                teacher_id=teacher.id,
                title=learning_set.title,
                mode=mode,  # type: ignore[arg-type]
                questions=questions,
            )
        )
        await self._tell(room, classroom.name, teacher)
        return room

    async def _set(self, teacher_id: UUID, set_id: UUID) -> tuple[LearningSet, list[dict]]:
        learning_set = await self._session.scalar(
            select(LearningSet).where(
                LearningSet.id == set_id,
                LearningSet.owner_id == teacher_id,
                LearningSet.status == "ready",
            )
        )
        if learning_set is None or learning_set.kind not in KINDS:
            raise NotFoundError("Battles are made from your quizzes and games.")
        version = await self._session.scalar(
            select(LearningSetVersion).where(
                LearningSetVersion.set_id == set_id,
                LearningSetVersion.version == learning_set.current_version,
            )
        )
        if version is None:
            raise NotFoundError("That set isn't ready.")
        return learning_set, list(version.items)

    async def _tell(self, room: BattleRoom, class_name: str, teacher: User) -> None:
        notes = NotificationService(self._session)
        for student_id in await self._members(room.class_id):
            await notes.notify(
                user_id=student_id,
                kind=Kind.BATTLE,
                actor_id=teacher.id,
                payload={
                    "battle_id": str(room.id),
                    "title": room.title,
                    "class_name": class_name,
                    "mode": room.mode,
                },
            )

    async def _members(self, class_id: UUID) -> list[UUID]:
        rows = await self._session.execute(
            select(ClassMembership.student_id).where(
                ClassMembership.class_id == class_id, ClassMembership.status == "approved"
            )
        )
        return list(rows.scalars())

    # --- the room, for those who may see it ------------------------------------------

    def room(self, battle_id: UUID) -> BattleRoom:
        room = self._hub.get(battle_id)
        if room is None:
            raise NotFoundError("That battle is over.")
        return room

    def teachers(self, teacher: User, battle_id: UUID) -> BattleRoom:
        room = self.room(battle_id)
        if room.teacher_id != teacher.id:
            raise NotFoundError("That battle is over.")
        return room

    async def students(self, student: User, battle_id: UUID) -> BattleRoom:
        room = self.room(battle_id)
        if student.id not in await self._members(room.class_id):
            raise NotFoundError("That battle is over.")
        return room

    async def watching(self, user: User, battle_id: UUID) -> BattleRoom:
        """The room, for its teacher or a student of its class."""
        room = self.room(battle_id)
        if room.teacher_id == user.id:
            return room
        return await self.students(user, battle_id)

    async def mine(self, student: User) -> list[BattleRoom]:
        """Battles on now in the student's classes."""
        rows = await self._session.execute(
            select(ClassMembership.class_id).where(
                ClassMembership.student_id == student.id, ClassMembership.status == "approved"
            )
        )
        return self._hub.for_classes(set(rows.scalars()))
