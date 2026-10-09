"""How each kind of background work is named on the board: what it is, what
to call it, where it opens and how many steps it takes. One function per kind
of work, so a new one is a new function here and one `watch` at its start."""

from __future__ import annotations

from app.db.models.learning import LearningSet
from app.db.models.live import LiveSession
from app.learning.enrich import Enriching
from app.learning.registry import build_learning_kinds
from app.services.work import Ticket

# The generator's stages that finish: check, research, skills, write — and,
# for a kind with a finishing stage (a study guide's pictures, a game's story),
# that one too.
_SET_STAGES = 4
_FINISHED_STAGES = 5


def for_set(learning_set: LearningSet) -> Ticket:
    """A quiz, flashcards, a study guide or a game being made."""
    finishes = isinstance(build_learning_kinds().get(learning_set.kind), Enriching)
    steps = _FINISHED_STAGES if finishes else _SET_STAGES
    return Ticket(
        kind=learning_set.kind,
        title=learning_set.topic or learning_set.title,
        link=f"/library/{learning_set.id}",
        steps=steps,
        purpose=learning_set.purpose,
    )


def for_lesson_plan(live: LiveSession) -> Ticket:
    """A live lesson being written, one part at a time."""
    parts = live.settings.get("breakdown") or []
    return Ticket(
        kind="live_plan",
        title=live.title,
        link=f"/live/{live.id}",
        steps=len(parts) or None,
    )


def for_lesson_recording(live: LiveSession) -> Ticket:
    """A live lesson's voice being recorded, sentence by sentence."""
    return Ticket(kind="live_recording", title=live.title, link=f"/live/{live.id}")
