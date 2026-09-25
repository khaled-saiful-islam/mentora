"""News for one person: written by event subscribers, read from the bell.

Repeats that share a `group_key` collapse into one unread row whose `count`
grows — "5 students finished Photosynthesis" rather than five rows. Once read,
the next one starts a new row: having seen three is not having seen four.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.notifications import Kind
from app.db.models.notification import Notification
from app.services.realtime import push_after_commit

logger = logging.getLogger(__name__)

PAGE_SIZE = 20
MAX_ACTORS = 5
RETENTION = timedelta(days=90)
_SWEEP_CHANCE = 0.01
_CHANGED = {"topic": "notifications"}


@dataclass(frozen=True, slots=True)
class NotificationPage:
    items: list[Notification]
    next_cursor: str | None


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def notify(
        self,
        *,
        user_id: UUID,
        kind: Kind,
        payload: dict[str, Any],
        actor_id: UUID | None = None,
        group_key: str | None = None,
    ) -> Notification:
        existing = await self._open_group(user_id, group_key) if group_key else None
        if existing is not None:
            note = await self._grow(existing, payload)
        else:
            note = Notification(
                user_id=user_id,
                type=kind.value,
                actor_id=actor_id,
                payload=payload,
                group_key=group_key,
                count=1,
            )
            self._session.add(note)
            await self._session.flush()
        push_after_commit(self._session, user_id, _CHANGED)
        await self._maybe_sweep()
        return note

    async def _open_group(self, user_id: UUID, group_key: str) -> Notification | None:
        return (
            (
                await self._session.execute(
                    select(Notification).where(
                        Notification.user_id == user_id,
                        Notification.group_key == group_key,
                        Notification.read_at.is_(None),
                    )
                )
            )
            .scalars()
            .first()
        )

    async def _grow(self, note: Notification, payload: dict[str, Any]) -> Notification:
        actors = [*payload.get("actors", []), *note.payload.get("actors", [])]
        unique = list(dict.fromkeys(actors))[:MAX_ACTORS]
        # Reassigned, never edited in place: SQLAlchemy only sees a JSONB
        # column change when the attribute itself is set.
        note.payload = {**note.payload, **payload, "actors": unique}
        note.count += 1
        note.updated_at = datetime.now(UTC)
        await self._session.flush()
        return note

    async def page(
        self, user_id: UUID, *, cursor: str | None = None, limit: int = PAGE_SIZE
    ) -> NotificationPage:
        query = select(Notification).where(Notification.user_id == user_id)
        after = _parse_cursor(cursor)
        if after is not None:
            stamp, note_id = after
            query = query.where(
                (Notification.updated_at < stamp)
                | ((Notification.updated_at == stamp) & (Notification.id < note_id))
            )
        query = query.order_by(Notification.updated_at.desc(), Notification.id.desc())
        found = list((await self._session.execute(query.limit(limit + 1))).scalars().all())
        more = len(found) > limit
        items = found[:limit]
        return NotificationPage(items=items, next_cursor=_cursor(items[-1]) if more else None)

    async def unread_count(self, user_id: UUID) -> int:
        return int(
            await self._session.scalar(
                select(func.count())
                .select_from(Notification)
                .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            )
            or 0
        )

    async def mark_read(self, user_id: UUID, notification_id: UUID) -> Notification:
        note = (
            await self._session.execute(
                select(Notification).where(
                    Notification.id == notification_id, Notification.user_id == user_id
                )
            )
        ).scalar_one_or_none()
        if note is None:
            raise NotFoundError("No such notification.")
        if note.read_at is None:
            note.read_at = datetime.now(UTC)
            await self._session.flush()
            push_after_commit(self._session, user_id, _CHANGED)
        return note

    async def mark_all_read(self, user_id: UUID) -> int:
        result = await self._session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=datetime.now(UTC))
        )
        push_after_commit(self._session, user_id, _CHANGED)
        return int(result.rowcount or 0)

    async def resolve(
        self, *, user_id: UUID, kind: Kind, match: dict[str, Any], resolution: str
    ) -> None:
        """Mark the notifications about a decided thing as decided — the join
        request that was just approved stops offering its buttons."""
        found = (
            (
                await self._session.execute(
                    select(Notification).where(
                        Notification.user_id == user_id,
                        Notification.type == kind.value,
                        Notification.payload.contains(match),
                    )
                )
            )
            .scalars()
            .all()
        )
        now = datetime.now(UTC)
        for note in found:
            note.payload = {**note.payload, "resolution": resolution}
            note.read_at = note.read_at or now
        if found:
            await self._session.flush()
            push_after_commit(self._session, user_id, _CHANGED)

    async def _maybe_sweep(self) -> None:
        # Opportunistic, like the rate limiter's: no cron to keep this correct.
        if random.random() >= _SWEEP_CHANCE:  # noqa: S311 - not security
            return
        cutoff = datetime.now(UTC) - RETENTION
        await self._session.execute(delete(Notification).where(Notification.updated_at < cutoff))


def _cursor(note: Notification) -> str:
    return f"{note.updated_at.isoformat()}|{note.id}"


def _parse_cursor(cursor: str | None) -> tuple[datetime, UUID] | None:
    if not cursor:
        return None
    try:
        stamp, note_id = cursor.split("|", 1)
        return datetime.fromisoformat(stamp), UUID(note_id)
    except ValueError:
        # A mangled cursor is the first page, not an error page.
        return None
