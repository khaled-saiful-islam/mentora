"""My materials: a teacher's own files, kept to make from (PLAN.md §21)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, SessionDep, SettingsDep, limit_upload, require_capability
from app.db.models.material import Material
from app.services.document_extract import classify
from app.services.material_service import MaterialService

router = APIRouter(
    prefix="/materials",
    tags=["materials"],
    dependencies=[Depends(require_capability("keep_materials"))],
)

PREVIEW_CHARS = 220


class RenameBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@router.get("")
async def index(
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    q: str | None = Query(default=None, max_length=80),
) -> dict[str, Any]:
    found = await MaterialService(session, settings).list(user.id, q=q)
    return {"items": [_out(m) for m in found], "limit": settings.materials_per_owner}


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_upload)])
async def upload(
    user: CurrentUser, session: SessionDep, settings: SettingsDep, file: UploadFile = File(...)
) -> dict[str, Any]:
    material = await MaterialService(session, settings).upload(
        user.id,
        filename=file.filename or "file",
        data=await file.read(),
        media_type=file.content_type or "application/octet-stream",
    )
    return _out(material)


@router.patch("/{material_id}")
async def rename(
    material_id: UUID,
    body: RenameBody,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    return _out(await MaterialService(session, settings).rename(user.id, material_id, body.title))


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    material_id: UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> Response:
    await MaterialService(session, settings).delete(user.id, material_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _out(material: Material) -> dict[str, Any]:
    return {
        "id": str(material.id),
        "title": material.title,
        "filename": material.filename,
        "kind": classify(filename=material.filename, media_type=material.media_type),
        "size_bytes": material.size_bytes,
        "unit": material.unit,
        "unit_count": material.unit_count,
        "preview": " ".join(material.text[: PREVIEW_CHARS * 2].split())[:PREVIEW_CHARS],
        "created_at": material.created_at.isoformat(),
        "updated_at": material.updated_at.isoformat(),
    }
