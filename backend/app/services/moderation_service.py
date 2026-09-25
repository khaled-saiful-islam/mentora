"""The moderation log: what the safety checks did, and the admin's review.

Recording never raises into the caller. A turn that answered a child with
care must not fail because its log line did not save — the answer matters
more than the record of it. Callers use `record_quietly`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.db.models.moderation import ModerationEvent
from app.db.models.user import User
from app.events.bus import EventBus
from app.events.catalog import StudentNeedsSupport
from app.moderation.base import Flag
from app.services.realtime import push_after_commit

logger = logging.getLogger(__name__)

STATUSES = ("open", "reviewed", "dismissed")
PAGE = 50


@dataclass(frozen=True, slots=True)
class Where:
    """Where a flag happened. Every field is optional: a topic refusal has no
    conversation, an injection in a web page has no student."""

    user_id: UUID | None = None
    conversation_id: UUID | None = None
    message_id: UUID | None = None
    set_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class QueueItem:
    event: ModerationEvent
    user: User | None


class ModerationService:
    def __init__(self, session: AsyncSession, bus: EventBus | None = None) -> None:
        self._session = session
        self._bus = bus

    async def record(self, flag: Flag, where: Where) -> ModerationEvent:
        event = ModerationEvent(
            user_id=where.user_id,
            conversation_id=where.conversation_id,
            message_id=where.message_id,
            set_id=where.set_id,
            kind=flag.kind,
            source=flag.source,
            category=flag.category,
            severity=flag.severity,
            rule=flag.rule[:64],
            screen=flag.screen[:32],
            findings=[dict(f) for f in flag.findings],
            excerpt=flag.excerpt,
        )
        self._session.add(event)
        await self._session.flush()
        await self._tell_admins(event)
        if flag.kind == "support" and self._bus and where.user_id:
            student = await self._session.get(User, where.user_id)
            await self._bus.publish(
                StudentNeedsSupport(
                    event_id=event.id,
                    student_id=where.user_id,
                    student_name=(student.display_name or student.sign_in_name)
                    if student
                    else "A student",
                    category=flag.category,
                ),
                self._session,
            )
        return event

    async def _tell_admins(self, event: ModerationEvent) -> None:
        """A safety queue someone has open refreshes by itself."""
        admins = await self._session.execute(
            select(User.id).where(User.role == "admin", User.is_active.is_(True))
        )
        message = {"topic": "moderation", "severity": event.severity}
        for admin_id in admins.scalars():
            push_after_commit(self._session, admin_id, message)

    async def record_quietly(self, flags: list[Flag], where: Where) -> None:
        for flag in flags:
            try:
                async with self._session.begin_nested():
                    await self.record(flag, where)
            except Exception:  # noqa: BLE001 — see the module docstring
                logger.exception("could not record a %s moderation event", flag.kind)

    async def queue(
        self,
        *,
        status: str | None = "open",
        severity: str | None = None,
        kind: str | None = None,
        before: datetime | None = None,
        limit: int = PAGE,
    ) -> list[QueueItem]:
        """Newest first, the most serious first among the open ones."""
        query = select(ModerationEvent, User).outerjoin(User, User.id == ModerationEvent.user_id)
        if status:
            query = query.where(ModerationEvent.status == status)
        if severity:
            query = query.where(ModerationEvent.severity == severity)
        if kind:
            query = query.where(ModerationEvent.kind == kind)
        if before:
            query = query.where(ModerationEvent.created_at < before)
        rows = await self._session.execute(
            query.order_by(ModerationEvent.created_at.desc()).limit(min(limit, 200))
        )
        return [QueueItem(event, user) for event, user in rows.all()]

    async def review(
        self, event_id: UUID, reviewer_id: UUID, *, status: str, note: str = ""
    ) -> ModerationEvent:
        if status not in STATUSES:
            raise ValidationError("Status must be open, reviewed or dismissed.")
        event = await self._session.get(ModerationEvent, event_id)
        if event is None:
            raise NotFoundError("No such moderation event.")
        event.status = status
        event.note = note.strip()[:500]
        reopened = status == "open"
        event.reviewed_by = None if reopened else reviewer_id
        event.reviewed_at = None if reopened else datetime.now(UTC)
        await self._session.flush()
        return event

    async def open_counts(self) -> dict[str, int]:
        rows = await self._session.execute(
            select(ModerationEvent.severity, func.count())
            .where(ModerationEvent.status == "open")
            .group_by(ModerationEvent.severity)
        )
        counts = {"low": 0, "medium": 0, "high": 0}
        counts.update({severity: int(n) for severity, n in rows.all()})
        return counts
