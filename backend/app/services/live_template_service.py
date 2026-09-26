"""A teacher's saved setups for live sessions, to start the next one from."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.db.models.live import LiveSessionTemplate
from app.live.settings import SessionSettings

MAX_TEMPLATES = 50


class LiveTemplateService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, teacher_id: UUID) -> list[LiveSessionTemplate]:
        return list(
            (
                await self._session.execute(
                    select(LiveSessionTemplate)
                    .where(LiveSessionTemplate.teacher_id == teacher_id)
                    .order_by(LiveSessionTemplate.updated_at.desc())
                )
            )
            .scalars()
            .all()
        )

    async def create(
        self, teacher_id: UUID, name: str, settings: SessionSettings
    ) -> LiveSessionTemplate:
        if len(await self.list(teacher_id)) >= MAX_TEMPLATES:
            raise ValidationError(f"You can keep {MAX_TEMPLATES} templates. Delete one first.")
        template = LiveSessionTemplate(
            teacher_id=teacher_id, name=_name(name), settings=settings.model_dump(mode="json")
        )
        self._session.add(template)
        await self._session.flush()
        return template

    async def update(
        self,
        teacher_id: UUID,
        template_id: UUID,
        *,
        name: str | None,
        settings: SessionSettings | None,
    ) -> LiveSessionTemplate:
        template = await self.owned(teacher_id, template_id)
        if name is not None:
            template.name = _name(name)
        if settings is not None:
            template.settings = settings.model_dump(mode="json")
        await self._session.flush()
        return template

    async def delete(self, teacher_id: UUID, template_id: UUID) -> None:
        await self._session.delete(await self.owned(teacher_id, template_id))
        await self._session.flush()

    async def owned(self, teacher_id: UUID, template_id: UUID) -> LiveSessionTemplate:
        template = (
            await self._session.execute(
                select(LiveSessionTemplate).where(
                    LiveSessionTemplate.id == template_id,
                    LiveSessionTemplate.teacher_id == teacher_id,
                )
            )
        ).scalar_one_or_none()
        if template is None:
            raise NotFoundError("No such template.")
        return template


def _name(raw: str) -> str:
    cleaned = " ".join(raw.split())[:120]
    if not cleaned:
        raise ValidationError("Give the template a name.")
    return cleaned
