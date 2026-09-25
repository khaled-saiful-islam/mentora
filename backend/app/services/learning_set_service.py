"""A person's learning sets: finding them, saving a build, editing, archiving.

Edits change the current version in place until it has been shared; after
that they fork a new version, so a student's answers always belong to the
questions they were actually shown.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.db.models.learning import Assignment, LearningSet, LearningSetVersion
from app.learning.base import Item, LearningKind, Skill
from app.learning.enrich import Enriching
from app.learning.generator import GenerationResult
from app.learning.registry import build_learning_kinds

PAGE_SIZE = 24


@dataclass(frozen=True, slots=True)
class SetView:
    learning_set: LearningSet
    version: LearningSetVersion | None
    shares: int


class LearningSetService:
    def __init__(self, session: AsyncSession, kinds: dict[str, LearningKind] | None = None) -> None:
        self._session = session
        self._kinds = kinds or build_learning_kinds()

    # --- reading ----------------------------------------------------------

    async def owned(self, owner_id: UUID, set_id: UUID) -> LearningSet:
        found = (
            await self._session.execute(
                select(LearningSet).where(
                    LearningSet.id == set_id, LearningSet.owner_id == owner_id
                )
            )
        ).scalar_one_or_none()
        if found is None:
            raise NotFoundError("No such set.")
        return found

    async def view(self, owner_id: UUID, set_id: UUID) -> SetView:
        learning_set = await self.owned(owner_id, set_id)
        return SetView(learning_set, await self.version(learning_set), await self._shares(set_id))

    async def version(
        self, learning_set: LearningSet, number: int | None = None
    ) -> LearningSetVersion | None:
        wanted = number or learning_set.current_version
        if not wanted:
            return None
        return (
            await self._session.execute(
                select(LearningSetVersion).where(
                    LearningSetVersion.set_id == learning_set.id,
                    LearningSetVersion.version == wanted,
                )
            )
        ).scalar_one_or_none()

    async def page(
        self,
        owner_id: UUID,
        *,
        kind: str | None = None,
        q: str | None = None,
        archived: bool = False,
        limit: int = PAGE_SIZE,
        offset: int = 0,
    ) -> tuple[list[SetView], int]:
        query = select(LearningSet).where(
            LearningSet.owner_id == owner_id,
            LearningSet.archived_at.is_not(None) if archived else LearningSet.archived_at.is_(None),
        )
        if kind:
            query = query.where(LearningSet.kind == kind)
        if q:
            like = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(LearningSet.title).like(like),
                    func.lower(LearningSet.topic).like(like),
                )
            )
        total = await self._session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (
            (
                await self._session.execute(
                    query.order_by(LearningSet.updated_at.desc()).limit(limit).offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return [SetView(s, await self.version(s), await self._shares(s.id)) for s in rows], int(
            total or 0
        )

    async def _shares(self, set_id: UUID) -> int:
        return int(
            await self._session.scalar(select(func.count()).where(Assignment.set_id == set_id)) or 0
        )

    async def _version_shared(self, set_id: UUID, version: int) -> bool:
        return (
            await self._session.scalar(
                select(func.count()).where(
                    Assignment.set_id == set_id, Assignment.version == version
                )
            )
            or 0
        ) > 0

    # --- builds -----------------------------------------------------------

    async def save_build(self, set_id: UUID, result: GenerationResult) -> LearningSet:
        learning_set = await self._session.get(LearningSet, set_id)
        if learning_set is None:
            raise NotFoundError("The set was deleted while it was being made.")
        learning_set.title = result.title
        learning_set.topic = result.topic
        learning_set.status = "ready"
        learning_set.failure = None
        learning_set.current_version = 1
        self._session.add(
            LearningSetVersion(
                set_id=set_id,
                version=1,
                items=list(result.items),
                skills=[s.as_dict() for s in result.skills],
                sources=[s.as_dict() for s in result.sources],
                extras=dict(result.extras),
                grounded=result.grounded,
                model=result.model,
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                build_ms=result.build_ms,
            )
        )
        await self._session.flush()
        return learning_set

    async def mark(self, set_id: UUID, status: str, failure: str | None = None) -> None:
        learning_set = await self._session.get(LearningSet, set_id)
        if learning_set is not None:
            learning_set.status = status
            learning_set.failure = failure
            await self._session.flush()

    # --- editing ----------------------------------------------------------

    async def edit(
        self,
        owner_id: UUID,
        set_id: UUID,
        *,
        title: str | None = None,
        items: list[dict[str, Any]] | None = None,
        extras: dict[str, Any] | None = None,
    ) -> SetView:
        learning_set = await self.owned(owner_id, set_id)
        current = await self.version(learning_set)
        if current is None:
            raise ValidationError("This set is still being made.")
        if title is not None:
            learning_set.title = _title(title)
        if items is not None or extras is not None:
            cleaned = (
                self._clean(learning_set.kind, current, items)
                if items is not None
                else current.items
            )
            kept = self._clean_extras(learning_set.kind, current, extras)
            if await self._version_shared(set_id, current.version):
                current = await self._fork(learning_set, current, cleaned, kept)
            else:
                current.items = cleaned
                current.extras = kept
        learning_set.updated_at = datetime.now(UTC)
        await self._session.flush()
        return SetView(learning_set, current, await self._shares(set_id))

    def _clean(
        self, kind_name: str, version: LearningSetVersion, items: list[dict[str, Any]]
    ) -> list[Item]:
        kind = self._kinds[kind_name]
        if not items:
            raise ValidationError(f"A set needs at least one {kind.item_noun}.")
        if len(items) > kind.max_count:
            raise ValidationError(
                f"A set can hold at most {kind.max_count} {kind.item_noun_plural}."
            )
        skills = tuple(Skill(s["slug"], s["label"]) for s in version.skills)
        sources = {s["id"] for s in version.sources}
        cleaned = []
        for number, raw in enumerate(items, start=1):
            item = (
                kind.normalise(raw, skills=skills, source_ids=sources)
                if isinstance(raw, dict)
                else None
            )
            if item is None:
                raise ValidationError(
                    f"{kind.item_noun.title()} {number} is incomplete — check every field."
                )
            cleaned.append(item)
        return cleaned

    def _clean_extras(
        self, kind_name: str, version: LearningSetVersion, extras: dict[str, Any] | None
    ) -> dict[str, Any]:
        """New extras, cleaned by the kind that has them — or what was there.
        A kind without extras keeps none, whatever an editor sends."""
        kind = self._kinds[kind_name]
        if extras is None:
            return dict(version.extras or {})
        return kind.normalise_extras(extras) if isinstance(kind, Enriching) else {}

    async def _fork(
        self,
        learning_set: LearningSet,
        base: LearningSetVersion,
        items: list[Item],
        extras: dict[str, Any],
    ) -> LearningSetVersion:
        fork = LearningSetVersion(
            set_id=learning_set.id,
            version=base.version + 1,
            items=items,
            skills=base.skills,
            sources=base.sources,
            extras=extras,
            grounded=base.grounded,
            model=base.model,
        )
        self._session.add(fork)
        learning_set.current_version = fork.version
        await self._session.flush()
        return fork

    async def archive(self, owner_id: UUID, set_id: UUID) -> None:
        learning_set = await self.owned(owner_id, set_id)
        learning_set.archived_at = learning_set.archived_at or datetime.now(UTC)
        await self._session.flush()

    async def practice_made_today(self, owner_id: UUID) -> int:
        since = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        return int(
            await self._session.scalar(
                select(func.count()).where(
                    LearningSet.owner_id == owner_id,
                    LearningSet.purpose == "practice",
                    LearningSet.created_at >= since,
                )
            )
            or 0
        )


def _title(raw: str) -> str:
    title = " ".join(raw.split())
    if not 1 <= len(title) <= 200:
        raise ValidationError("A title must be 1-200 characters.")
    return title
