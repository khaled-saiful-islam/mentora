"""The robot that plays a game before anybody sees it (§24.4), in a real
browser: a phone by touch and a laptop by keys, the game served exactly as a
student gets it, and its own demo of mission 1 run to the end."""

from __future__ import annotations

import pytest

from app.learning.sim.playtest import BrowserTester
from app.learning.sim.runtime import Setup, numbered

MISSIONS = numbered([{"id": "m1", "goal": "Grow it."}, {"id": "m2", "goal": "Again."}])

# A whole, tiny game: fills any screen, draws, loops, reaches mission 1 by
# moving its own slider, and talks only through the runtime.
GOOD = """<!DOCTYPE html><html><head><style>
html, body { margin: 0; height: 100%; }
main { display: flex; flex-direction: column; height: 100%; }
canvas { flex: 1; width: 100%; }
input { width: 90%; min-height: 48px; }
</style></head><body><main>
<h1 id="goal"></h1><canvas id="c"></canvas><input id="sun" type="range" min="0" max="100" value="0">
</main><script>
const mission = Mentora.missions[0];
document.getElementById('goal').textContent = 'Mission ' + mission.number + ': ' + mission.goal;
const sun = document.getElementById('sun');
let height = 0;
function frame() {
  const c = document.getElementById('c');
  c.width = c.clientWidth; c.height = c.clientHeight;
  const g = c.getContext('2d');
  g.fillStyle = '#2e7d32'; g.fillRect(0, c.height - height, 40, height);
  height += Number(sun.value) / 20;
  if (height > 100) Mentora.done(mission.id);
  requestAnimationFrame(frame);
}
Mentora.demo = function () { sun.value = 100; sun.dispatchEvent(new Event('input')); };
requestAnimationFrame(function () { Mentora.ready(); frame(); });
</script></body></html>"""


@pytest.fixture(autouse=True)
async def _no_browser_left_behind():
    yield
    from app.artifacts.raster import shutdown

    await shutdown()


async def _tester() -> BrowserTester:
    pytest.importorskip("playwright")
    from app.artifacts.raster import RasterUnavailable, _ensure_browser

    try:
        await _ensure_browser()
    except RasterUnavailable:
        pytest.skip("no browser in this environment")
    return BrowserTester()


async def test_a_game_that_plays_has_nothing_to_complain_of() -> None:
    tested = await (await _tester()).test(GOOD, Setup(missions=MISSIONS))
    assert tested.complaints() == []
    phone, laptop = tested.sizes
    assert (phone.size, laptop.size) == ("phone", "laptop")
    assert laptop.reached is True and phone.reached is None
    assert "Mission 1: Grow it." in tested.words


async def test_a_game_wider_than_a_phone_is_sent_back() -> None:
    wide = GOOD.replace("main { display", "main { width: 900px; display")
    tested = await (await _tester()).test(wide, Setup(missions=MISSIONS))
    assert any("wider than the screen" in c for c in tested.complaints())


async def test_a_demo_that_never_reaches_mission_one_is_sent_back() -> None:
    stuck = GOOD.replace("sun.value = 100;", "sun.value = 0;")
    tested = await (await _tester()).test(stuck, Setup(missions=MISSIONS))
    assert any("did not reach the first mission" in c for c in tested.complaints())


async def test_an_error_or_a_missing_ready_is_sent_back() -> None:
    broken = GOOD.replace("Mentora.ready(); frame();", "frame(); undefinedThing();")
    complaints = (await (await _tester()).test(broken, Setup(missions=MISSIONS))).complaints()
    assert any("undefinedThing" in c for c in complaints)
    assert any("Mentora.ready()" in c for c in complaints)


async def test_nothing_reaches_the_network_from_inside_a_game() -> None:
    phoning = GOOD.replace("<h1 id=", '<img src="https://example.com/a.png"><h1 id=')
    complaints = (await (await _tester()).test(phoning, Setup(missions=MISSIONS))).complaints()
    assert any("tried to load" in c for c in complaints) or any(
        "example.com" in c for c in complaints
    )
