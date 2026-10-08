"""A game's code (§24): played by its maker before sharing, by a student in
their own attempt, and changed by asking.

The document is served on its own address so the content policy goes with it
as a header — no network, nothing from outside, scripts and nothing else —
and the page around it loads it into a frame with the same sandbox. Never
inlined into the app's own page.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import (
    CurrentUser,
    GameServiceDep,
    limit_generate,
    require_any_capability,
    require_capability,
)
from app.api.schemas.games import GameChangeRequest, GameStatusResponse
from app.learning.sim.runtime import HEADER_POLICY

MAKERS = ("share_learning_sets", "make_family_sets")
# At most this many missions named in a replay of the missed ones.
MOST_ONLY = 12

maker_router = APIRouter(
    prefix="/learning-sets",
    tags=["games"],
    dependencies=[Depends(require_any_capability(*MAKERS))],
)
student_router = APIRouter(
    prefix="/me",
    tags=["games"],
    dependencies=[Depends(require_capability("take_assignments"))],
)


@maker_router.get("/{set_id}/game", response_model=GameStatusResponse)
async def game_status(set_id: UUID, user: CurrentUser, games: GameServiceDep) -> GameStatusResponse:
    """Which revision is served, and whether a change is being made."""
    return GameStatusResponse.of(await games.status(user.id, set_id))


@maker_router.get("/{set_id}/game/play")
async def play_mine(
    set_id: UUID,
    user: CurrentUser,
    games: GameServiceDep,
    only: str | None = Query(default=None, max_length=600),
) -> Response:
    """The maker's own game, to play before sharing. Nothing is recorded."""
    return _game(await games.for_maker(user, set_id, only=_only(only)))


@maker_router.post(
    "/{set_id}/game/changes",
    response_model=GameStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_generate)],
)
async def change_game(
    set_id: UUID, body: GameChangeRequest, user: CurrentUser, games: GameServiceDep
) -> GameStatusResponse:
    """Rewrite the game as asked, then test it as a new one is tested."""
    return GameStatusResponse.of(await games.change(user, set_id, body.instruction))


@student_router.get("/attempts/{attempt_id}/game")
async def play_attempt(
    attempt_id: UUID,
    user: CurrentUser,
    games: GameServiceDep,
    only: str | None = Query(default=None, max_length=600),
) -> Response:
    """A student's game, for their own attempt only."""
    return _game(await games.for_attempt(user, attempt_id, only=_only(only)))


def _game(document: str) -> Response:
    return Response(
        content=document,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Security-Policy": HEADER_POLICY,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
        },
    )


def _only(value: str | None) -> set[str] | None:
    """The missions to replay, by id; None for the whole game."""
    if not value:
        return None
    wanted = {part.strip()[:40] for part in value.split(",") if part.strip()}
    return set(list(wanted)[:MOST_ONLY]) or None
