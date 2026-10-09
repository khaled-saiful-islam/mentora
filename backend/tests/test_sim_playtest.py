"""The robot that plays a game before anybody sees it (§24.4), in a real
browser: a phone by touch and a laptop by keys, the game served exactly as a
student gets it, and its own demo of mission 1 run to the end."""

from __future__ import annotations

import pytest

from app.learning.sim.playtest import BrowserTester
from app.learning.sim.runtime import Setup, numbered

MISSIONS = numbered([{"id": "m1", "goal": "Grow it."}, {"id": "m2", "goal": "Again."}])

# A whole, tiny game: fills any screen, draws, loops, plays its missions in
# turn — each reached by moving its own slider, as its Show me does — and
# talks only through the runtime.
GOOD = """<!DOCTYPE html><html><head><style>
html, body { margin: 0; height: 100%; }
main { display: flex; flex-direction: column; height: 100%; }
canvas { flex: 1; width: 100%; }
input { width: 90%; min-height: 48px; }
</style></head><body><main>
<h1 id="goal"></h1><canvas id="c"></canvas><input id="sun" type="range" min="0" max="100" value="0">
</main><script>
let at = 0;
let height = 0;
const sun = document.getElementById('sun');
function show() {
  const mission = Mentora.missions[at];
  document.getElementById('goal').textContent = mission
    ? 'Mission ' + mission.number + ': ' + mission.goal : 'All done!';
}
function frame() {
  const c = document.getElementById('c');
  c.width = c.clientWidth; c.height = c.clientHeight;
  const g = c.getContext('2d');
  g.fillStyle = '#2e7d32'; g.fillRect(0, c.height - height, 40, height);
  height += Number(sun.value) / 20;
  const mission = Mentora.missions[at];
  if (mission && height > 100) {
    Mentora.done(mission.id);
    at += 1; height = 0; sun.value = 0; show();
  }
  requestAnimationFrame(frame);
}
Mentora.demo = function (id) { sun.value = 100; sun.dispatchEvent(new Event('input')); };
show();
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


async def test_a_show_me_that_never_reaches_a_mission_is_sent_back() -> None:
    stuck = GOOD.replace("sun.value = 100;", "sun.value = 0;")
    tested = await (await _tester()).test(stuck, Setup(missions=MISSIONS))
    assert any("mission 1 (id m1) was never reported done" in c for c in tested.complaints())
    assert any("over 3 presses the game did nothing" in c for c in tested.complaints())


async def test_show_me_is_played_for_every_mission_not_just_the_first() -> None:
    first_only = GOOD.replace(
        "sun.value = 100;", "if (id === Mentora.missions[0].id) sun.value = 100;"
    )
    tested = await (await _tester()).test(first_only, Setup(missions=MISSIONS))
    assert any("mission 2 (id m2) was never reported done" in c for c in tested.complaints())


async def test_an_error_or_a_missing_ready_is_sent_back() -> None:
    broken = GOOD.replace("Mentora.ready(); frame();", "frame(); undefinedThing();")
    complaints = (await (await _tester()).test(broken, Setup(missions=MISSIONS))).complaints()
    assert any("undefinedThing" in c for c in complaints)
    assert any("Mentora.ready()" in c for c in complaints)


async def test_an_error_names_the_line_it_came_from() -> None:
    # A syntax error names no function: its line is all the writer has to go on.
    typo = GOOD.replace("let height = 0;", "let height = ;")
    complaints = (await (await _tester()).test(typo, Setup(missions=MISSIONS))).complaints()
    assert any("on the line `let height = ;`" in c for c in complaints)


async def test_nothing_reaches_the_network_from_inside_a_game() -> None:
    phoning = GOOD.replace("<h1 id=", '<img src="https://example.com/a.png"><h1 id=')
    complaints = (await (await _tester()).test(phoning, Setup(missions=MISSIONS))).complaints()
    assert any("tried to load" in c for c in complaints) or any(
        "example.com" in c for c in complaints
    )
