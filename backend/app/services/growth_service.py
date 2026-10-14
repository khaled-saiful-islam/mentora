"""A student's buddy, growing as they learn, and the buddies they have met
(§28.3.1).

Growth is written by domain-event reactions (`events/subscribers/growth.py`)
inside the transaction that caused it: an attempt finished, a badge awarded.
Each moment is a ledger row unique on what earned it, so counting twice is
impossible rather than avoided. Reading it back is one sum.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.buddies import BUDDIES, buddy_name
from app.core.clock import Clock, utc_now, zone
from app.core.errors import ForbiddenError
from app.core.roles import Role
from app.db.models.attempt import StudentBadge
from app.db.models.growth import BuddyGrowth, BuddyProgress
from app.db.models.user import User
from app.events.catalog import AttemptCompleted, BadgeAwarded
from app.growth.rules import (
    GROWN,
    POINTS,
    STAGE_AT,
    THREE_STARS,
    badges_for_next,
    buddies_allowed,
    mastered,
    next_at,
    stage_for,
)
from app.services.badge_service import skill_tallies


@dataclass(frozen=True, slots=True)
class Growth:
    points: int
    stage: int
    # Where this stage began and the next one begins (None when grown).
    stage_at: int
    next_at: int | None
    # Growth already celebrated, and whether the baby buddy has been met.
    seen_points: int
    arrived: bool
    met: tuple[str, ...]
    badges: int
    # Badges still to earn before a new buddy can be met; None when all are.
    badges_for_next: int | None
    # How many new buddies may be met right now.
    may_meet: int
    skills_mastered: int

    @property
    def grew(self) -> bool:
        """A stage reached that the student has not celebrated yet."""
        return self.stage > stage_for(self.seen_points)

    def as_dict(self) -> dict[str, object]:
        return {
            "points": self.points,
            "stage": self.stage,
            "stage_at": self.stage_at,
            "next_at": self.next_at,
            "seen_points": self.seen_points,
            "arrived": self.arrived,
            "grew": self.grew,
            "met": list(self.met),
            "badges": self.badges,
            "badges_for_next": self.badges_for_next,
            "may_meet": self.may_meet,
            "skills_mastered": self.skills_mastered,
        }


# Teachers and parents keep grown buddies; there is nothing for them to earn.
GROWN_UP = Growth(
    points=STAGE_AT[GROWN],
    stage=GROWN,
    stage_at=STAGE_AT[GROWN],
    next_at=None,
    seen_points=STAGE_AT[GROWN],
    arrived=True,
    met=BUDDIES,
    badges=0,
    badges_for_next=None,
    may_meet=0,
    skills_mastered=0,
)


class GrowthService:
    def __init__(
        self, session: AsyncSession, *, timezone: str = "UTC", clock: Clock = utc_now
    ) -> None:
        self._session = session
        self._timezone = timezone
        self._clock = clock

    # --- earning ------------------------------------------------------------

    async def award(self, student_id: object, source: str, source_id: str) -> bool:
        """One learning moment's growth, unless it was already counted."""
        inserted = await self._session.execute(
            insert(BuddyGrowth)
            .values(
                student_id=student_id,
                source=source,
                source_id=source_id[:160],
                points=POINTS[source],
            )
            .on_conflict_do_nothing(constraint="uq_buddy_growth_once")
        )
        return bool(inserted.rowcount)

    async def attempt_completed(self, event: AttemptCompleted) -> None:
        # A day is the student's day, not the server's: in Malaysia "today"
        # must not start at 8 in the morning.
        day = self._clock().astimezone(zone(self._timezone)).date().isoformat()
        student = event.student_id
        await self.award(student, "finished", f"{event.set_id}:{day}")
        await self.award(student, "day", day)
        if event.percent >= THREE_STARS:
            await self.award(student, "stars", str(event.set_id))
        for tally in await skill_tallies(self._session, student):
            if mastered(tally):
                await self.award(student, "skill", tally.skill)

    async def badge_awarded(self, event: BadgeAwarded) -> None:
        await self.award(event.student_id, "badge", f"{event.badge}:{event.scope}")

    # --- reading --------------------------------------------------------------

    async def growth(self, user: User) -> Growth:
        if user.role != Role.STUDENT:
            return GROWN_UP
        points = await self._points(user)
        skills = int(
            await self._session.scalar(
                select(func.count()).where(
                    BuddyGrowth.student_id == user.id, BuddyGrowth.source == "skill"
                )
            )
            or 0
        )
        progress = await self._session.get(BuddyProgress, user.id)
        badges = await self._badges(user)
        met = _met(progress, user)
        stage = stage_for(points)
        allowed = buddies_allowed(badges, len(BUDDIES))
        return Growth(
            points=points,
            stage=stage,
            stage_at=STAGE_AT[stage],
            next_at=next_at(points),
            seen_points=progress.seen_points if progress else 0,
            arrived=bool(progress and progress.arrived_at),
            met=met,
            badges=badges,
            badges_for_next=badges_for_next(badges, len(BUDDIES)),
            may_meet=max(0, allowed - len(met)),
            skills_mastered=skills,
        )

    async def seen(self, user: User) -> Growth:
        """Everything so far celebrated: the arrival, and the growth up to now."""
        current = await self.growth(user)
        if user.role != Role.STUDENT:
            return current
        progress = await self._progress(user)
        progress.seen_points = current.points
        progress.arrived_at = progress.arrived_at or self._clock()
        await self._session.flush()
        return await self.growth(user)

    # --- meeting a new buddy -------------------------------------------------

    async def choose(self, user: User, buddy: str) -> None:
        """May this student have this buddy? Their first is theirs to pick, and
        one they have met is theirs to switch back to; a new one is earned with
        badges. Remembers the meeting. Raises when it is not earned yet."""
        if user.role != Role.STUDENT:
            return
        name = buddy.strip().lower()
        progress = await self._progress(user)
        met = list(_met(progress, user))
        if name in met:
            return
        if progress.arrived_at is None and not await self._points(user):
            # Still choosing, before learning anything: the first pick is free
            # to change ("Pick again" on the welcome screen).
            progress.met = [name]
            await self._session.flush()
            return
        badges = await self._badges(user)
        if met and len(met) >= buddies_allowed(badges, len(BUDDIES)):
            more = badges_for_next(badges, len(BUDDIES)) or 0
            word = "badge" if more == 1 else "badges"
            raise ForbiddenError(
                f"Earn {more} more {word} to meet {buddy_name(name)}. "
                "Every badge brings a new buddy friend closer!"
            )
        progress.met = [*met, name]
        await self._session.flush()

    # --- helpers --------------------------------------------------------------

    async def _points(self, user: User) -> int:
        return int(
            await self._session.scalar(
                select(func.coalesce(func.sum(BuddyGrowth.points), 0)).where(
                    BuddyGrowth.student_id == user.id
                )
            )
            or 0
        )

    async def _badges(self, user: User) -> int:
        return int(
            await self._session.scalar(
                select(func.count()).where(StudentBadge.student_id == user.id)
            )
            or 0
        )

    async def _progress(self, user: User) -> BuddyProgress:
        progress = await self._session.get(BuddyProgress, user.id)
        if progress is None:
            progress = BuddyProgress(student_id=user.id, seen_points=0, met=list(_met(None, user)))
            self._session.add(progress)
            await self._session.flush()
        return progress


def _met(progress: BuddyProgress | None, user: User) -> tuple[str, ...]:
    """The buddies a student has met: as remembered, or — before anything was
    remembered — the one they already have."""
    if progress is not None and progress.met:
        return tuple(progress.met)
    return (user.buddy,) if user.buddy else ()
