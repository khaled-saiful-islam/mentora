"""A game's code (§24): how it stands, and a change to make to it."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.services.game_service import INSTRUCTION_LIMIT, GameStatus


class GameStatusResponse(BaseModel):
    revision: int
    built_at: datetime
    changing: bool
    change: dict[str, Any] | None = None

    @classmethod
    def of(cls, status: GameStatus) -> GameStatusResponse:
        return cls(
            revision=status.revision,
            built_at=status.built_at,
            changing=status.changing,
            change=status.change,
        )


class GameChangeRequest(BaseModel):
    instruction: str = Field(min_length=3, max_length=INSTRUCTION_LIMIT)
