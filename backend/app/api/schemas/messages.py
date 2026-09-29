"""Parent–teacher messages on the wire (`routes/messages.py`)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models.parent_teacher import ParentTeacherMessage
from app.services.parent_teacher.contacts import Contact
from app.services.parent_teacher.service import MAX_BODY, MessagePage, ThreadView


class ContactResponse(BaseModel):
    student_id: UUID
    student_name: str
    person_id: UUID
    person_name: str
    relation: str
    class_ids: list[UUID]
    class_names: list[str]

    @classmethod
    def of(cls, contact: Contact) -> ContactResponse:
        return cls(
            student_id=contact.student_id,
            student_name=contact.student_name,
            person_id=contact.person_id,
            person_name=contact.person_name,
            relation=contact.relation,
            class_ids=list(contact.class_ids),
            class_names=list(contact.class_names),
        )


class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    body: str
    mine: bool
    created_at: datetime

    @classmethod
    def of(cls, message: ParentTeacherMessage, me: UUID) -> MessageResponse:
        return cls(
            id=message.id,
            thread_id=message.thread_id,
            body=message.body,
            mine=message.author_id == me,
            created_at=message.created_at,
        )


class ThreadResponse(BaseModel):
    id: UUID
    # Which side the reader is on: "parent" or "teacher".
    side: str
    contact: ContactResponse
    unread: int
    last: MessageResponse | None
    last_message_at: datetime | None

    @classmethod
    def of(cls, view: ThreadView, me: UUID) -> ThreadResponse:
        return cls(
            id=view.thread.id,
            side=view.side.value,
            contact=ContactResponse.of(view.contact),
            unread=view.unread,
            last=MessageResponse.of(view.last, me) if view.last else None,
            last_message_at=view.thread.last_message_at,
        )


class InboxResponse(BaseModel):
    threads: list[ThreadResponse]
    contacts: list[ContactResponse]
    unread: int


class MessagePageResponse(BaseModel):
    items: list[MessageResponse]
    has_more: bool

    @classmethod
    def of(cls, page: MessagePage, me: UUID) -> MessagePageResponse:
        return cls(items=[MessageResponse.of(m, me) for m in page.items], has_more=page.has_more)


class OpenThreadRequest(BaseModel):
    student_id: UUID
    # The teacher, for a parent; the parent, for a teacher.
    person_id: UUID


class SendRequest(BaseModel):
    body: str = Field(min_length=1, max_length=MAX_BODY)


class UnreadMessagesResponse(BaseModel):
    unread: int
