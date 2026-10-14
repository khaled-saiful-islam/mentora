"""Class Battle (§28.3.6): a teacher opens a battle for a class and runs it
on the class screen; students join and answer on their own devices; every
screen follows the room by SSE."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.api.deps import CurrentUser, SessionDep, StreamUser, require_capability
from app.battles.hub import BattleHub, battle_hub
from app.core.errors import ValidationError
from app.db.session import session_scope
from app.services.battle_service import BattleService
from app.services.family_service import first_name

router = APIRouter(prefix="/battles", tags=["battles"])

HubDep = Annotated[BattleHub, Depends(battle_hub)]
TEACHES = [Depends(require_capability("share_learning_sets"))]
PLAYS = [Depends(require_capability("take_assignments"))]


class OpenRequest(BaseModel):
    class_id: UUID
    set_id: UUID
    mode: str = Field(max_length=8)


class AnswerRequest(BaseModel):
    choice: int = Field(ge=0, le=9)


@router.post("", dependencies=TEACHES)
async def open_battle(
    body: OpenRequest, user: CurrentUser, session: SessionDep, hub: HubDep
) -> dict[str, Any]:
    room = await BattleService(session, hub).open(
        user, class_id=body.class_id, set_id=body.set_id, mode=body.mode
    )
    return room.view(user.id)


@router.post("/{battle_id}/start", dependencies=TEACHES)
async def start(battle_id: UUID, user: CurrentUser, session: SessionDep, hub: HubDep) -> dict:
    room = BattleService(session, hub).teachers(user, battle_id)
    try:
        room.start()
    except ValueError as exc:
        raise ValidationError("Wait for someone to join first.") from exc
    return room.view(user.id)


@router.post("/{battle_id}/next", dependencies=TEACHES)
async def skip(battle_id: UUID, user: CurrentUser, session: SessionDep, hub: HubDep) -> dict:
    room = BattleService(session, hub).teachers(user, battle_id)
    room.skip()
    return room.view(user.id)


@router.post("/{battle_id}/end", dependencies=TEACHES)
async def end(battle_id: UUID, user: CurrentUser, session: SessionDep, hub: HubDep) -> dict:
    room = BattleService(session, hub).teachers(user, battle_id)
    room.finish()
    return room.view(user.id)


@router.get("/mine", dependencies=PLAYS)
async def mine(user: CurrentUser, session: SessionDep, hub: HubDep) -> dict[str, Any]:
    rooms = await BattleService(session, hub).mine(user)
    return {
        "items": [
            {"id": str(r.id), "title": r.title, "mode": r.mode, "phase": r.phase} for r in rooms
        ]
    }


@router.post("/{battle_id}/join", dependencies=PLAYS)
async def join(battle_id: UUID, user: CurrentUser, session: SessionDep, hub: HubDep) -> dict:
    room = await BattleService(session, hub).students(user, battle_id)
    room.join(user.id, first_name(user), user.buddy)
    return room.view(user.id)


@router.post("/{battle_id}/answer", dependencies=PLAYS)
async def answer(
    battle_id: UUID, body: AnswerRequest, user: CurrentUser, session: SessionDep, hub: HubDep
) -> dict[str, bool]:
    room = await BattleService(session, hub).students(user, battle_id)
    return {"taken": room.answer(user.id, body.choice)}


@router.get("/{battle_id}/stream")
async def stream(battle_id: UUID, user: StreamUser, hub: HubDep) -> EventSourceResponse:
    async with session_scope() as db:
        room = await BattleService(db, hub).watching(user, battle_id)
    return EventSourceResponse(_frames(hub.follow(room, user.id)), ping=15)


async def _frames(views: AsyncIterator[dict[str, Any]]) -> AsyncIterator[dict[str, str]]:
    async for view in views:
        yield {
            "id": str(view["version"]),
            "event": "room",
            "data": json.dumps(view, ensure_ascii=False),
        }
