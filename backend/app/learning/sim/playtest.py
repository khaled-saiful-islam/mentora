"""Playing a simulation game before anybody sees it (§24.4).

The studio's playtest (`artifacts/playtest.py`) opens a game once, at one
size, presses some keys and reports what the console said — and its games
ship whatever it finds. This one is stricter, because the players are
children on phones:

- **Two sizes:** a phone held upright, by touch, and a laptop, by mouse and
  keys. A game that is wider than the phone, or draws nothing there, fails.
- **The game as it ships:** served exactly as a student gets it — the content
  policy, the setup, the runtime (`runtime.served`) — with every request
  refused.
- **Mission 1, reached:** the game's own `Mentora.demo` is run on the laptop,
  and the runtime must report the first mission done within the time. A game
  whose first mission cannot be reached is not a game.

It reuses the shared browser the studio started (`artifacts/raster.py`); the
browser's own sandbox stays on, and every game gets a context of its own,
thrown away afterwards.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import re
from dataclasses import dataclass
from typing import Any

from app.artifacts.raster import LOAD_TIMEOUT_MS, RasterUnavailable, _ensure_browser, shutdown
from app.learning.sim.runtime import Setup, first_in_head, served

logger = logging.getLogger(__name__)

_REFUSED = re.compile(r"net::ERR|Failed to load resource", re.IGNORECASE)
_POLICY = re.compile(r"Content Security Policy", re.IGNORECASE)

PHONE = ("phone", 390, 700)
LAPTOP = ("laptop", 1280, 760)
SETTLE_MS = 1500
AFTER_INPUT_MS = 600
# The demo has eight seconds, as the game was told; a little more to report.
DEMO_S = 10.0
# One size, end to end. A game that wedges its thread blocks every probe.
BUDGET_S = 35.0
PROBE_S = 5.0
CLOSE_S = 5.0
# More than this many pixels wider than the screen is a game that scrolls
# sideways — the one layout fault a child cannot work around.
TOO_WIDE_PX = 2


class NoBrowser(RuntimeError):
    """Nowhere to play it. A game that cannot be played is not shipped."""


@dataclass(frozen=True, slots=True)
class SizeResult:
    """What happened at one size."""

    size: str
    errors: tuple[str, ...] = ()
    froze: bool = False
    painted: bool = True
    loops: bool = True
    on_screen: bool = True
    too_wide: int = 0
    ready: bool = True
    network: tuple[str, ...] = ()
    # Only tested on the laptop: None where it was not asked.
    reached: bool | None = None
    demo: str = ""
    words: str = ""

    def complaints(self) -> list[str]:
        at = f"On a {self.size}"
        if self.froze:
            return [
                f"{at}, the game locked up the browser and had to be killed: every frame "
                "must return quickly and ask for the next one."
            ]
        found = [f"{at}, the game threw an error: {e}" for e in self.errors[:3]]
        if not self.painted:
            found.append(f"{at}, the game drew nothing on screen.")
        if not self.on_screen:
            found.append(f"{at}, the game's page measures zero by zero: it must fill the frame.")
        if not self.loops:
            found.append(f"{at}, the game drew once and stopped: it needs an animation loop.")
        if self.too_wide > TOO_WIDE_PX:
            found.append(
                f"{at}, the game is {self.too_wide}px wider than the screen, so it scrolls "
                "sideways: lay it out in percentages, controls below the scene."
            )
        if not self.ready:
            found.append(f"{at}, the game never called `Mentora.ready()`.")
        if self.network:
            found.append(f"{at}, the game tried to load {self.network[0]}: nothing from outside.")
        if self.reached is False:
            found.append(
                f"{at}, running `Mentora.demo()` did not reach the first mission "
                f"({self.demo or 'no Mentora.done for it within 8 seconds'}). The demo must "
                "operate the player's controls so the mission's check is met and the game "
                "calls `Mentora.done(id)`."
            )
        return found


@dataclass(frozen=True, slots=True)
class SimTest:
    sizes: tuple[SizeResult, ...]

    @property
    def ok(self) -> bool:
        return not self.complaints()

    def complaints(self) -> list[str]:
        return [c for size in self.sizes for c in size.complaints()]

    @property
    def words(self) -> str:
        return " ".join(size.words for size in self.sizes)

    def as_report(self) -> dict[str, Any]:
        return {
            size.size: {
                "errors": list(size.errors),
                "froze": size.froze,
                "too_wide": size.too_wide,
                "reached": size.reached,
                "complaints": size.complaints(),
            }
            for size in self.sizes
        }


class BrowserTester:
    """Plays a game in the shared browser, at both sizes."""

    async def test(self, html: str, setup: Setup) -> SimTest:
        try:
            browser = await _ensure_browser()
        except RasterUnavailable as exc:
            raise NoBrowser(str(exc)) from exc
        results = []
        for size, width, height in (PHONE, LAPTOP):
            results.append(await _one(browser, html, setup, size, width, height))
        return SimTest(sizes=tuple(results))


async def _one(
    browser: Any, html: str, setup: Setup, size: str, width: int, height: int
) -> SizeResult:
    # Touch, but not a mobile browser: in the app a game runs in a frame,
    # which is laid out at its own width — never the 980px a mobile browser
    # assumes for a page without a viewport tag.
    context = await browser.new_context(
        viewport={"width": width, "height": height}, has_touch=size == PHONE[0]
    )
    try:
        return await asyncio.wait_for(_run(context, html, setup, size, width, height), BUDGET_S)
    except TimeoutError:
        logger.info("sim playtest on a %s passed its budget; a freeze", size)
        return SizeResult(size=size, froze=True, painted=False, loops=False)
    except Exception as exc:  # noqa: BLE001 - a page that will not open is a finding
        if "Timeout" in str(exc):
            return SizeResult(size=size, froze=True, painted=False, loops=False)
        logger.info("sim playtest could not run on a %s: %s", size, exc)
        return SizeResult(size=size, errors=(f"The game would not open: {exc}"[:300],))
    finally:
        await _discard(context)


async def _run(
    context: Any, html: str, setup: Setup, size: str, width: int, height: int
) -> SizeResult:
    page = await context.new_page()
    errors: list[str] = []
    blocked: list[str] = []
    page.on("pageerror", lambda exc: errors.append(str(exc)[:300]))

    def console(message: Any) -> None:
        # The content policy stops a request before the network sees it; its
        # complaint is the game reaching out — reported once, as that.
        if _POLICY.search(message.text):
            blocked.append(message.text[:160])
        elif message.type == "error" and not _REFUSED.search(message.text):
            errors.append(message.text[:300])

    page.on("console", console)

    async def refuse(route: Any) -> None:
        url = route.request.url
        if not url.startswith(("data:", "about:", "blob:")):
            blocked.append(url[:120])
        await route.abort()

    await page.route("**/*", refuse)
    await page.set_content(
        _counting(served(html, setup)), wait_until="load", timeout=LOAD_TIMEOUT_MS
    )
    await page.wait_for_timeout(SETTLE_MS)
    first = await asyncio.wait_for(page.evaluate(_PROBE), PROBE_S)
    await _prod(page, size, width, height)
    second = await asyncio.wait_for(page.evaluate(_PROBE), PROBE_S)
    reached, demo = (None, "")
    if size == LAPTOP[0] and setup.missions:
        reached, demo = await _demo(page, str(setup.missions[0]["id"]))
    words = await asyncio.wait_for(page.evaluate(_WORDS), PROBE_S)
    return SizeResult(
        size=size,
        errors=tuple(dict.fromkeys(errors))[:5],
        painted=bool(first["painted"] or second["painted"]),
        loops=second["frames"] > first["frames"],
        on_screen=bool(second["onScreen"]),
        too_wide=int(max(first["wide"], second["wide"])),
        ready=bool(second["ready"]),
        network=tuple(dict.fromkeys(blocked))[:3],
        reached=reached,
        demo=demo,
        words=str(words)[:6000],
    )


async def _prod(page: Any, size: str, width: int, height: int) -> None:
    """Touch it, or press things — to find the handler that throws."""
    with contextlib.suppress(Exception):
        if size == PHONE[0]:
            await page.touchscreen.tap(width // 2, height // 2)
            await page.touchscreen.tap(width // 2, int(height * 0.8))
        else:
            for key in ("Tab", "ArrowRight", "ArrowRight", "Enter", "Space"):
                await page.keyboard.press(key, delay=20)
            await page.mouse.click(width // 2, height // 2)
    await page.wait_for_timeout(AFTER_INPUT_MS)


async def _demo(page: Any, first_id: str) -> tuple[bool, str]:
    """Run the game's own demo of mission 1; did the runtime hear it reached?"""
    started = await asyncio.wait_for(page.evaluate(_START_DEMO), PROBE_S)
    if started != "ran":
        return False, started
    waited = 0.0
    while waited < DEMO_S:
        if await asyncio.wait_for(page.evaluate(_REACHED, first_id), PROBE_S):
            return True, ""
        await asyncio.sleep(0.5)
        waited += 0.5
    return False, "the demo ran, and the first mission was never reported done"


async def _discard(context: Any) -> None:
    try:
        await asyncio.wait_for(context.close(), CLOSE_S)
    except Exception:  # noqa: BLE001 - tidying up must never raise
        logger.info("a wedged game would not close; restarting the browser")
        with contextlib.suppress(Exception):
            await shutdown()


# Counts the game's own calls for another frame — prepended, so it is in place
# before any script of the game's runs.
_COUNTER = (
    "<script>(function(){window.__frames=0;"
    "var raf=window.requestAnimationFrame.bind(window);"
    "window.requestAnimationFrame=function(cb){window.__frames++;return raf(cb);};"
    "})();</script>"
)


def _counting(html: str) -> str:
    """The counter first in the head — never before the doctype, which would
    put the page in quirks mode and test a different layout."""
    return first_in_head(html, _COUNTER)


_PROBE = """() => {
  const canvases = [...document.querySelectorAll('canvas')];
  // Words, buttons and boxes on screen count, as well as a canvas's pixels.
  let painted = [...document.body.querySelectorAll('*')].some((el) => {
    if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT') return false;
    const b = el.getBoundingClientRect();
    return b.width > 8 && b.height > 8 && b.bottom > 0 && b.top < innerHeight;
  });
  for (const c of canvases) {
    try {
      const ctx = c.getContext('2d');
      if (!ctx || !c.width || !c.height) { painted = painted || !ctx; continue; }
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) { painted = true; break; }
    } catch (e) { painted = true; }
    if (painted) break;
  }
  const root = document.documentElement.getBoundingClientRect();
  return {
    painted,
    frames: window.__frames || 0,
    onScreen: root.width > 1 && root.height > 1,
    wide: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    ready: (window.__mentora || []).some((m) => m.type === 'ready'),
  };
}"""

_START_DEMO = """() => {
  if (!window.Mentora || typeof window.Mentora.demo !== 'function') {
    return 'there is no Mentora.demo function';
  }
  try { window.Mentora.demo(); return 'ran'; } catch (e) { return 'Mentora.demo threw: ' + e; }
}"""

_REACHED = """(id) => (window.__mentora || []).some((m) => m.type === 'done' && m.id === id)"""

_WORDS = """() => (document.body ? document.body.innerText : '').slice(0, 6000)"""
