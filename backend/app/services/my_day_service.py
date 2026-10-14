"""A student's day (§28.3.4), for the top of their home: today's quest, their
streak, their skill garden, and how their classes are doing on this week's
class quest.

The garden draws what the student remembers of each skill: a plant grows
with the box it is in, and droops — never dies — when it is due for review,
which the next quest waters. The class quest adds up everyone's quests: no
one is ranked, the class reaches a goal together.
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.db.models.attempt import Attempt
from app.db.models.classroom import ClassMembership, Classroom
from app.db.models.learning import LearningSetVersion
from app.db.models.quest import DailyQuest, SkillMemory
from app.db.models.user import User
from app.quests.rules import CLASS_QUESTS_EACH, week_of
from app.services.quest_service import QuestService
from app.services.streaks import streak_for

# Plants in the garden: enough to see a pattern, few enough to read.
MOST_PLANTS = 12
# Buddies at a class's party.
MOST_AT_PARTY = 30


class MyDayService:
    def __init__(
        self, session: AsyncSession, *, timezone: str = "UTC", clock: Clock = utc_now
    ) -> None:
        self._session = session
        self._timezone = timezone
        self._quests = QuestService(session, timezone=timezone, clock=clock)

    async def day(self, student: User) -> dict[str, Any]:
        today = self._quests.today()
        quest = await self._quests.quest(student)
        memory = await self._quests.memory(student)
        streak = await streak_for(self._session, student.id, timezone=self._timezone, today=today)
        return {
            "day": today.isoformat(),
            "quest": _quest(quest),
            "streak": {
                "days": streak.days,
                "freezes": streak.freezes,
                "today_done": streak.today_done,
            },
            "garden": await self._garden(student.id, memory, today),
            "classes": await self._class_quests(student.id, today),
        }

    async def _garden(
        self, student_id: UUID, memory: dict[str, SkillMemory], today: date
    ) -> list[dict[str, Any]]:
        labels = await self._labels(student_id)
        plants = sorted(memory.values(), key=lambda m: (m.due_on > today, -m.box, m.skill))
        return [
            {
                "skill": m.skill,
                "label": labels.get(m.skill, m.skill.replace("-", " ")),
                "box": m.box,
                "mastery": round(m.right / m.seen, 3) if m.seen else 0.0,
                "thirsty": m.due_on <= today,
                "due_on": m.due_on.isoformat(),
            }
            for m in plants[:MOST_PLANTS]
        ]

    async def _labels(self, student_id: UUID) -> dict[str, str]:
        rows = await self._session.execute(
            select(LearningSetVersion.skills)
            .join(
                Attempt,
                (Attempt.set_id == LearningSetVersion.set_id)
                & (Attempt.version == LearningSetVersion.version),
            )
            .where(Attempt.student_id == student_id)
            .distinct()
        )
        return {s["slug"]: s["label"] for skills in rows.scalars() for s in skills}

    async def _class_quests(self, student_id: UUID, today: date) -> list[dict[str, Any]]:
        monday, sunday = week_of(today)
        classes = (
            await self._session.execute(
                select(Classroom.id, Classroom.name, Classroom.theme)
                .join(ClassMembership, ClassMembership.class_id == Classroom.id)
                .where(
                    ClassMembership.student_id == student_id,
                    ClassMembership.status == "approved",
                    Classroom.archived_at.is_(None),
                )
            )
        ).all()
        found = []
        for class_id, name, theme in classes:
            members = (
                await self._session.execute(
                    select(User.id, User.buddy)
                    .join(ClassMembership, ClassMembership.student_id == User.id)
                    .where(
                        ClassMembership.class_id == class_id, ClassMembership.status == "approved"
                    )
                )
            ).all()
            done = int(
                await self._session.scalar(
                    select(func.count(DailyQuest.id)).where(
                        DailyQuest.student_id.in_([m.id for m in members]),
                        DailyQuest.day >= monday,
                        DailyQuest.day <= sunday,
                        DailyQuest.done_at.is_not(None),
                    )
                )
                or 0
            )
            found.append(
                {
                    "class_id": str(class_id),
                    "name": name,
                    "theme": theme,
                    "done": done,
                    "goal": max(1, len(members) * CLASS_QUESTS_EACH),
                    "week": monday.isoformat(),
                    "buddies": [m.buddy for m in members if m.buddy][:MOST_AT_PARTY],
                }
            )
        return found


def _quest(quest: DailyQuest | None) -> dict[str, Any] | None:
    if quest is None:
        return None
    return {
        "set_id": str(quest.set_id),
        "day": quest.day.isoformat(),
        "questions": quest.review + quest.fresh,
        "review": quest.review,
        "fresh": quest.fresh,
        "done": quest.done_at is not None,
    }
