"""A class's syllabus as data: areas, each with topics, every one with a
stable id so what was taught stays sorted when the teacher edits the rest.

`areas_from` cleans whatever arrives — a model's draft or a teacher's edit —
and never raises: nonsense becomes nothing, and too much is cut to size.
"""

from __future__ import annotations

import re
from typing import Any

MAX_AREAS = 12
MAX_TOPICS = 8
AREA_CHARS = 80
TOPIC_CHARS = 100
_ID = re.compile(r"^a\d{1,3}(t\d{1,3})?$")


def areas_from(raw: Any) -> list[dict[str, Any]]:
    """Clean areas, keeping ids that are well-formed and unique and giving
    fresh ones to everything else."""
    if not isinstance(raw, list):
        return []
    taken: set[str] = set()
    cleaned: list[dict[str, Any]] = []
    for area in raw[:MAX_AREAS]:
        title = _text(area.get("title") if isinstance(area, dict) else area, AREA_CHARS)
        if not title:
            continue
        area_id = _keep(area.get("id") if isinstance(area, dict) else None, taken, topic=False)
        topics = area.get("topics") if isinstance(area, dict) else []
        cleaned.append({"id": area_id, "title": title, "topics": _topics(topics, taken)})
    return _fill_ids(cleaned, taken)


def topic_ids(areas: list[dict[str, Any]]) -> set[str]:
    return {t["id"] for a in areas for t in a["topics"]}


def outline(areas: list[dict[str, Any]]) -> str:
    """The syllabus as a model reads it: one line per topic, with its id."""
    return "\n".join(f"[{t['id']}] {a['title']} — {t['title']}" for a in areas for t in a["topics"])


def _topics(raw: Any, taken: set[str]) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    topics = []
    for topic in raw[:MAX_TOPICS]:
        title = _text(topic.get("title") if isinstance(topic, dict) else topic, TOPIC_CHARS)
        if title:
            topic_id = _keep(
                topic.get("id") if isinstance(topic, dict) else None, taken, topic=True
            )
            topics.append({"id": topic_id, "title": title})
    return topics


def _keep(raw: Any, taken: set[str], *, topic: bool) -> str:
    """The id as given when it is a real, unused one; empty for a fresh one."""
    if isinstance(raw, str) and _ID.match(raw) and ("t" in raw) == topic and raw not in taken:
        taken.add(raw)
        return raw
    return ""


def _fill_ids(areas: list[dict[str, Any]], taken: set[str]) -> list[dict[str, Any]]:
    next_area = _next(taken, "a", lambda i: f"a{i}")
    for area in areas:
        if not area["id"]:
            area["id"] = next_area()
        prefix = area["id"]
        next_topic = _next(taken, prefix, lambda i, p=prefix: f"{p}t{i}")
        for topic in area["topics"]:
            if not topic["id"] or not topic["id"].startswith(f"{prefix}t"):
                topic["id"] = next_topic()
    return areas


def _next(taken: set[str], _prefix: str, make: Any) -> Any:
    counter = [0]

    def fresh() -> str:
        while True:
            counter[0] += 1
            candidate = make(counter[0])
            if candidate not in taken:
                taken.add(candidate)
                return candidate

    return fresh


def _text(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:limit]
