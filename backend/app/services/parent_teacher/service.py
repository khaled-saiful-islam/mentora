"""Threads and messages between a parent and their child's teacher.

Every call starts at the gate: the thread must be one of this person's, and
the two of them must still be connected through the child (`contacts.py`).
A thread that fails that is *not found*, the way a child who is not yours is.

A message is live on both sides: it is pushed to both people after commit
(topic `messages`), and it rings the other side's bell once per thread —
repeats grow that one note, and reading the thread reads it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.core.notifications import Kind
from app.db.models.parent_teacher import ParentTeacherMessage, ParentTeacherThread
from app.db.models.user import User
from app.services.notification_service import NotificationService
from app.services.parent_teacher.contacts import Contact, Side, contacts, name_of, side_of
from app.services.realtime import push_after_commit

MAX_BODY = 2000
PAGE = 40
NOT_FOUND = "That conversation isn't open to you."
_EPOCH = datetime.fromisoformat("1970-01-01T00:00:00+00:00")

Thread = ParentTeacherThread
Message = ParentTeacherMessage


@dataclass(frozen=True, slots=True)
class ThreadView:
    thread: ParentTeacherThread
    side: Side
    contact: Contact
    unread: int
    last: ParentTeacherMessage | None


@dataclass(frozen=True, slots=True)
class MessagePage:
    items: list[ParentTeacherMessage]
    has_more: bool


def group_key(thread_id: UUID) -> str:
    return f"pt-thread:{thread_id}"


class ParentTeacherService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def contacts(self, user: User) -> list[Contact]:
        return await contacts(self._session, user)

    async def open(self, user: User, student_id: UUID, person_id: UUID) -> ThreadView:
        """The thread with this person about this child, made if new."""
        side = side_of(user)
        known = {c.key: c for c in await self.contacts(user)}
        contact = known.get((student_id, person_id))
        if contact is None:
            raise NotFoundError(NOT_FOUND)
        parent_id, teacher_id = (
            (user.id, person_id) if side is Side.PARENT else (person_id, user.id)
        )
        await self._session.execute(
            insert(Thread)
            .values(id=uuid4(), parent_id=parent_id, teacher_id=teacher_id, student_id=student_id)
            .on_conflict_do_nothing(constraint="uq_pt_thread_trio")
        )
        thread = await self._session.scalar(
            select(Thread).where(
                Thread.parent_id == parent_id,
                Thread.teacher_id == teacher_id,
                Thread.student_id == student_id,
            )
        )
        if thread is None:  # a race with the other side deleting an account
            raise NotFoundError(NOT_FOUND)
        return (await self._views(user, side, [thread], known))[0]

    async def threads(self, user: User) -> list[ThreadView]:
        """This person's conversations with anything in them, latest first."""
        side = side_of(user)
        known = {c.key: c for c in await self.contacts(user)}
        mine = await self._session.scalars(
            select(Thread).where(_mine(side, user.id), Thread.last_message_at.is_not(None))
        )
        rows = [t for t in mine.all() if _key(side, t) in known]
        views = await self._views(user, side, rows, known)
        return sorted(views, key=lambda v: v.thread.last_message_at or _EPOCH, reverse=True)

    async def thread(self, user: User, thread_id: UUID) -> ThreadView:
        side = side_of(user)
        thread = await self._session.scalar(
            select(Thread).where(Thread.id == thread_id, _mine(side, user.id))
        )
        known = {c.key: c for c in await self.contacts(user)} if thread else {}
        if thread is None or _key(side, thread) not in known:
            raise NotFoundError(NOT_FOUND)
        return (await self._views(user, side, [thread], known))[0]

    async def unread_total(self, user: User) -> int:
        return sum(view.unread for view in await self.threads(user))

    async def messages(
        self, user: User, thread_id: UUID, *, before: UUID | None = None, limit: int = PAGE
    ) -> MessagePage:
        """A page of the thread, oldest first; `before` pages back in time."""
        await self.thread(user, thread_id)
        query = select(Message).where(Message.thread_id == thread_id)
        if before is not None:
            pivot = select(Message.created_at).where(
                Message.id == before, Message.thread_id == thread_id
            )
            query = query.where(Message.created_at < pivot.scalar_subquery())
        found = list(
            (
                await self._session.scalars(
                    query.order_by(Message.created_at.desc()).limit(limit + 1)
                )
            ).all()
        )
        return MessagePage(items=list(reversed(found[:limit])), has_more=len(found) > limit)

    async def send(self, user: User, thread_id: UUID, body: str) -> ParentTeacherMessage:
        text = _clean(body)
        view = await self.thread(user, thread_id)
        thread = view.thread
        message = Message(thread_id=thread.id, author_id=user.id, body=text)
        self._session.add(message)
        await self._session.flush()
        await self._session.refresh(message)
        thread.last_message_at = message.created_at
        _set_read(view.side, thread, message.created_at)
        await self._session.flush()
        await self._ring(user, view)
        for person in (thread.parent_id, thread.teacher_id):
            push_after_commit(self._session, person, _pushed(thread.id))
        return message

    async def read(self, user: User, thread_id: UUID) -> None:
        """Read up to the newest message, and the bell's note about it."""
        view = await self.thread(user, thread_id)
        newest = await self._session.scalar(
            select(func.max(Message.created_at)).where(Message.thread_id == thread_id)
        )
        if newest is not None:
            _set_read(view.side, view.thread, newest)
            await self._session.flush()
        await NotificationService(self._session).mark_group_read(user.id, group_key(thread_id))
        push_after_commit(self._session, user.id, _pushed(thread_id))

    async def _ring(self, user: User, view: ThreadView) -> None:
        thread = view.thread
        to = thread.teacher_id if view.side is Side.PARENT else thread.parent_id
        await NotificationService(self._session).notify(
            user_id=to,
            kind=Kind.PARENT_TEACHER_MESSAGE,
            actor_id=user.id,
            group_key=group_key(thread.id),
            payload={
                "thread_id": str(thread.id),
                "from_name": name_of(user),
                "from_side": view.side.value,
                "student_name": view.contact.student_name,
            },
        )

    async def _views(
        self,
        user: User,
        side: Side,
        rows: list[ParentTeacherThread],
        known: dict[tuple[UUID, UUID], Contact],
    ) -> list[ThreadView]:
        ids = [t.id for t in rows]
        unread = await self._unread(user.id, side, ids)
        last = await self._last(ids)
        return [
            ThreadView(t, side, known[_key(side, t)], unread.get(t.id, 0), last.get(t.id))
            for t in rows
        ]

    async def _unread(self, user_id: UUID, side: Side, ids: list[UUID]) -> dict[UUID, int]:
        if not ids:
            return {}
        read_at = Thread.parent_read_at if side is Side.PARENT else Thread.teacher_read_at
        rows = await self._session.execute(
            select(Message.thread_id, func.count())
            .join(Thread, Thread.id == Message.thread_id)
            .where(
                Message.thread_id.in_(ids),
                Message.author_id != user_id,
                Message.created_at > func.coalesce(read_at, _EPOCH),
            )
            .group_by(Message.thread_id)
        )
        return {thread_id: int(count) for thread_id, count in rows.all()}

    async def _last(self, ids: list[UUID]) -> dict[UUID, ParentTeacherMessage]:
        if not ids:
            return {}
        found = await self._session.scalars(
            select(Message)
            .where(Message.thread_id.in_(ids))
            .distinct(Message.thread_id)
            .order_by(Message.thread_id, Message.created_at.desc())
        )
        return {m.thread_id: m for m in found.all()}


def _mine(side: Side, user_id: UUID):  # noqa: ANN202 — a column comparison
    return Thread.parent_id == user_id if side is Side.PARENT else Thread.teacher_id == user_id


def _key(side: Side, thread: ParentTeacherThread) -> tuple[UUID, UUID]:
    other = thread.teacher_id if side is Side.PARENT else thread.parent_id
    return (thread.student_id, other)


def _set_read(side: Side, thread: ParentTeacherThread, at: datetime) -> None:
    if side is Side.PARENT:
        thread.parent_read_at = max(thread.parent_read_at or at, at)
    else:
        thread.teacher_read_at = max(thread.teacher_read_at or at, at)


def _pushed(thread_id: UUID) -> dict[str, str]:
    return {"topic": "messages", "thread_id": str(thread_id)}


def _clean(body: str) -> str:
    text = body.strip()
    if not text:
        raise ValidationError("Write something first.")
    if len(text) > MAX_BODY:
        raise ValidationError(f"Keep a message under {MAX_BODY} characters.")
    return text
