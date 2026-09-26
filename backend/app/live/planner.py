"""Writing a live lesson: the teacher's parts, in order, as spoken segments.

    check the topic → read the teacher's files → search the web for what they
    do not cover → write each part ⟲ check it (sayable, true to the sources)
    ⟲ repair it once → segments, in order, as each part is finished

Parts are written a few at a time, and handed on in the teacher's order the
moment each is ready, so the preview fills in while the rest is written.
Documents come first: a part is grounded in the teacher's own files, and the
web only fills what they leave out.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any

from app.core.grades import Grade, grade_for
from app.learning import prompts as learning_prompts
from app.learning.model import JsonModel
from app.learning.research import Researcher, Source
from app.live import plan_prompts as prompts
from app.live.beats import Beat, beats_from, spoken_seconds
from app.live.settings import SEGMENT_SECONDS, SessionSettings
from app.live.speakability import problems as spoken_problems
from app.moderation.base import Decision
from app.moderation.rules import InputRules
from app.services.document_excerpts import select_excerpts

logger = logging.getLogger(__name__)

# Parts written at once. Enough to be quick, few enough to be kind to the model.
CONCURRENCY = 3
# Tokens of the teacher's files handed to each part.
DOCUMENT_BUDGET = 1800
# Below this many words of relevant material, the web is asked too.
THIN_DOCUMENTS = 250
PART_TOKENS = 1600
# Only for measuring excerpts; any tiktoken model counts English about the same.
TOKEN_MODEL = "gpt-4o-mini"  # noqa: S105 — a model name, not a secret


class PlanRefused(RuntimeError):
    """The topic is not one the tutor can teach — said plainly."""


class PlanUnavailable(RuntimeError):
    """The lesson could not be written."""


@dataclass(frozen=True, slots=True)
class Document:
    filename: str
    text: str


@dataclass(frozen=True, slots=True)
class PlanInput:
    settings: SessionSettings
    documents: tuple[Document, ...] = ()
    students: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class PlannedSegment:
    part: int
    subtopic: str
    skill: str
    title: str
    beats: tuple[Beat, ...]
    key_points: tuple[str, ...]
    checkin: dict[str, Any] | None
    target_seconds: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "subtopic": self.subtopic,
            "skill": self.skill,
            "title": self.title,
            "beats": [b.as_dict() for b in self.beats],
            "key_points": list(self.key_points),
            "checkin": self.checkin,
            "target_seconds": self.target_seconds,
        }


@dataclass(frozen=True, slots=True)
class Stage:
    label: str


@dataclass(frozen=True, slots=True)
class PartWritten:
    part: int
    segments: tuple[PlannedSegment, ...]


PlanEvent = Stage | PartWritten


class LessonPlanner:
    def __init__(self, model: JsonModel, researcher: Researcher | None) -> None:
        self._model = model
        self._researcher = researcher

    async def breakdown(
        self, *, subject: str, topic: str, grade_level: str, difficulty: str, notes: str = ""
    ) -> list[str]:
        """The parts a teacher might teach this topic in — a suggestion to edit."""
        system, user = prompts.breakdown(
            subject, topic, grade_for(grade_level), difficulty, notes[:1500]
        )
        reply = await self._model.ask(
            "live.breakdown", system, user, temperature=0.4, max_tokens=300
        )
        parts = [_words(p, 60) for p in reply.get("parts") or [] if isinstance(p, str)]
        return [p for p in parts if p][:6]

    async def plan(self, request: PlanInput) -> AsyncIterator[PlanEvent]:
        settings = request.settings
        grade = grade_for(settings.grade_level)
        yield Stage("Checking the topic")
        await self._check(settings, grade)
        if request.documents:
            yield Stage("Reading your materials")
        web = await self._web(settings, grade, request.documents)
        counts = settings.segments_per_part()
        seconds = SEGMENT_SECONDS
        gate = asyncio.Semaphore(CONCURRENCY)

        async def one(index: int) -> PartWritten:
            async with gate:
                sources = _sources_for(settings.breakdown[index], settings, request.documents, web)
                segments = await self._part(request, grade, index, counts[index], seconds, sources)
                return PartWritten(index, segments)

        tasks = [asyncio.create_task(one(i)) for i in range(len(settings.breakdown))]
        try:
            for index, task in enumerate(tasks):
                yield Stage(
                    f"Writing part {index + 1} of {len(tasks)}: {settings.breakdown[index]}"
                )
                yield await task
        finally:
            for task in tasks:
                task.cancel()

    async def rewrite(
        self, request: PlanInput, segment: PlannedSegment, instruction: str
    ) -> PlannedSegment:
        """One segment again, the way the teacher asked."""
        settings = request.settings
        sources = _sources_for(segment.subtopic, settings, request.documents, [])
        written = json.dumps(segment.as_dict(), ensure_ascii=False)
        reply = await self._model.ask(
            "live.rewrite",
            prompts.part_system(),
            prompts.rewrite(written, instruction)
            + f"\n\n<sources>\n{_listing(sources)}\n</sources>",
            temperature=0.6,
            max_tokens=PART_TOKENS,
        )
        made = _segments(reply, segment.part, segment.subtopic, segment.target_seconds)
        if not made:
            raise PlanUnavailable("That part could not be rewritten. Try again in a moment.")
        return made[0]

    # --- stages -----------------------------------------------------------

    async def _check(self, settings: SessionSettings, grade: Grade | None) -> None:
        screened = InputRules().screen(f"{settings.subject} {settings.topic}")
        if screened.decision is Decision.BLOCK:
            raise PlanRefused("That topic isn't one the tutor can teach.")
        system, user = learning_prompts.check_topic(settings.subject, settings.topic, grade)
        verdict = await self._model.ask("live.check", system, user, temperature=0.0, max_tokens=300)
        if verdict.get("ok") is False:
            raise PlanRefused(
                str(verdict.get("reason") or "That topic isn't one the tutor can teach.")
            )

    async def _web(
        self, settings: SessionSettings, grade: Grade | None, documents: Sequence[Document]
    ) -> list[Source]:
        """Web sources, only when the teacher's files are thin on the topic."""
        if self._researcher is None or not self._researcher.available:
            return []
        relevant = sum(
            len(
                select_excerpts(d.text, question=settings.topic, budget=600, model=TOKEN_MODEL)[
                    0
                ].split()
            )
            for d in documents
        )
        if relevant >= THIN_DOCUMENTS * max(1, len(settings.breakdown) // 2):
            return []
        system, user = learning_prompts.plan_queries(settings.subject, settings.topic, grade)
        planned = await self._model.ask(
            "live.queries", system, user, temperature=0.2, max_tokens=300
        )
        queries = [q for q in planned.get("queries", []) if isinstance(q, str) and q.strip()]
        try:
            found = await self._researcher.gather(queries[:3] or [settings.topic])
        except Exception:  # noqa: BLE001 — a lesson without the web is still a lesson
            logger.warning("live.plan: web research failed", exc_info=True)
            return []
        return [_renamed(s, f"W{i}") for i, s in enumerate(found, start=1)]

    async def _part(
        self,
        request: PlanInput,
        grade: Grade | None,
        index: int,
        count: int,
        seconds: int,
        sources: list[Source],
    ) -> tuple[PlannedSegment, ...]:
        settings = request.settings
        subtopic = settings.breakdown[index]
        listing = _listing(sources)
        user = prompts.part_user(
            settings,
            grade,
            index=index,
            segments=count,
            students=list(request.students),
            sources=listing,
            seconds=seconds,
        )
        system = prompts.part_system()
        reply = await self._model.ask(
            "live.part", system, user, temperature=0.7, max_tokens=PART_TOKENS * count
        )
        segments = _segments(reply, index, subtopic, seconds)
        if not segments:
            raise PlanUnavailable(f'Part {index + 1}, "{subtopic}", could not be written.')
        found = await self._problems(segments, subtopic, grade, listing, request.students)
        if found:
            logger.info("live.part %d: repairing %d problems", index, len(found))
            written = json.dumps(reply, ensure_ascii=False)
            repaired = await self._model.ask(
                "live.repair",
                system,
                user + "\n\n" + prompts.repair(written, found),
                temperature=0.5,
                max_tokens=PART_TOKENS * count,
            )
            segments = _segments(repaired, index, subtopic, seconds) or segments
        return tuple(segments)

    async def _problems(
        self,
        segments: list[PlannedSegment],
        subtopic: str,
        grade: Grade | None,
        listing: str,
        students: Sequence[str],
    ) -> list[str]:
        found: list[str] = []
        for segment in segments:
            found += spoken_problems(
                list(segment.beats), target_seconds=segment.target_seconds, students=students
            )
        script = "\n\n".join(_script(s) for s in segments)
        system, user = prompts.verify(subtopic, grade, script, listing)
        verdict = await self._model.ask(
            "live.verify", system, user, temperature=0.0, max_tokens=600
        )
        found += [
            p.strip() for p in verdict.get("problems") or [] if isinstance(p, str) and p.strip()
        ]
        return found[:12]


# --- reading what the model wrote -------------------------------------------


def _segments(
    reply: dict[str, Any], part: int, subtopic: str, seconds: int
) -> list[PlannedSegment]:
    out: list[PlannedSegment] = []
    raw = reply.get("segments") if isinstance(reply.get("segments"), list) else []
    for n, entry in enumerate(raw):
        if not isinstance(entry, dict):
            continue
        beats = beats_from(entry.get("beats") or [], prefix=f"p{part}s{n}b")
        if not beats:
            continue
        out.append(
            PlannedSegment(
                part=part,
                subtopic=subtopic,
                skill=slug(subtopic),
                title=_words(entry.get("title"), 120) or subtopic,
                beats=tuple(beats),
                key_points=tuple(
                    k for k in (_words(p, 90) for p in entry.get("key_points") or []) if k
                )[:5],
                checkin=checkin_from(entry.get("checkin")),
                target_seconds=seconds,
            )
        )
    return out


def checkin_from(value: Any) -> dict[str, Any] | None:
    """A check-for-understanding question, or none if it is not a sound one."""
    if not isinstance(value, dict):
        return None
    question = _words(value.get("question"), 200)
    options = [o for o in (_words(x, 120) for x in value.get("options") or []) if o]
    answer = value.get("answer")
    if not question or not 2 <= len(options) <= 4 or len(set(options)) != len(options):
        return None
    if not isinstance(answer, int) or not 0 <= answer < len(options):
        return None
    return {
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": _words(value.get("explanation"), 240) or "",
    }


def seconds_of(segment: PlannedSegment) -> float:
    return spoken_seconds(list(segment.beats))


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "part"


def _script(segment: PlannedSegment) -> str:
    lines = [f"## {segment.title}", *(b.say for b in segment.beats)]
    if segment.checkin:
        c = segment.checkin
        lines.append(f"CHECK: {c['question']} — options {c['options']} — answer {c['answer']}")
    return "\n".join(lines)


def _sources_for(
    part: str, settings: SessionSettings, documents: Sequence[Document], web: list[Source]
) -> list[Source]:
    question = f"{part} {settings.topic}"
    budget = DOCUMENT_BUDGET // max(1, len(documents))
    mine = []
    for n, document in enumerate(documents, start=1):
        excerpt, _ = select_excerpts(
            document.text, question=question, budget=budget, model=TOKEN_MODEL
        )
        if excerpt.strip():
            mine.append(
                Source(
                    id=f"D{n}", title=document.filename, url="", host="your file", excerpt=excerpt
                )
            )
    return [*mine, *web[:4]]


def _listing(sources: list[Source]) -> str:
    return "\n\n".join(f"[{s.id}] {s.title} ({s.host})\n{s.excerpt[:1800]}" for s in sources)


def _renamed(source: Source, new_id: str) -> Source:
    return Source(
        id=new_id,
        title=source.title,
        url=source.url,
        host=source.host,
        excerpt=source.excerpt,
        published=source.published,
    )


def _words(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = " ".join(value.split())
    if len(cleaned) <= limit:
        return cleaned
    cut = cleaned[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(",;:—-")
