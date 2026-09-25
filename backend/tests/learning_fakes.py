"""Shared doubles for the learning tests: a model that answers by stage, a
search that returns what it is given, and a happy set of answers."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.learning.model import Meter
from app.providers.base import ToolResult

Answer = dict[str, Any] | Callable[[str, str], dict[str, Any]]


class FakeModel:
    name = "fake-model"

    def __init__(self, answers: dict[str, Answer], meter: Meter) -> None:
        self._answers = answers
        self._meter = meter
        self.asked: list[str] = []

    async def ask(self, stage, system, user, *, temperature=0.3, max_tokens=2000):
        self.asked.append(stage)
        self._meter.add(stage, 100, 50)
        answer = self._answers.get(stage, {})
        if isinstance(answer, Exception):
            raise answer
        return answer(system, user) if callable(answer) else answer


class FakeSearch:
    def __init__(self, results: list[ToolResult] | Exception) -> None:
        self._results = results
        self.queries: list[str] = []

    async def search(self, query, *, limit=5, recency=None):
        self.queries.append(query)
        if isinstance(self._results, Exception):
            raise self._results
        return self._results

    async def search_images(self, query, *, limit=6):
        return []


def result(url: str, snippet: str = "Plants make food using light.", rank: int = 1) -> ToolResult:
    return ToolResult(
        tool="web_search", title=f"Page at {url}", url=url, snippet=snippet, rank=rank
    )


GOOD_RESULTS = [
    result("https://www.britannica.com/science/photosynthesis", rank=3),
    result("https://example-blog.com/plants", rank=1),
    result("https://www.reddit.com/r/plants", rank=2),
]


def question(n: int) -> dict[str, Any]:
    return {
        "prompt": f"Question {n}: what do leaves use to capture light?",
        "options": [f"Chlorophyll {n}", f"Salt {n}", f"Sugar {n}", f"Water {n}"],
        "answer": n % 4,
        "explanation": "Chlorophyll absorbs light.",
        "skill": "chlorophyll",
        "source_ids": ["s1"],
    }


def drafts() -> Callable[[str, str], dict[str, Any]]:
    counter = iter(range(1, 1000))

    def answer(system: str, user: str) -> dict[str, Any]:
        want = int(user.rsplit("Write ", 1)[1].split()[0])
        return {"items": [question(next(counter)) for _ in range(want)]}

    return answer


def all_ok(system: str, user: str) -> dict[str, Any]:
    return {"results": []}


def happy(**overrides: Answer) -> dict[str, Answer]:
    return {
        "check": {"ok": True, "title": "Photosynthesis Quest", "topic": "Photosynthesis"},
        "queries": {"queries": ["photosynthesis year 5", "how plants make food"]},
        "screen": {"keep": ["s1", "s2"]},
        "skills": {
            "skills": [
                {"slug": "chlorophyll", "label": "Chlorophyll"},
                {"slug": "light", "label": "Light energy"},
            ]
        },
        "draft": drafts(),
        "verify": all_ok,
        **overrides,
    }
