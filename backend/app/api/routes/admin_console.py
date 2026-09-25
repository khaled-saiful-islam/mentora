"""The admin console beyond accounts: the overview, the moderation queue and
the content browser. Every route here is behind `current_admin`."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import AdminUser, SessionDep, SettingsDep, current_admin
from app.api.routes.artifacts import document_response
from app.api.schemas.admin import (
    ContentArtifact,
    ContentSet,
    ContentSetDetail,
    DayResponse,
    ModerationItem,
    ModerationPage,
    OverviewResponse,
    PersonRef,
    ReviewRequest,
)
from app.core.grades import grade_label
from app.db.models.learning import LearningSet
from app.db.models.moderation import ModerationEvent
from app.db.models.user import User
from app.services.admin_stats_service import AdminStatsService
from app.services.content_service import ContentService
from app.services.moderation_service import ModerationService

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])


def _person(user: User) -> PersonRef:
    return PersonRef(
        id=user.id,
        name=user.display_name or user.sign_in_name,
        role=user.role,
        grade_label=grade_label(user.grade_level),
    )


@router.get("/overview", response_model=OverviewResponse)
async def overview(session: SessionDep, admin: AdminUser) -> OverviewResponse:
    found = await AdminStatsService(session).overview()
    return OverviewResponse(
        users=found.users,
        learning=found.learning,
        tokens_24h=found.tokens_24h,
        safety=found.safety,
        trend=[
            DayResponse(day=d.day, attempts=d.attempts, messages=d.messages, signups=d.signups)
            for d in found.trend
        ],  # fmt: skip
    )


# --- moderation ------------------------------------------------------------


def _item(event: ModerationEvent, user: User | None) -> ModerationItem:
    return ModerationItem(
        id=event.id,
        kind=event.kind,
        source=event.source,
        category=event.category,
        severity=event.severity,
        rule=event.rule,
        screen=event.screen,
        excerpt=event.excerpt,
        status=event.status,
        note=event.note,
        created_at=event.created_at,
        reviewed_at=event.reviewed_at,
        conversation_id=event.conversation_id,
        set_id=event.set_id,
        user=_person(user) if user else None,
    )


@router.get("/moderation", response_model=ModerationPage)
async def moderation(
    session: SessionDep,
    admin: AdminUser,
    status: str | None = Query(default="open", pattern="^(open|reviewed|dismissed|all)$"),
    severity: str | None = Query(default=None, pattern="^(low|medium|high)$"),
    kind: str | None = Query(default=None, max_length=32),
    before: datetime | None = None,
) -> ModerationPage:
    log = ModerationService(session)
    items = await log.queue(
        status=None if status == "all" else status, severity=severity, kind=kind, before=before
    )
    return ModerationPage(
        items=[_item(i.event, i.user) for i in items], counts=await log.open_counts()
    )


@router.patch("/moderation/{event_id}", response_model=ModerationItem)
async def review(
    event_id: UUID, body: ReviewRequest, session: SessionDep, admin: AdminUser
) -> ModerationItem:
    event = await ModerationService(session).review(
        event_id, admin.id, status=body.status, note=body.note
    )
    user = await session.get(User, event.user_id) if event.user_id else None
    return _item(event, user)


# --- content ---------------------------------------------------------------


@router.get("/content/artifacts", response_model=list[ContentArtifact])
async def artifacts(
    session: SessionDep,
    admin: AdminUser,
    q: str | None = Query(default=None, max_length=120),
    kind: str | None = Query(default=None, max_length=32),
    before: datetime | None = None,
) -> list[ContentArtifact]:
    rows = await ContentService(session).artifacts(q=q, kind=kind, before=before)
    return [
        ContentArtifact(
            id=r.artifact.id,
            kind=r.artifact.kind,
            title=r.artifact.title,
            owner=_person(r.owner),
            version=r.artifact.current_version,
            created_at=r.artifact.created_at,
            updated_at=r.artifact.updated_at,
        )
        for r in rows
    ]


@router.get("/content/artifacts/{artifact_id}/raw", response_class=Response)
async def artifact_raw(
    artifact_id: UUID, session: SessionDep, settings: SettingsDep, admin: AdminUser
) -> Response:
    """The document, sandboxed exactly as it is for its owner."""
    artifact, html = await ContentService(session).artifact_html(artifact_id)
    return document_response(html, artifact.kind, settings)


def _set(learning_set: LearningSet, owner: User, items: int, shares: int) -> dict:
    return {
        "id": learning_set.id,
        "kind": learning_set.kind,
        "purpose": learning_set.purpose,
        "title": learning_set.title,
        "topic": learning_set.topic,
        "subject": learning_set.subject,
        "grade_label": grade_label(learning_set.grade_level),
        "status": learning_set.status,
        "owner": _person(owner),
        "item_count": items,
        "shares": shares,
        "created_at": learning_set.created_at,
    }


@router.get("/content/sets", response_model=list[ContentSet])
async def sets(
    session: SessionDep,
    admin: AdminUser,
    q: str | None = Query(default=None, max_length=120),
    kind: str | None = Query(default=None, pattern="^(quiz|flashcard)$"),
    purpose: str | None = Query(default=None, pattern="^(assign|practice)$"),
    before: datetime | None = None,
) -> list[ContentSet]:
    rows = await ContentService(session).sets(q=q, kind=kind, purpose=purpose, before=before)
    return [ContentSet(**_set(r.learning_set, r.owner, r.item_count, r.shares)) for r in rows]


@router.get("/content/sets/{set_id}", response_model=ContentSetDetail)
async def set_detail(set_id: UUID, session: SessionDep, admin: AdminUser) -> ContentSetDetail:
    learning_set, owner, items, shares = await ContentService(session).set_items(set_id)
    return ContentSetDetail(**_set(learning_set, owner, len(items), shares), items=items)
