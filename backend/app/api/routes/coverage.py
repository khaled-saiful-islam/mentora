"""A class's coverage map, and the reports a teacher sends home.

Two audiences, in one file so the difference is impossible to miss:

- `/classes/{id}/coverage/*` — the teacher. Ownership is the lookup.
- `/reports/{token}` — a parent with a link. No auth, rate limited, never
  indexed, never cached; a revoked link answers like one that never existed.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SettingsDep,
    limit_generate,
    limit_share,
    require_capability,
)
from app.db.models.classroom import Classroom
from app.db.models.coverage import ProgressReport
from app.db.models.user import User
from app.learning.factory import build_model
from app.learning.model import Meter
from app.services.class_service import ClassService
from app.services.coverage.service import CoverageService

router = APIRouter(
    prefix="/classes/{class_id}/coverage",
    tags=["coverage"],
    dependencies=[Depends(require_capability("manage_classes"))],
)
public_router = APIRouter(prefix="/reports", tags=["coverage"])


class SyllabusBody(BaseModel):
    areas: list[Any] = Field(max_length=40)


class ReportBody(BaseModel):
    student_id: UUID | None = None


async def _class(session, user: User, class_id: UUID) -> Classroom:
    return await ClassService(session).get(user.id, class_id)


def _service(session, settings) -> CoverageService:
    return CoverageService(session, model=build_model(settings, Meter()))


@router.get("")
async def coverage(
    class_id: UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    """The map. Anything taught since the last look is sorted onto the
    syllabus first, once, and remembered."""
    classroom = await _class(session, user, class_id)
    return await _service(session, settings).coverage(classroom)


@router.put("/syllabus")
async def save_syllabus(
    class_id: UUID,
    body: SyllabusBody,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    classroom = await _class(session, user, class_id)
    return {"areas": await _service(session, settings).save(classroom, body.areas)}


@router.post("/syllabus/draft", dependencies=[Depends(limit_generate)])
async def draft_syllabus(
    class_id: UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    classroom = await _class(session, user, class_id)
    return {"areas": await _service(session, settings).draft(classroom)}


@router.post("/plan", dependencies=[Depends(limit_generate)])
async def plan(
    class_id: UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    classroom = await _class(session, user, class_id)
    return {"steps": await _service(session, settings).plan(classroom)}


@router.get("/reports")
async def reports(
    class_id: UUID, request: Request, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    await _class(session, user, class_id)
    found = await CoverageService(session).reports(class_id)
    return {"items": [_report(r, request, settings) for r in found]}


@router.post("/reports", status_code=status.HTTP_201_CREATED)
async def create_report(
    class_id: UUID,
    body: ReportBody,
    request: Request,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    classroom = await _class(session, user, class_id)
    report = await CoverageService(session).create_report(user.id, classroom, body.student_id)
    return _report(report, request, settings)


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_report(
    class_id: UUID, report_id: UUID, user: CurrentUser, session: SessionDep
) -> Response:
    await _class(session, user, class_id)
    await CoverageService(session).revoke(class_id, report_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@public_router.get("/{token}", dependencies=[Depends(limit_share)])
async def public_report(token: str, response: Response, session: SessionDep) -> dict[str, Any]:
    """What a parent sees, from a link the teacher sent."""
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    response.headers["Cache-Control"] = "no-store"
    return await CoverageService(session).public(token)


def _report(report: ProgressReport, request: Request, settings) -> dict[str, Any]:
    base = (settings.public_base_url or str(request.base_url)).rstrip("/")
    return {
        "id": str(report.id),
        "student_id": str(report.student_id) if report.student_id else None,
        "url": f"{base}/r/{report.token}",
        "created_at": report.created_at.isoformat(),
    }
