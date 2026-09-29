"""Aina's mum and her teacher, for `make demo` (048): a short conversation
about how Aina is doing, ending on the mum's last word — so the teacher's
envelope and bell have something waiting.

Idempotent: a thread that already has messages is left as it is.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.parent_teacher import ParentTeacherMessage
from app.db.models.user import User
from app.services.parent_teacher.service import ParentTeacherService

# (from the parent?, words)
EXCHANGE = (
    (True, "Hello Cikgu! Aina says the class is learning about the water cycle. "
           "Is there anything we can do at home to help?"),
    (False, "Hi Puan Nora! Aina is doing well — she got most of the Water Cycle quiz right. "
            "Ask her to explain evaporation while you boil water; she loves being the teacher."),
    (True, "What a lovely idea, we'll try it tonight. Thank you, Cikgu!"),
)  # fmt: skip


async def seed_messages(session: AsyncSession, parent: User, teacher: User, child: User) -> None:
    talk = ParentTeacherService(session)
    thread = (await talk.open(parent, child.id, teacher.id)).thread
    said = await session.scalar(
        select(func.count()).where(ParentTeacherMessage.thread_id == thread.id)
    )
    if said:
        return
    for from_parent, words in EXCHANGE:
        await talk.send(parent if from_parent else teacher, thread.id, words)
