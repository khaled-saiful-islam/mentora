"""Making a learning set, grounded in the web, in stages you can watch.

    check → research → skills → write ⟲ verify ⟲ repair → [finish] → built

Each stage yields what it did, so the panel can show the set being made
rather than a spinner. Items are only announced once a second pass has
checked them against their sources; what fails is repaired once and
dropped if it still fails, and a short fall is topped up once. When search is
unavailable the set is still written — and says it is not grounded — because
a worse set beats no set, and hiding the difference would be worse than both.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from app.core.grades import Grade, grade_for
from app.learning import prompts
from app.learning.base import Item, LearningKind, Skill
from app.learning.enrich import Enriching, Finishing
from app.learning.model import GenerationUnavailable, JsonModel, Meter
from app.learning.research import Researcher, Source, listing
from app.moderation.base import Decision
from app.moderation.rules import InputRules

logger = logging.getLogger(__name__)

BATCH = 5
DRAFT_TOKENS = 3500
ITEM_TOKENS = 900


def _budget(kind: LearningKind) -> tuple[int, int, int]:
    """Items per call, and the token budgets for a batch and for one item.
    A kind with long items says so; the rest share the defaults."""
    return (
        int(getattr(kind, "batch", BATCH)),
        int(getattr(kind, "draft_tokens", DRAFT_TOKENS)),
        int(getattr(kind, "item_tokens", ITEM_TOKENS)),
    )


@dataclass(frozen=True, slots=True)
class GenerationRequest:
    kind: str
    topic: str
    subject: str | None = None
    grade_level: str | None = None
    count: int = 10
    language: str = "en"
    # Given sources, used instead of searching — a live lesson's own
    # transcript and the teacher's files, which is what its quiz must test.
    sources: tuple[Source, ...] = ()
    # Given skills as (slug, label), used instead of mapping them — so a
    # quiz's results land under the parts the teacher named.
    skills: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True, slots=True)
class GenerationResult:
    title: str
    topic: str
    items: tuple[Item, ...]
    skills: tuple[Skill, ...]
    sources: tuple[Source, ...]
    grounded: bool
    requested: int
    model: str
    prompt_tokens: int
    completion_tokens: int
    build_ms: int
    # What the set has besides its items — a study guide's opening and ending.
    extras: dict[str, Any] = field(default_factory=dict)


# --- what a build says as it goes ---------------------------------------------


@dataclass(frozen=True, slots=True)
class Stage:
    key: str  # check | research | skills | write
    state: str  # running | done
    label: str
    detail: str = ""


@dataclass(frozen=True, slots=True)
class SourcesFound:
    sources: tuple[Source, ...]


@dataclass(frozen=True, slots=True)
class SkillsMapped:
    skills: tuple[Skill, ...]


@dataclass(frozen=True, slots=True)
class ItemsReady:
    items: tuple[Item, ...]


@dataclass(frozen=True, slots=True)
class Pictured:
    """Pictures found for items already announced, by item id."""

    pictures: dict[str, dict[str, str]]


REFUSED_TOPIC = "That topic isn't one we can make a set about. Try a school topic!"


@dataclass(frozen=True, slots=True)
class Refused:
    """The topic check said no. Friendly words, for the person who asked."""

    message: str
    # For the moderation log: which check said no, and about what.
    rule: str = "topic_check"
    category: str = "unsafe"


@dataclass(frozen=True, slots=True)
class Built:
    result: GenerationResult


Update = Stage | SourcesFound | SkillsMapped | ItemsReady | Pictured | Refused | Built


@dataclass(frozen=True, slots=True)
class _Plan:
    title: str
    topic: str
    grade: Grade | None


class LearningGenerator:
    def __init__(
        self, model: JsonModel, researcher: Researcher, kind: LearningKind, meter: Meter
    ) -> None:
        self._model = model
        self._researcher = researcher
        self._kind = kind
        self._meter = meter

    async def run(self, request: GenerationRequest) -> AsyncIterator[Update]:
        started = time.monotonic()
        count = max(1, min(request.count, self._kind.max_count))
        grade = grade_for(request.grade_level)

        yield Stage("check", "running", "Checking the topic")
        plan = await self._check(request, grade)
        if isinstance(plan, Refused):
            yield plan
            return
        yield Stage("check", "done", "Checking the topic", plan.topic)

        yield Stage("research", "running", "Searching trusted sources")
        sources = list(request.sources) or await self._research(request, plan)
        yield SourcesFound(tuple(sources))
        yield Stage("research", "done", "Searching trusted sources", _found(sources))

        yield Stage("skills", "running", "Mapping the skills")
        skills = (
            tuple(Skill(slug, label) for slug, label in request.skills)
            if request.skills
            else await self._skills(plan, sources)
        )
        yield SkillsMapped(skills)
        yield Stage("skills", "done", "Mapping the skills", ", ".join(s.label for s in skills))

        noun = self._kind.item_noun_plural
        yield Stage("write", "running", f"Writing {count} {noun}")
        items: list[Item] = []
        async for batch in self._write(request, plan, skills, sources, count):
            items.extend(batch)
            yield ItemsReady(tuple(batch))
        if not items:
            raise GenerationUnavailable(f"No {noun} passed the checks. Try a clearer topic.")
        yield Stage(
            "write", "done", f"Writing {count} {noun}", f"{len(items)} of {count} passed checks"
        )

        extras: dict[str, Any] = {}
        if isinstance(self._kind, Enriching):
            yield Stage("finish", "running", "Adding pictures and finishing touches")
            items, extras = await self._finish(self._kind, request, plan, items, sources)
            pictured = sum(1 for item in items if item.get("image"))
            yield Pictured({item["id"]: item["image"] for item in items if item.get("image")})
            yield Stage(
                "finish",
                "done",
                "Adding pictures and finishing touches",
                f"{pictured} of {len(items)} with a picture",
            )

        yield Built(self._result(request, plan, items, skills, sources, count, started, extras))

    # --- stages ---------------------------------------------------------------

    async def _finish(
        self,
        kind: Enriching,
        request: GenerationRequest,
        plan: _Plan,
        items: list[Item],
        sources: list[Source],
    ) -> tuple[list[Item], dict[str, Any]]:
        """Pictures and the opening and ending, side by side. Either can come
        back empty; neither can fail a set whose items are already written."""
        finishing = Finishing(
            title=plan.title,
            topic=plan.topic,
            grade=plan.grade,
            language=request.language,
            items=tuple(items),
            sources=tuple(sources),
        )
        pictured, extras = await asyncio.gather(
            kind.illustrate(items, topic=plan.topic, pictures=self._researcher),
            kind.wrap(self._model, finishing),
            return_exceptions=True,
        )
        for part, outcome in (("pictures", pictured), ("wrap", extras)):
            if isinstance(outcome, BaseException):
                # The set is whole without it; the log says which half is missing.
                logger.warning("finishing %s: %s failed: %r", plan.topic, part, outcome)
        return (
            pictured if isinstance(pictured, list) else items,
            extras if isinstance(extras, dict) else {},
        )

    async def _check(self, request: GenerationRequest, grade: Grade | None) -> _Plan | Refused:
        # The fast rules first: "how to make a bomb" needs no model to refuse.
        # Refusals only — a teacher's "suicide prevention" topic is the model's
        # call, not a pattern's.
        screened = InputRules().screen(" ".join(filter(None, [request.subject, request.topic])))
        if screened.decision is Decision.BLOCK:
            return Refused(REFUSED_TOPIC, rule=screened.rule, category=screened.category.value)
        system, user = prompts.check_topic(request.subject, request.topic, grade)
        verdict = await self._model.ask("check", system, user, temperature=0.0, max_tokens=300)
        # An unreadable verdict is not a refusal: the guardrails in front of
        # generation have already had their say.
        if verdict.get("ok") is False:
            return Refused(
                str(verdict.get("reason") or "That topic isn't one we can make a set about.")
            )
        topic = _short(verdict.get("topic"), 200) or request.topic.strip()
        title = _short(verdict.get("title"), 120) or topic.title()
        return _Plan(title=title, topic=topic, grade=grade)

    async def _research(self, request: GenerationRequest, plan: _Plan) -> list[Source]:
        if not self._researcher.available:
            return []
        system, user = prompts.plan_queries(request.subject, plan.topic, plan.grade)
        planned = await self._model.ask("queries", system, user, temperature=0.2, max_tokens=300)
        queries = [q for q in planned.get("queries", []) if isinstance(q, str) and q.strip()]
        fallback = " ".join(
            filter(None, [plan.topic, request.subject, plan.grade.label if plan.grade else None])
        )
        found = await self._researcher.gather(queries[:3] or [fallback])
        return await self._screen(plan, found)

    async def _screen(self, plan: _Plan, sources: list[Source]) -> list[Source]:
        if not sources:
            return []
        system, user = prompts.screen_sources(plan.topic, plan.grade, listing(sources))
        verdict = await self._model.ask("screen", system, user, temperature=0.0, max_tokens=300)
        keep = verdict.get("keep")
        chosen = [s for s in sources if s.id in keep] if isinstance(keep, list) else sources
        # Renumbered so the model sees s1..sN with no gaps.
        return [_renumber(source, n) for n, source in enumerate(chosen, start=1)]

    async def _skills(self, plan: _Plan, sources: list[Source]) -> tuple[Skill, ...]:
        system, user = prompts.map_skills(plan.topic, plan.grade, listing(sources))
        mapped = await self._model.ask("skills", system, user, temperature=0.2, max_tokens=500)
        skills: list[Skill] = []
        raw_skills = mapped.get("skills")
        for raw in raw_skills if isinstance(raw_skills, list) else []:
            label = _words(raw.get("label") if isinstance(raw, dict) else raw, 60)
            if not label:
                continue
            slug = _slug(raw.get("slug") if isinstance(raw, dict) and raw.get("slug") else label)
            if slug not in {s.slug for s in skills}:
                skills.append(Skill(slug, label))
        return tuple(skills[:6]) or (Skill(_slug(plan.topic), plan.topic[:60]),)

    async def _write(
        self,
        request: GenerationRequest,
        plan: _Plan,
        skills: tuple[Skill, ...],
        sources: list[Source],
        count: int,
    ) -> AsyncIterator[list[Item]]:
        written: list[Item] = []
        batch = _budget(self._kind)[0]
        rounds = math.ceil(count / batch) + 1  # one round of top-up at most
        for _ in range(rounds):
            if len(written) >= count:
                return
            drafted = await self._draft(
                request, plan, skills, sources, min(batch, count - len(written)), written
            )
            kept = (await self._verified(plan, request, skills, sources, drafted))[
                : count - len(written)
            ]
            if kept:
                written.extend(kept)
                yield kept

    async def _draft(
        self,
        request: GenerationRequest,
        plan: _Plan,
        skills: tuple[Skill, ...],
        sources: list[Source],
        want: int,
        written: list[Item],
    ) -> list[Item]:
        system, user = prompts.draft(
            rules=self._kind.writing_rules(),
            noun_plural=self._kind.item_noun_plural,
            count=want,
            topic=plan.topic,
            grade=plan.grade,
            language=request.language,
            skills=_skill_lines(skills),
            listing=listing(sources),
            avoid=[self._kind.summary(i) for i in written],
        )
        tokens = _budget(self._kind)[1]
        reply = await self._model.ask("draft", system, user, temperature=0.7, max_tokens=tokens)
        return self._clean(reply.get("items"), skills, sources, written)

    async def _verified(
        self,
        plan: _Plan,
        request: GenerationRequest,
        skills: tuple[Skill, ...],
        sources: list[Source],
        items: list[Item],
    ) -> list[Item]:
        if not items:
            return []
        failed = await self._problems(plan, sources, items)
        passed = [i for i in items if i["id"] not in failed]
        if not failed:
            return passed
        repaired = await self._repair(
            request, plan, skills, sources, [i for i in items if i["id"] in failed], failed
        )
        still = await self._problems(plan, sources, repaired) if repaired else {}
        return passed + [i for i in repaired if i["id"] not in still]

    async def _problems(
        self, plan: _Plan, sources: list[Source], items: list[Item]
    ) -> dict[str, str]:
        system, user = prompts.verify(
            topic=plan.topic,
            grade=plan.grade,
            listing=listing(sources),
            items_json=json.dumps(items, ensure_ascii=False),
        )
        verdict = await self._model.ask("verify", system, user, temperature=0.0, max_tokens=1500)
        results = verdict.get("results")
        if not isinstance(results, list):
            return {}  # an unreadable check keeps the items; they are still valid
        return {
            str(r.get("id")): str(r.get("problem") or "did not pass the check")
            for r in results
            if isinstance(r, dict) and r.get("ok") is False
        }

    async def _repair(
        self,
        request: GenerationRequest,
        plan: _Plan,
        skills: tuple[Skill, ...],
        sources: list[Source],
        items: list[Item],
        problems: dict[str, str],
    ) -> list[Item]:
        described = "\n".join(
            f"{json.dumps(i, ensure_ascii=False)}\nProblem: {problems.get(i['id'], '')}"
            for i in items
        )
        system, user = prompts.repair(
            rules=self._kind.writing_rules(),
            grade=plan.grade,
            language=request.language,
            listing=listing(sources),
            problems=described,
        )
        tokens = _budget(self._kind)[1]
        reply = await self._model.ask("repair", system, user, temperature=0.4, max_tokens=tokens)
        return self._clean(reply.get("items"), skills, sources, [])

    async def rewrite(
        self,
        *,
        item: Item,
        skills: tuple[Skill, ...],
        sources: tuple[Source, ...],
        grade_level: str | None,
        language: str,
        instruction: str,
    ) -> Item | None:
        """One replacement item, on a teacher's word — "make it easier"."""
        system, user = prompts.rewrite_one(
            rules=self._kind.writing_rules(),
            grade=grade_for(grade_level),
            language=language,
            listing=listing(list(sources)),
            skills=_skill_lines(skills),
            item_json=json.dumps(item, ensure_ascii=False),
            instruction=instruction.strip(),
        )
        tokens = _budget(self._kind)[2]
        reply = await self._model.ask("rewrite", system, user, temperature=0.7, max_tokens=tokens)
        raw = reply.get("item")
        if not isinstance(raw, dict):
            return None
        return self._kind.normalise(raw, skills=skills, source_ids={s.id for s in sources})

    async def add(
        self,
        *,
        topic: str,
        existing: list[Item],
        skills: tuple[Skill, ...],
        sources: tuple[Source, ...],
        grade_level: str | None,
        language: str,
        instruction: str,
    ) -> Item | None:
        """One more item on a teacher's word — "a section about evaporation".
        A kind with pictures gets its picture too."""
        system, user = prompts.add_one(
            rules=self._kind.writing_rules(),
            noun=self._kind.item_noun,
            grade=grade_for(grade_level),
            language=language,
            listing=listing(list(sources)),
            skills=_skill_lines(skills),
            existing=[self._kind.summary(i) for i in existing],
            instruction=instruction.strip(),
        )
        tokens = _budget(self._kind)[2]
        reply = await self._model.ask("add", system, user, temperature=0.7, max_tokens=tokens)
        raw = reply.get("item")
        item = (
            self._kind.normalise(raw, skills=skills, source_ids={s.id for s in sources})
            if isinstance(raw, dict)
            else None
        )
        if item is not None and isinstance(self._kind, Enriching):
            [item] = await self._kind.illustrate([item], topic=topic, pictures=self._researcher)
        return item

    # --- helpers -------------------------------------------------------------

    def _clean(
        self, raw: Any, skills: tuple[Skill, ...], sources: list[Source], written: list[Item]
    ) -> list[Item]:
        if not isinstance(raw, list):
            return []
        known = {s.id for s in sources}
        seen = {self._kind.summary(i).lower() for i in written}
        kept: list[Item] = []
        for entry in raw:
            item = (
                self._kind.normalise(entry, skills=skills, source_ids=known)
                if isinstance(entry, dict)
                else None
            )
            if item is None or self._kind.summary(item).lower() in seen:
                continue
            seen.add(self._kind.summary(item).lower())
            kept.append(item)
        return kept

    def _result(
        self,
        request: GenerationRequest,
        plan: _Plan,
        items: list[Item],
        skills: tuple[Skill, ...],
        sources: list[Source],
        count: int,
        started: float,
        extras: dict[str, Any] | None = None,
    ) -> GenerationResult:
        return GenerationResult(
            title=plan.title,
            topic=plan.topic,
            items=tuple(items),
            skills=skills,
            sources=tuple(sources),
            grounded=bool(sources),
            requested=count,
            model=self._model.name,
            prompt_tokens=self._meter.prompt_tokens,
            completion_tokens=self._meter.completion_tokens,
            build_ms=int((time.monotonic() - started) * 1000),
            extras=extras or {},
        )


def _found(sources: list[Source]) -> str:
    if not sources:
        return "No sources found — writing from general knowledge"
    hosts = list(dict.fromkeys(s.host for s in sources))
    return f"{len(sources)} sources · " + ", ".join(hosts[:3])


def _renumber(source: Source, n: int) -> Source:
    return Source(
        id=f"s{n}",
        title=source.title,
        url=source.url,
        host=source.host,
        excerpt=source.excerpt,
        published=source.published,
    )


def _skill_lines(skills: tuple[Skill, ...]) -> str:
    return "\n".join(f"- {s.slug}: {s.label}" for s in skills)


def _short(value: Any, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    return text[:limit] if text else None


def _words(value: Any, limit: int) -> str | None:
    """Like `_short`, but cut between words: "…for life on Ear" is worse
    than a label a word shorter."""
    text = _short(value, 10_000)
    if text is None or len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut or text[:limit]


def _slug(value: Any) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-")
    return text[:48] or "general"
