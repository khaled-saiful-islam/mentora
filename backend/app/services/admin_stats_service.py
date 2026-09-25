"""The numbers on the admin's first screen: who is here, what they are doing,
what it costs, and whether anything needs a person to look.

Counts, not scans: every figure is one aggregate query, so the page stays
quick however large the school gets.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.attempt import Attempt
from app.db.models.classroom import ClassMembership, Classroom
from app.db.models.conversation import Message
from app.db.models.learning import Assignment, LearningSet, LearningSetVersion
from app.db.models.user import User
from app.services.moderation_service import ModerationService

TREND_DAYS = 14


@dataclass(frozen=True, slots=True)
class Day:
    day: date
    attempts: int
    messages: int
    signups: int


@dataclass(frozen=True, slots=True)
class Overview:
    users: dict[str, int]
    learning: dict[str, float | int | None]
    tokens_24h: int
    safety: dict[str, int]
    trend: list[Day]


class AdminStatsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def overview(self, now: datetime | None = None) -> Overview:
        now = now or datetime.now(UTC)
        open_counts = await ModerationService(self._session).open_counts()
        return Overview(
            users=await self._users(now),
            learning=await self._learning(now),
            tokens_24h=await self._tokens(now - timedelta(hours=24)),
            safety={**open_counts, "open": sum(open_counts.values())},
            trend=await self._trend(now),
        )

    async def _users(self, now: datetime) -> dict[str, int]:
        week = now - timedelta(days=7)
        roles = dict(
            (await self._session.execute(select(User.role, func.count()).group_by(User.role))).all()
        )
        return {
            "total": sum(int(n) for n in roles.values()),
            "admins": int(roles.get("admin", 0)),
            "teachers": int(roles.get("teacher", 0)),
            "students": int(roles.get("student", 0)),
            "suspended": await self._count(User, User.is_active.is_(False)),
            "new_7d": await self._count(User, User.created_at >= week),
            "active_7d": await self._count(User, User.last_seen_at >= week),
        }

    async def _learning(self, now: datetime) -> dict[str, float | int | None]:
        week = now - timedelta(days=7)
        done = (Attempt.status == "completed", Attempt.completed_at >= week)
        average = await self._session.scalar(select(func.avg(Attempt.percent)).where(*done))
        return {
            "classes": await self._count(Classroom, Classroom.archived_at.is_(None)),
            "memberships": await self._count(ClassMembership, ClassMembership.status == "approved"),
            "sets": await self._count(LearningSet, LearningSet.status == "ready"),
            "practice_sets": await self._count(
                LearningSet, LearningSet.status == "ready", LearningSet.purpose == "practice"
            ),
            "assignments": await self._count(Assignment),
            "attempts_7d": await self._count(Attempt, *done),
            "average_7d": round(float(average), 1) if average is not None else None,
        }

    async def _tokens(self, since: datetime) -> int:
        chat = await self._session.scalar(
            select(
                func.coalesce(func.sum(Message.prompt_tokens + Message.completion_tokens), 0)
            ).where(Message.created_at >= since)
        )
        spent = LearningSetVersion.prompt_tokens + LearningSetVersion.completion_tokens
        building = await self._session.scalar(
            select(func.coalesce(func.sum(spent), 0)).where(LearningSetVersion.created_at >= since)
        )
        return int(chat or 0) + int(building or 0)

    async def _trend(self, now: datetime) -> list[Day]:
        start = (now - timedelta(days=TREND_DAYS - 1)).date()
        attempts = await self._per_day(Attempt.completed_at, start, Attempt.status == "completed")
        messages = await self._per_day(Message.created_at, start, Message.role == "user")
        signups = await self._per_day(User.created_at, start)
        days = [start + timedelta(days=n) for n in range(TREND_DAYS)]
        return [Day(d, attempts.get(d, 0), messages.get(d, 0), signups.get(d, 0)) for d in days]

    async def _per_day(self, column, start: date, *where) -> dict[date, int]:
        """Counts per calendar day, in the database's time zone (UTC)."""
        day = cast(column, Date)
        query = select(day, func.count()).where(day >= start, *where).group_by(day)
        return {d: int(n) for d, n in (await self._session.execute(query)).all()}

    async def _count(self, model, *where) -> int:
        query = select(func.count()).select_from(model)
        if where:
            query = query.where(*where)
        return int(await self._session.scalar(query) or 0)
