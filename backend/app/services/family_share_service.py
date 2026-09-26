"""Work a parent sends home (PLAN.md §20.4): a set they made, shared with
their child, with a due date if they like.

The child takes it like practice — their own tries, as many as they want —
and it counts for badges and skills like any other work. Every read passes
through the family link, so once a parent disconnects, the child no longer
sees what they sent.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.core.errors import NotFoundError, ValidationError
from app.db.models.attempt import Attempt
from app.db.models.family import FamilyLink, FamilyShare
from app.db.models.learning import LearningSet, LearningSetVersion
from app.db.models.user import User
from app.events.bus import EventBus
from app.events.catalog import FamilyWorkShared
from app.services.family_service import FamilyService, first_name
from app.services.learning_set_service import LearningSetService

MAX_CHILDREN_AT_ONCE = 8


@dataclass(frozen=True, slots=True)
class HomeWork:
    """One piece of work from home, as the child and their parents see it."""

    share: FamilyShare
    title: str
    kind: str
    item_count: int
    # Who sent it: what the child calls them, and their name.
    label: str
    parent_name: str
    status: str  # todo | in_progress | done
    best: float | None
    attempts: int
    # The latest finished try, to open for its answers.
    review_attempt_id: UUID | None


class FamilyShareService:
    def __init__(
        self, session: AsyncSession, bus: EventBus | None = None, clock: Clock = utc_now
    ) -> None:
        self._session = session
        self._bus = bus
        self._clock = clock

    # --- the parent ----------------------------------------------------------

    async def share(
        self,
        parent: User,
        set_id: UUID,
        student_ids: Sequence[UUID],
        due_at: datetime | None = None,
    ) -> list[FamilyShare]:
        """Send a set home to each child. Sending it again to the same child
        moves them to its latest version and the new due date."""
        learning_set = await self._ready(parent.id, set_id)
        wanted = list(dict.fromkeys(student_ids))
        if not wanted:
            raise ValidationError("Choose who to send it to.")
        if len(wanted) > MAX_CHILDREN_AT_ONCE:
            raise ValidationError(f"Send it to at most {MAX_CHILDREN_AT_ONCE} children at once.")
        if due_at is not None and due_at <= self._clock():
            raise ValidationError("Pick a due date that hasn't passed.")
        family = FamilyService(self._session)
        links = [await family.link(parent.id, student_id) for student_id in wanted]
        return [await self._share_one(parent, learning_set, link, due_at) for link in links]

    async def unshare(self, parent_id: UUID, share_id: UUID) -> None:
        share = await self._session.scalar(
            select(FamilyShare).where(
                FamilyShare.id == share_id, FamilyShare.parent_id == parent_id
            )
        )
        if share is None:
            raise NotFoundError("No such share.")
        await self._session.delete(share)
        await self._session.flush()

    async def of_set(self, parent_id: UUID, set_id: UUID) -> list[tuple[FamilyShare, User]]:
        """Who this parent has sent a set to, and when it is due."""
        rows = await self._session.execute(
            select(FamilyShare, User)
            .join(User, User.id == FamilyShare.student_id)
            .where(FamilyShare.parent_id == parent_id, FamilyShare.set_id == set_id)
            .order_by(FamilyShare.created_at)
        )
        return [(share, student) for share, student in rows.all()]

    # --- the child -----------------------------------------------------------

    async def for_student(self, student_id: UUID) -> list[HomeWork]:
        """Everything sent home to this child, newest first."""
        rows = (
            await self._session.execute(
                select(FamilyShare, LearningSet, FamilyLink.label, User)
                .join(LearningSet, LearningSet.id == FamilyShare.set_id)
                .join(
                    FamilyLink,
                    (FamilyLink.parent_id == FamilyShare.parent_id)
                    & (FamilyLink.student_id == FamilyShare.student_id),
                )
                .join(User, User.id == FamilyShare.parent_id)
                .where(FamilyShare.student_id == student_id, LearningSet.archived_at.is_(None))
                .order_by(FamilyShare.created_at.desc())
            )
        ).all()
        set_ids = [share.set_id for share, *_ in rows]
        tries = await self._tries(student_id, set_ids)
        counts = await self._item_counts([(s.set_id, s.version) for s, *_ in rows])
        return [
            _home_work(share, learning_set, label, parent, tries.get(share.set_id, []), counts)
            for share, learning_set, label, parent in rows
        ]

    async def visible(self, student_id: UUID, share_id: UUID) -> FamilyShare:
        """A share this child may take — sent by a parent still linked."""
        share = await self._session.scalar(
            select(FamilyShare)
            .join(
                FamilyLink,
                (FamilyLink.parent_id == FamilyShare.parent_id)
                & (FamilyLink.student_id == FamilyShare.student_id),
            )
            .where(FamilyShare.id == share_id, FamilyShare.student_id == student_id)
        )
        if share is None:
            raise NotFoundError("That isn't shared with you.")
        return share

    # --- internals -----------------------------------------------------------

    async def _ready(self, parent_id: UUID, set_id: UUID) -> LearningSet:
        learning_set = await LearningSetService(self._session).owned(parent_id, set_id)
        if learning_set.purpose != "family":
            raise ValidationError("Only what you made to send home can be sent home.")
        if learning_set.status != "ready" or not learning_set.current_version:
            raise ValidationError("It isn't ready yet — try again once it's made.")
        return learning_set

    async def _share_one(
        self, parent: User, learning_set: LearningSet, link: FamilyLink, due_at: datetime | None
    ) -> FamilyShare:
        share = await self._session.scalar(
            select(FamilyShare).where(
                FamilyShare.set_id == learning_set.id, FamilyShare.student_id == link.student_id
            )
        )
        fresh = share is None
        if share is None:
            share = FamilyShare(
                parent_id=parent.id,
                student_id=link.student_id,
                set_id=learning_set.id,
                version=learning_set.current_version,
            )
            self._session.add(share)
        share.version = learning_set.current_version
        share.due_at = due_at
        await self._session.flush()
        if fresh and self._bus is not None:
            await self._bus.publish(
                FamilyWorkShared(
                    share_id=share.id,
                    parent_id=parent.id,
                    student_id=link.student_id,
                    label=link.label,
                    title=learning_set.title,
                    kind=learning_set.kind,
                    due_at=due_at.isoformat() if due_at else None,
                ),
                self._session,
            )
        return share

    async def _tries(self, student_id: UUID, set_ids: list[UUID]) -> dict[UUID, list[Attempt]]:
        if not set_ids:
            return {}
        rows = await self._session.scalars(
            select(Attempt)
            .where(
                Attempt.student_id == student_id,
                Attempt.set_id.in_(set_ids),
                Attempt.assignment_id.is_(None),
            )
            .order_by(Attempt.number)
        )
        grouped: dict[UUID, list[Attempt]] = {}
        for attempt in rows.all():
            grouped.setdefault(attempt.set_id, []).append(attempt)
        return grouped

    async def _item_counts(self, keys: list[tuple[UUID, int]]) -> dict[tuple[UUID, int], int]:
        if not keys:
            return {}
        rows = await self._session.execute(
            select(
                LearningSetVersion.set_id,
                LearningSetVersion.version,
                func.jsonb_array_length(LearningSetVersion.items),
            ).where(LearningSetVersion.set_id.in_({k[0] for k in keys}))
        )
        return {(s, v): int(n) for s, v, n in rows.all()}


def _home_work(
    share: FamilyShare,
    learning_set: LearningSet,
    label: str,
    parent: User,
    tries: list[Attempt],
    counts: dict[tuple[UUID, int], int],
) -> HomeWork:
    done = [a for a in tries if a.status == "completed"]
    latest = max(done, key=lambda a: a.completed_at or a.started_at) if done else None
    return HomeWork(
        share=share,
        title=learning_set.title,
        kind=learning_set.kind,
        item_count=counts.get((share.set_id, share.version), 0),
        label=label,
        parent_name=first_name(parent),
        status="done" if done else "in_progress" if tries else "todo",
        best=max(float(a.percent) for a in done) if done else None,
        attempts=len(done),
        review_attempt_id=latest.id if latest else None,
    )
