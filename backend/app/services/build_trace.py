"""What a build's trace says (§27): what was asked for, and the scores it ends
with — numbers to filter and chart builds by in Langfuse.

| score | what it is |
|---|---|
| `outcome` | done, refused or failed |
| `items_kept` | items made out of those asked for |
| `passed_first_check` | share of written items the fact check passed first time |
| `fallback_rate` | a game's islands whose round broke its rules and became Match Up |
| `repeats_dropped` | a game's islands dropped for teaching an idea twice |
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from app.learning.generator import GenerationRequest
from app.observability.base import Content, Kind, TraceInfo, keeps_text
from app.observability.context import pseudonym

Score = tuple[str, float | str]


def build_trace_info(
    set_id: UUID, request: GenerationRequest, owner_id: UUID | None, content: Content
) -> TraceInfo:
    """What a build's trace says it is. The topic only where the trace may
    keep a build's words (`LANGFUSE_CONTENT`)."""
    metadata: dict[str, Any] = {
        "learning_kind": request.kind,
        "grade": request.grade_level,
        "language": request.language,
        "count": request.count,
        "level": request.level,
        "grounded_in_materials": bool(request.sources),
    }
    asked = None
    if keeps_text(content, Kind.BUILD):
        # A game's choices can carry the teacher's own story line.
        asked = {
            "topic": request.topic,
            "subject": request.subject,
            "grade": request.grade_level,
            "count": request.count,
            "choices": dict(request.choices),
        }
        metadata.update(subject=request.subject, topic=request.topic, choices=asked["choices"])
    return TraceInfo(
        name=f"build {request.kind}",
        kind=Kind.BUILD,
        user=pseudonym(owner_id),
        session=str(set_id),
        tags=(request.kind,),
        metadata=metadata,
        input=asked,
    )


def build_scores(ending: Mapping[str, Any], tally: Mapping[str, int], kind: str) -> list[Score]:
    """The scores for a build that ended with `ending` (its last event),
    from what its trace counted on the way."""
    outcome = str(ending.get("type") or "failed")
    scores: list[Score] = [("outcome", outcome)]
    if outcome != "done":
        return scores
    requested = int(ending.get("requested") or 0)
    if requested:
        scores.append(("items_kept", _share(int(ending.get("count") or 0), requested)))
    drafted = tally.get("items drafted", 0)
    if drafted:
        failed = tally.get("items failed the check", 0)
        scores.append(("passed_first_check", _share(drafted - failed, drafted)))
    if kind == "game":
        if drafted:
            scores.append(("fallback_rate", _share(tally.get("fell back to Match Up", 0), drafted)))
        scores.append(("repeats_dropped", float(tally.get("dropped as a repeat", 0))))
    return scores


def _share(part: int, whole: int) -> float:
    return round(max(0.0, min(1.0, part / whole)), 3)
