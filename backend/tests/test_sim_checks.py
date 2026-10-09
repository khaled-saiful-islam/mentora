"""What is refused before a game is run (§24.4) — every one sent back to fix."""

from __future__ import annotations

import pytest

from app.learning.sim.checks import complaints, words_of

GOOD = (
    "<!DOCTYPE html><html><head><style>body{margin:0}</style></head><body>"
    "<h1>Grow the plant</h1><canvas></canvas><script>"
    "const missions = Mentora.missions;"
    "Mentora.demo = function () { setSun(80); };"
    "function frame() { requestAnimationFrame(frame); }"
    "requestAnimationFrame(function () { Mentora.ready(); frame(); });"
    "function reached(id) { Mentora.done(id); }"
    "</script></body></html>"
)


def broken(extra_script: str = "", extra_html: str = "") -> str:
    return GOOD.replace("</script>", f"{extra_script}</script>{extra_html}")


def test_a_game_that_keeps_the_rules_has_nothing_to_fix() -> None:
    assert complaints(GOOD, max_bytes=600_000) == []


@pytest.mark.parametrize(
    "script",
    [
        "fetch('/api/me');",
        "new XMLHttpRequest();",
        "new WebSocket('wss://x');",
        "import('x.js');",
        "eval('1');",
        "new Function('return 1');",
        "while (true) {}",
        "for (;;) {}",
        "localStorage.setItem('a', 1);",
        "document.cookie;",
        "alert('hi');",
        "window.parent.postMessage('x', '*');",
    ],
)
def test_what_breaks_out_or_breaks_down_is_refused(script: str) -> None:
    assert complaints(broken(script), max_bytes=600_000)


@pytest.mark.parametrize(
    "html",
    [
        '<script src="https://cdn.example.com/x.js"></script>',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2">',
        '<img src="https://example.com/a.png">',
    ],
)
def test_anything_from_the_web_is_refused(html: str) -> None:
    found = complaints(broken(extra_html=html), max_bytes=600_000)
    assert any("self-contained" in c for c in found)


def test_a_game_must_use_the_runtime_however_it_spells_it() -> None:
    assert complaints(GOOD.replace("Mentora", "Other"), max_bytes=600_000)
    spelled_otherwise = GOOD.replace("Mentora.missions", "window['Mentora'].missions")
    assert complaints(spelled_otherwise, max_bytes=600_000) == []


@pytest.mark.parametrize(
    "line",
    [
        'if (m.control === "Knife") return knifeBtn;',
        "if ('Share' == mission.control) share();",
        "switch (current().goal) { case 'x': break; }",
        "if (m.control.toLowerCase().includes('sun')) sun();",
    ],
)
def test_a_game_that_tells_missions_apart_by_their_words_is_sent_back(line: str) -> None:
    found = complaints(broken(f"\n{line}\n"), max_bytes=600_000)
    assert any(f"tells missions apart by their words (`{line}`)" in c for c in found)


def test_missions_told_apart_by_id_are_fine() -> None:
    line = 'if (m.id === "p1") sun(); label.textContent = m.control; if (m.number === 2) {}'
    assert complaints(broken(line), max_bytes=600_000) == []


def test_not_a_document_or_too_big_is_said_plainly() -> None:
    assert any("DOCTYPE" in c for c in complaints("<html></html>", max_bytes=600_000))
    assert any("larger" in c for c in complaints(GOOD, max_bytes=100))


def test_the_words_a_game_could_show_are_found_for_the_safety_screen() -> None:
    html = broken("const tip = 'Give the plant more sunlight';")
    words = words_of(html)
    assert "Grow the plant" in words
    assert "Give the plant more sunlight" in words
    assert "margin" not in words
