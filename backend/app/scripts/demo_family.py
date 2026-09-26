"""Aina's mum, for `make demo` (§20): a parent linked to Aina, a quiz sent
home and due in a few days, and flashcards that went past due a couple of
hours ago — so every parent screen has something to show, and the past-due
watcher has an alert to send on its next tick.

Idempotent like the rest of the demo: run again, it finds what it made. The
past-due deck is moved back to two hours ago each time, so a fresh seed
always has one missed piece to show.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import Role
from app.core.security import hash_password
from app.db.models.family import FamilyShare
from app.db.models.learning import LearningSet, LearningSetVersion
from app.db.models.user import User
from app.events.registry import build_bus
from app.scripts.demo_content import FLOAT_SKILLS, FLOATING, FRACTION_SKILLS, FRACTIONS
from app.services.family_service import FamilyService
from app.services.family_share_service import FamilyShareService

PARENT_EMAIL = "parent.demo@mentora.local"
# A demo-only account on a development install, printed when the seed runs.
PARENT_PASSWORD = "demo-parent-1"  # noqa: S105
PARENT_NAME = "Nora Hashim"


async def seed_family(session: AsyncSession, child: User, *, email: str = PARENT_EMAIL) -> User:
    parent = await _parent(session, email)
    family = FamilyService(session, build_bus())
    # Connecting again is a no-op; the child hears about it once.
    await family.connect(parent, (await family.invite_for(child)).code, "Mum")
    fractions = await _set(session, parent, "quiz", "Fractions at the Pasar Malam", FRACTIONS,
                           FRACTION_SKILLS)  # fmt: skip
    floating = await _set(session, parent, "flashcard", "Kitchen Science: Float or Sink?",
                          FLOATING, FLOAT_SKILLS)  # fmt: skip
    soon = datetime.now(UTC) + timedelta(days=3)
    await FamilyShareService(session, build_bus()).share(parent, fractions.id, [child.id], soon)
    await _past_due(session, parent, child, floating)
    return parent


async def _parent(session: AsyncSession, email: str) -> User:
    found = await session.scalar(select(User).where(User.email == email))
    if found:
        return found
    parent = User(
        email=email,
        password_hash=hash_password(PARENT_PASSWORD),
        display_name=PARENT_NAME,
        role=Role.PARENT.value,
        is_active=True,
        onboarded_at=datetime.now(UTC),
    )
    session.add(parent)
    await session.flush()
    return parent


async def _set(
    session: AsyncSession,
    parent: User,
    kind: str,
    title: str,
    items: list[dict[str, Any]],
    skills: list[dict[str, str]],
) -> LearningSet:
    found = await session.scalar(
        select(LearningSet)
        .where(LearningSet.owner_id == parent.id, LearningSet.title == title)
        .order_by(LearningSet.created_at)
        .limit(1)
    )
    if found:
        return found
    learning_set = LearningSet(
        owner_id=parent.id,
        purpose="family",
        kind=kind,
        title=title,
        topic=title,
        subject="Mathematics" if kind == "quiz" else "Science",
        grade_level="year_4",
        status="ready",
        current_version=1,
        requested_count=len(items),
    )
    session.add(learning_set)
    await session.flush()
    session.add(
        LearningSetVersion(
            set_id=learning_set.id, version=1, items=items, skills=skills, sources=[]
        )
    )
    await session.flush()
    return learning_set


async def _past_due(
    session: AsyncSession, parent: User, child: User, learning_set: LearningSet
) -> None:
    """Sent home, and due two hours ago — sharing refuses a date that has
    passed, so the row is written here."""
    due = datetime.now(UTC) - timedelta(hours=2)
    share = await session.scalar(
        select(FamilyShare).where(
            FamilyShare.set_id == learning_set.id, FamilyShare.student_id == child.id
        )
    )
    if share is None:
        share = FamilyShare(
            parent_id=parent.id, student_id=child.id, set_id=learning_set.id, version=1
        )
        session.add(share)
    share.due_at = due
    await session.flush()
