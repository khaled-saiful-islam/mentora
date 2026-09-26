"""Aina's mum in `make demo`: linked, with work sent home — one piece coming
up, one already past due — and the same again when run twice."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from app.db.models.family import FamilyLink, FamilyShare
from app.db.models.learning import LearningSet
from app.scripts.demo_family import seed_family


async def test_the_demo_parent_has_something_on_every_screen(session, account) -> None:
    child = await account("student", "Aina")
    # Its own address: the real demo parent may already be in a shared database.
    email = f"mum.{uuid4().hex[:8]}@demo.test"
    parent = await seed_family(session, child, email=email)
    again = await seed_family(session, child, email=email)
    assert again.id == parent.id
    links = (
        await session.scalars(select(FamilyLink).where(FamilyLink.parent_id == parent.id))
    ).all()
    assert [(link.student_id, link.label) for link in links] == [(child.id, "Mum")]
    sets = (
        await session.scalars(select(LearningSet).where(LearningSet.owner_id == parent.id))
    ).all()
    assert {s.purpose for s in sets} == {"family"} and len(sets) == 2
    shares = (
        await session.scalars(select(FamilyShare).where(FamilyShare.parent_id == parent.id))
    ).all()
    now = datetime.now(UTC)
    assert sorted(s.due_at > now for s in shares) == [False, True]
