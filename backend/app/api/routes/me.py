"""Things about the signed-in person that depend on who they are.

Separate from `/auth`, which is about identity: this is about what the
interface should offer them. Each answer comes from the same capability that
the API enforces, so the two cannot disagree.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, SettingsDep
from app.artifacts.registry import build_kinds
from app.policies.capabilities import capabilities_for

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/makeable")
async def makeable(user: CurrentUser, settings: SettingsDep) -> dict[str, object]:
    """The studio artifacts this person may make, straight from the registry.

    Empty for a student — not a 403 — because asking "what can I make?" is a
    fair question with an honest answer of "none of these".
    """
    studio = capabilities_for(user.role).studio_artifacts
    kinds = build_kinds(settings).values() if studio else ()
    return {
        "studio": [
            {"name": kind.name, "label": kind.label, "description": kind.description}
            for kind in kinds
        ],
    }
