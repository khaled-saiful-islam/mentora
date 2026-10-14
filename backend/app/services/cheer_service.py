"""Cheers from home (§28.3.3): a parent picks a sticker and a line, and their
child's buddy acts it out on the child's screen — "Mum says: So proud of
you! 🌟".

Preset, never typed: there is nothing to moderate, and a child only ever
sees words chosen with care. Kept few, so a parent picks in a second.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.core.notifications import Kind
from app.db.models.user import User
from app.services.notification_service import NotificationService


@dataclass(frozen=True, slots=True)
class Cheer:
    sticker: str
    line: str
    # How the buddy acts it out.
    mood: str


CHEERS: dict[str, Cheer] = {
    "proud": Cheer("🌟", "So proud of you!", "celebrate"),
    "keep_going": Cheer("💪", "Keep going — you've got this!", "flex"),
    "well_done": Cheer("🎉", "Well done today!", "cheer"),
    "love": Cheer("❤️", "Love you, superstar!", "hug"),
    "mistakes": Cheer("🌱", "Mistakes help us grow. Try again!", "nod"),
    "high_five": Cheer("🙌", "High five!", "starjump"),
}


async def send_cheer(
    session: AsyncSession, parent: User, child: User, key: str, label: str
) -> Cheer:
    """Tell the child, as their parent: their buddy plays it when it arrives."""
    cheer = CHEERS.get(key)
    if cheer is None:
        raise ValidationError("Pick one of the cheers.")
    await NotificationService(session).notify(
        user_id=child.id,
        kind=Kind.CHEER,
        actor_id=parent.id,
        payload={
            "cheer": key,
            "sticker": cheer.sticker,
            "line": cheer.line,
            "mood": cheer.mood,
            "label": label,
        },
    )
    return cheer
