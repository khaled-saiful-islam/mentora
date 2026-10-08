"""Making a simulation game, and changing one (§24).

    design → write → check → play at two sizes → screen its words
                       ↑__________ fix, at most twice _________|

Nothing here ships a game that failed. The studio's builder shows a broken
game with a note; a child cannot read a note, so a game that still fails
after its fixes fails the build, and the maker is asked to try again.

Every model call is counted — the design, the write, each fix — and the total
lands on the game's document, where the maker's daily quota finds it.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any, Protocol

from app.artifacts.base import ArtifactUnavailable
from app.artifacts.model import Written, parse_object, strip_fence
from app.learning.model import GenerationUnavailable
from app.learning.sim import checks, edits, prompts
from app.learning.sim.playtest import NoBrowser, SimTest
from app.learning.sim.runtime import Setup, numbered
from app.learning.sim.spec import SimSpec
from app.moderation.base import Decision
from app.moderation.rules import InputRules, OutputRules

logger = logging.getLogger(__name__)

# Two goes at a fix: the first catches what broke, the second what the first
# fix broke. Each is a whole document, so a third is rarely worth its cost.
FIXES = 2
# A game is one document of code and drawing; this is generous for one.
MAX_BYTES = 600_000
# The buddy the robot plays with. Any name: the game must use whichever.
TEST_BUDDY = "Kiko"
HELD = frozenset({Decision.BLOCK, Decision.SUPPORT})


class Writer(Protocol):
    """The model that writes games (`artifacts/model.ArtifactModel`)."""

    @property
    def name(self) -> str: ...

    def write(
        self, system: str, user: str, into: Written, *, temperature: float | None = None
    ) -> AsyncIterator[str]: ...


class Tester(Protocol):
    async def test(self, html: str, setup: Setup) -> SimTest: ...


@dataclass(frozen=True, slots=True)
class Progress:
    """A step, for the person watching: what is happening and how far along."""

    label: str
    detail: str = ""


@dataclass(frozen=True, slots=True)
class SimBuilt:
    html: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    build_ms: int
    # The design, every round of testing, and how many fixes it took.
    report: dict[str, Any] = field(default_factory=dict)


@dataclass
class _Tally:
    """Tokens across every call of one build. Mutable, filled as it goes."""

    prompt: int = 0
    completion: int = 0

    def add(self, written: Written) -> None:
        self.prompt += written.usage.prompt_tokens
        self.completion += written.usage.completion_tokens


class SimBuilder:
    def __init__(self, model: Writer, tester: Tester, *, max_bytes: int = MAX_BYTES) -> None:
        self._model = model
        self._tester = tester
        self._max_bytes = max_bytes

    async def build(self, spec: SimSpec) -> AsyncIterator[Progress | SimBuilt]:
        started, tally = perf_counter(), _Tally()
        yield Progress("Designing the simulation", "its controls, its rules, each mission")
        decided = await self._design(spec, tally)
        yield Progress("Designed it", str(decided.get("name") or spec.title)[:90])
        system, user = prompts.write(spec, decided)
        written = Written()
        async for update in self._stream(system, user, written, "Coding the game", 0.4):
            yield update
        tally.add(written)
        report: dict[str, Any] = {"design": decided, "fixed_by": []}
        game = edits.document_of(strip_fence(written.text))
        async for update in self._settle(game, spec, tally, report):
            yield update
        yield self._built(report, tally, started)

    async def change(
        self, html: str, instruction: str, spec: SimSpec
    ) -> AsyncIterator[Progress | SimBuilt]:
        """One change, asked for in words — as edits to the game, or the whole
        game when they will not apply — then tested as a new one is. A change
        that breaks the game is not kept."""
        started, tally = perf_counter(), _Tally()
        yield Progress("Making the change", instruction[:90])
        report: dict[str, Any] = {"instruction": instruction, "fixed_by": []}
        changed = await self._revised(
            html, prompts.change(html, instruction), prompts.change(html, instruction, whole=True),
            tally, report,
        )  # fmt: skip
        if changed == html:
            raise GenerationUnavailable("That change couldn't be made.")
        async for update in self._settle(changed, spec, tally, report):
            yield update
        yield self._built(report, tally, started)

    # --- the parts ------------------------------------------------------------

    async def _design(self, spec: SimSpec, tally: _Tally) -> dict[str, Any]:
        system, user = prompts.design(spec)
        for attempt in range(2):
            written = Written()
            await self._drain(system, user, written, 0.7)
            tally.add(written)
            decided = parse_object(written.text)
            if decided.get("controls") and decided.get("missions") and decided.get("rules"):
                return decided
            logger.info("thin simulation design on attempt %d", attempt + 1)
        raise GenerationUnavailable("We couldn't work out a game for this topic. Try again.")

    async def _settle(
        self, html: str, spec: SimSpec, tally: _Tally, report: dict[str, Any]
    ) -> AsyncIterator[Progress]:
        """Check, play and screen it; fix what that found; fail if it still
        fails. Leaves the game that passed in `report["html"]`."""
        rounds: list[Any] = []
        report["tests"] = rounds
        for attempt in range(FIXES + 1):
            yield Progress(
                "Testing it on a phone and a laptop" if attempt == 0 else "Testing it again"
            )
            problems, tested = await self._problems(html, spec)
            rounds.append({"problems": problems, "sizes": tested.as_report() if tested else {}})
            if not problems:
                report["html"], report["fixes"] = html, attempt
                yield Progress("It plays", "it runs, fits a phone, and mission 1 can be done")
                return
            if attempt == FIXES:
                logger.info("game for %r failed its tests: %s", spec.topic, problems[:3])
                raise GenerationUnavailable(
                    "This game didn't pass its tests, so it wasn't kept. Try again — "
                    "every build is different."
                )
            yield Progress("Fixing what it found", problems[0][:90])
            html = await self._fix(html, problems, tally, report)

    async def _problems(self, html: str, spec: SimSpec) -> tuple[list[str], SimTest | None]:
        found = checks.complaints(html, max_bytes=self._max_bytes)
        if found:
            # Fixed before spending a browser on it: these break it anyway.
            return found, None
        setup = Setup(
            missions=numbered(spec.missions),
            buddy=TEST_BUDDY,
            level=spec.level,
            language=spec.language,
        )
        try:
            tested = await self._tester.test(html, setup)
        except NoBrowser as exc:
            raise GenerationUnavailable(
                "Games can't be tested here, so none can be made. Please tell your admin."
            ) from exc
        return [*tested.complaints(), *_unsuitable(checks.words_of(html), tested.words)], tested

    async def _fix(self, html: str, problems: list[str], tally: _Tally, report: dict) -> str:
        return await self._revised(
            html, prompts.fix(html, problems), prompts.fix(html, problems, whole=True),
            tally, report,
        )  # fmt: skip

    async def _revised(
        self,
        html: str,
        as_edits: tuple[str, str],
        as_whole: tuple[str, str],
        tally: _Tally,
        report: dict[str, Any],
    ) -> str:
        """The game revised: by edits when they apply exactly — seconds, and
        nothing else touched — else rewritten whole. A rewrite that comes back
        cut off is not kept: the game stays as it was, to be tried again."""
        written = Written()
        await self._drain(*as_edits, written, 0.1)
        tally.add(written)
        patched = edits.apply(html, edits.parse(written.text))
        if patched is not None:
            report["fixed_by"].append("edits")
            return patched
        whole = Written()
        await self._drain(*as_whole, whole, 0.1)
        tally.add(whole)
        rewritten = edits.document_of(strip_fence(whole.text))
        if edits.is_whole(rewritten):
            report["fixed_by"].append("whole")
            return rewritten
        report["fixed_by"].append("kept")
        logger.info("a rewrite came back cut off; keeping the game as it was")
        return html

    async def _drain(self, system: str, user: str, into: Written, temperature: float) -> None:
        try:
            async for _ in self._model.write(system, user, into, temperature=temperature):
                pass
        except ArtifactUnavailable as exc:
            raise GenerationUnavailable("The game writer isn't answering. Try again soon.") from exc

    async def _stream(
        self, system: str, user: str, into: Written, label: str, temperature: float
    ) -> AsyncIterator[Progress]:
        """One long call, narrated — a minute of silence reads as a hang."""
        size, said = 0, perf_counter()
        yield Progress(label)
        try:
            async for piece in self._model.write(system, user, into, temperature=temperature):
                size += len(piece)
                if perf_counter() - said >= 1.0:
                    said = perf_counter()
                    yield Progress(label, f"{size // 1000} KB written")
        except ArtifactUnavailable as exc:
            raise GenerationUnavailable("The game writer isn't answering. Try again soon.") from exc

    def _built(self, report: dict[str, Any], tally: _Tally, started: float) -> SimBuilt:
        html = str(report.pop("html"))
        return SimBuilt(
            html=html,
            model=self._model.name,
            prompt_tokens=tally.prompt,
            completion_tokens=tally.completion,
            build_ms=int((perf_counter() - started) * 1000),
            report=report,
        )


def _unsuitable(*texts: str) -> list[str]:
    """The game's words through the same rules as a student's chat: anything
    they would hold back goes back to be rewritten."""
    found: list[str] = []
    text = " ".join(texts)[:20000]
    for screen in (InputRules(), OutputRules()):
        screening = screen.screen(text)
        if screening.decision in HELD:
            found.append(
                "Some words in the game are not right for children "
                f"({screening.category.value}: {screening.evidence or 'see the rules'}). "
                "Rewrite them so the game is friendly and kind."
            )
    return found
