"""The coverage map as data: every topic of the syllabus against the months
of the year, with what was taught in each month and how the class did.

Pure: it is handed the syllabus, what was taught, where each thing was
sorted and the scores, and returns plain dicts ready to send.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

MAX_MONTHS = 12
# Mastery at or above: secure. Below the low mark: needs work.
SECURE_AT = 75.0
LOW_BELOW = 50.0


@dataclass(frozen=True, slots=True)
class Taught:
    """One thing the class was taught, or a live lesson on its way."""

    source: str  # "assignment" or "live"
    id: UUID
    kind: str  # "quiz", "flashcard", "study_guide" or "live"
    title: str
    topic: str
    when: datetime
    planned: bool = False

    @property
    def key(self) -> tuple[str, UUID]:
        return (self.source, self.id)

    def describe(self) -> str:
        """For the model sorting it."""
        what = "live lesson" if self.kind == "live" else self.kind.replace("_", " ")
        return f"{what}: {self.title} (topic: {self.topic})"

    def as_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "id": str(self.id),
            "kind": self.kind,
            "title": self.title,
            "when": self.when.isoformat(),
            "month": month_of(self.when),
            "planned": self.planned,
        }


def month_of(when: datetime) -> str:
    return f"{when.year:04d}-{when.month:02d}"


def months_for(items: Iterable[Taught], start: datetime, now: datetime) -> list[str]:
    """The months the map shows: from the first thing taught (or the class's
    start) to the end of that school year, never more than twelve."""
    first = min([start, now, *(i.when for i in items)])
    last_year = max(first.year, now.year)
    months: list[str] = []
    year, month = first.year, first.month
    while (year, month) <= (last_year, 12):
        months.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months[-MAX_MONTHS:] if len(months) > MAX_MONTHS else months


def topic_status(items: list[Taught], mastery: float | None) -> str:
    if not items:
        return "untouched"
    if all(i.planned for i in items):
        return "planned"
    if mastery is None:
        return "taught"
    if mastery >= SECURE_AT:
        return "secure"
    if mastery < LOW_BELOW:
        return "needs_work"
    return "taught"


def build(
    areas: list[dict[str, Any]],
    items: list[Taught],
    links: Mapping[tuple[str, UUID], str | None],
    mastery: Mapping[str, float],
    months: list[str],
) -> dict[str, Any]:
    by_topic: dict[str, list[Taught]] = {}
    outside: list[Taught] = []
    unsorted: list[Taught] = []
    known = {t["id"] for a in areas for t in a["topics"]}
    for item in sorted(items, key=lambda i: i.when):
        if item.key not in links:
            unsorted.append(item)
        elif links[item.key] in known:
            by_topic.setdefault(str(links[item.key]), []).append(item)
        else:
            outside.append(item)
    shaped = [_area(area, by_topic, mastery) for area in areas]
    return {
        "months": months,
        "areas": shaped,
        "outside": [i.as_dict() for i in outside],
        "unsorted": [i.as_dict() for i in unsorted],
        "summary": _summary(shaped, items),
    }


def _area(
    area: dict[str, Any], by_topic: Mapping[str, list[Taught]], mastery: Mapping[str, float]
) -> dict[str, Any]:
    topics = []
    for topic in area["topics"]:
        taught = by_topic.get(topic["id"], [])
        score = mastery.get(topic["id"])
        topics.append(
            {
                "id": topic["id"],
                "title": topic["title"],
                "status": topic_status(taught, score),
                "mastery": score,
                "items": [i.as_dict() for i in taught],
            }
        )
    scores = [t["mastery"] for t in topics if t["mastery"] is not None]
    done = sum(1 for t in topics if t["status"] not in ("untouched", "planned"))
    return {
        "id": area["id"],
        "title": area["title"],
        "topics": topics,
        "taught": done,
        "mastery": round(sum(scores) / len(scores), 1) if scores else None,
        "status": _area_status(done, len(topics), scores),
    }


def _area_status(done: int, total: int, scores: list[float]) -> str:
    if done == 0:
        return "untouched"
    if done < total:
        return "started"
    if scores and sum(scores) / len(scores) >= SECURE_AT:
        return "secure"
    return "covered"


def _summary(areas: list[dict[str, Any]], items: list[Taught]) -> dict[str, Any]:
    topics = [t for a in areas for t in a["topics"]]
    scores = [t["mastery"] for t in topics if t["mastery"] is not None]
    return {
        "topics": len(topics),
        "taught": sum(1 for t in topics if t["status"] not in ("untouched", "planned")),
        "secure": sum(1 for t in topics if t["status"] == "secure"),
        "needs_work": sum(1 for t in topics if t["status"] == "needs_work"),
        "mastery": round(sum(scores) / len(scores), 1) if scores else None,
        "items": sum(1 for i in items if not i.planned),
        "planned": sum(1 for i in items if i.planned),
    }
