"""Everything people have made, for an administrator to browse: studio
artifacts and quiz and flashcard sets, whoever made them.

Read-only. An admin who finds something wrong deals with the account; the
browser is for looking, not for editing someone else's work.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models.artifact import Artifact, ArtifactVersion
from app.db.models.learning import Assignment, LearningSet, LearningSetVersion
from app.db.models.user import User

PAGE = 50


@dataclass(frozen=True, slots=True)
class ArtifactRow:
    artifact: Artifact
    owner: User


@dataclass(frozen=True, slots=True)
class SetRow:
    learning_set: LearningSet
    owner: User
    item_count: int
    shares: int


def _search(query, columns, q: str | None):
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        clause = None
        for column in columns:
            match = func.lower(func.coalesce(column, "")).like(like)
            clause = match if clause is None else clause | match
        query = query.where(clause)
    return query


class ContentService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def artifacts(
        self, *, q: str | None = None, kind: str | None = None, before: datetime | None = None
    ) -> list[ArtifactRow]:
        query = select(Artifact, User).join(User, User.id == Artifact.user_id)
        query = _search(query, (Artifact.title, User.display_name, User.email), q)
        if kind:
            query = query.where(Artifact.kind == kind)
        if before:
            query = query.where(Artifact.created_at < before)
        rows = await self._session.execute(query.order_by(Artifact.created_at.desc()).limit(PAGE))
        return [ArtifactRow(a, u) for a, u in rows.all()]

    async def artifact_html(self, artifact_id: UUID) -> tuple[Artifact, str]:
        artifact = await self._session.get(Artifact, artifact_id)
        if artifact is None:
            raise NotFoundError("No such artifact.")
        html = await self._session.scalar(
            select(ArtifactVersion.html).where(
                ArtifactVersion.artifact_id == artifact.id,
                ArtifactVersion.version == artifact.current_version,
            )
        )
        if html is None:
            raise NotFoundError("That artifact has nothing to show yet.")
        return artifact, html

    async def sets(
        self,
        *,
        q: str | None = None,
        kind: str | None = None,
        purpose: str | None = None,
        before: datetime | None = None,
    ) -> list[SetRow]:
        items = func.coalesce(func.jsonb_array_length(LearningSetVersion.items), 0)
        shares = (
            select(func.count())
            .where(Assignment.set_id == LearningSet.id)
            .correlate(LearningSet)
            .scalar_subquery()
        )
        query = (
            select(LearningSet, User, items, shares)
            .join(User, User.id == LearningSet.owner_id)
            .outerjoin(
                LearningSetVersion,
                (LearningSetVersion.set_id == LearningSet.id)
                & (LearningSetVersion.version == LearningSet.current_version),
            )
        )
        query = _search(query, (LearningSet.title, LearningSet.topic, User.display_name), q)
        if kind:
            query = query.where(LearningSet.kind == kind)
        if purpose:
            query = query.where(LearningSet.purpose == purpose)
        if before:
            query = query.where(LearningSet.created_at < before)
        rows = await self._session.execute(
            query.order_by(LearningSet.created_at.desc()).limit(PAGE)
        )
        return [SetRow(s, u, int(n), int(c)) for s, u, n, c in rows.all()]

    async def set_items(self, set_id: UUID) -> tuple[LearningSet, User, list[dict[str, Any]], int]:
        row = (
            await self._session.execute(
                select(LearningSet, User)
                .join(User, User.id == LearningSet.owner_id)
                .where(LearningSet.id == set_id)
            )
        ).first()
        if row is None:
            raise NotFoundError("No such set.")
        learning_set, owner = row
        items = await self._session.scalar(
            select(LearningSetVersion.items).where(
                LearningSetVersion.set_id == set_id,
                LearningSetVersion.version == learning_set.current_version,
            )
        )
        shares = await self._session.scalar(select(func.count()).where(Assignment.set_id == set_id))
        return learning_set, owner, list(items or []), int(shares or 0)
