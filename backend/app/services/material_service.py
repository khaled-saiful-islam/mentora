"""A teacher's own teaching material, kept to make from (PLAN.md §21).

A file is read once, at upload, into text (`document_extract`, as chat and
live lessons already do), and kept with its title and size. Making a set
from materials reads the parts of each file that bear on the topic
(`document_excerpts`), within a budget shared between the chosen files. They
become the set's first sources, cited as the teacher's own.

Ownership is the lookup: a material that is not yours is not found.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import PurePath
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.models.material import Material
from app.learning.research import Source
from app.services.document_excerpts import select_excerpts
from app.services.document_extract import (
    UnreadableDocument,
    UnsupportedDocument,
    classify,
    extract,
)
from app.services.document_service import human_size

TITLE_CHARS = 200
# Each material's excerpt gets at least this much of the budget.
MIN_SHARE = 800


class MaterialService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def upload(
        self, owner_id: UUID, *, filename: str, data: bytes, media_type: str
    ) -> Material:
        name = (filename or "file").strip()[:255]
        if not data:
            raise ValidationError(f"{name} is empty.")
        limit = self._settings.material_max_bytes
        if len(data) > limit:
            raise ValidationError(
                f"{name} is {human_size(len(data))}. The limit is {human_size(limit)}."
            )
        if await self._count(owner_id) >= self._settings.materials_per_owner:
            raise ConflictError(
                f"Your library holds {self._settings.materials_per_owner} files. "
                "Remove one you no longer use to add another."
            )
        try:
            if classify(filename=name, media_type=media_type) == "image":
                raise ValidationError("Upload the text: a PDF, Word, PowerPoint or text file.")
            extracted = extract(data, filename=name, media_type=media_type)
        except (UnsupportedDocument, UnreadableDocument) as exc:
            raise ValidationError(str(exc)) from exc
        if not extracted.text.strip():
            raise ValidationError(
                f"{name} has no text to read — a scanned page is a picture. "
                "Try the original document, or a copy with selectable text."
            )
        material = Material(
            owner_id=owner_id,
            title=title_from(name),
            filename=name,
            media_type=media_type[:120],
            size_bytes=len(data),
            unit=extracted.unit,
            unit_count=extracted.count,
            text=extracted.text,
        )
        self._session.add(material)
        await self._session.flush()
        return material

    async def list(self, owner_id: UUID, *, q: str | None = None) -> list[Material]:
        query = select(Material).where(Material.owner_id == owner_id)
        if q and q.strip():
            like = f"%{q.strip()}%"
            query = query.where(or_(Material.title.ilike(like), Material.text.ilike(like)))
        rows = await self._session.scalars(query.order_by(Material.updated_at.desc()))
        return list(rows.all())

    async def owned(self, owner_id: UUID, material_id: UUID) -> Material:
        material = await self._session.scalar(
            select(Material).where(Material.id == material_id, Material.owner_id == owner_id)
        )
        if material is None:
            raise NotFoundError("No such file in your materials.")
        return material

    async def several(self, owner_id: UUID, ids: Sequence[UUID]) -> list[Material]:
        """The chosen materials, in the order chosen. Any that is not yours,
        or gone, is refused — a set is never made from someone else's file."""
        if not ids:
            return []
        rows = await self._session.scalars(
            select(Material).where(Material.id.in_(list(ids)), Material.owner_id == owner_id)
        )
        found = {m.id: m for m in rows.all()}
        missing = [i for i in ids if i not in found]
        if missing:
            raise NotFoundError("One of those files isn't in your materials any more.")
        return [found[i] for i in ids]

    async def rename(self, owner_id: UUID, material_id: UUID, title: str) -> Material:
        material = await self.owned(owner_id, material_id)
        cleaned = " ".join(title.split())[:TITLE_CHARS]
        if not cleaned:
            raise ValidationError("Give the file a name.")
        material.title = cleaned
        await self._session.flush()
        return material

    async def delete(self, owner_id: UUID, material_id: UUID) -> None:
        material = await self.owned(owner_id, material_id)
        await self._session.delete(material)
        await self._session.flush()

    async def sources_for(
        self, owner_id: UUID, ids: Sequence[UUID], *, topic: str
    ) -> tuple[Source, ...]:
        """The parts of each chosen file that bear on the topic, as sources
        `M1`, `M2`… — the whole file when it fits its share of the budget."""
        materials = await self.several(owner_id, ids)
        if not materials:
            return ()
        share = max(MIN_SHARE, self._settings.material_token_budget // len(materials))
        sources = []
        for n, material in enumerate(materials, start=1):
            excerpt, _ = select_excerpts(
                material.text,
                question=topic,
                budget=share,
                model=self._settings.resolved_learning_model,
            )
            sources.append(
                Source(
                    id=f"M{n}",
                    title=material.title,
                    url="",
                    host="your materials",
                    excerpt=excerpt,
                )
            )
        return tuple(sources)

    async def _count(self, owner_id: UUID) -> int:
        return int(
            await self._session.scalar(select(func.count()).where(Material.owner_id == owner_id))
            or 0
        )


def title_from(filename: str) -> str:
    """ "Chapter_3 - Photosynthesis.pdf" → "Chapter 3 - Photosynthesis"."""
    stem = PurePath(filename).stem.replace("_", " ")
    # A slug ("food-chains-notes") reads as words; "Chapter 3 - Plants" keeps its dash.
    if " " not in stem:
        stem = stem.replace("-", " ")
    return " ".join(stem.split())[:TITLE_CHARS] or "Untitled"
