"""How a game is served (§24.4): the content policy, the viewer's setup and the
runtime first in its head, before any of the game's own code."""

from __future__ import annotations

import json
import re

from app.learning.sim.runtime import (
    HEADER_POLICY,
    META_POLICY,
    RUNTIME,
    Setup,
    numbered,
    served,
)

GAME = (
    "<!DOCTYPE html><html><head><title>Game</title></head>"
    "<body><script>GAME()</script></body></html>"
)
MISSIONS = [{"id": "m1", "goal": "Grow it."}, {"id": "m2", "goal": "Keep it alive."}]


def setup(**overrides) -> Setup:
    return Setup(missions=numbered(MISSIONS), buddy="Momo", **overrides)


def test_the_policy_setup_and_runtime_come_before_the_games_own_code() -> None:
    html = served(GAME, setup())
    head = html.index("<head>") + len("<head>")
    assert html[head:].startswith(META_POLICY)
    assert html.index("window.MENTORA_SETUP") < html.index("window.Mentora = M")
    assert html.index("window.Mentora = M") < html.index("GAME()")


def test_the_setup_carries_this_viewers_missions_and_buddy() -> None:
    html = served(GAME, setup(level="advanced", calm=True))
    told = json.loads(re.search(r"window\.MENTORA_SETUP=(\{.*?\});</script>", html).group(1))
    assert told["missions"] == [
        {"id": "m1", "goal": "Grow it.", "number": 1},
        {"id": "m2", "goal": "Keep it alive.", "number": 2},
    ]
    assert told["buddy"] == "Momo"
    assert told["level"] == "advanced" and told["calm"] is True


def test_a_replay_of_the_missed_keeps_each_missions_number_in_the_whole_game() -> None:
    assert numbered(MISSIONS, {"m2"}) == [{"id": "m2", "goal": "Keep it alive.", "number": 2}]


def test_words_in_the_setup_cannot_end_the_script_they_sit_in() -> None:
    sly = [{"id": "m1", "goal": "</script><script>alert(1)</script>"}]
    html = served(GAME, Setup(missions=numbered(sly)))
    assert "</script><script>alert(1)" not in html
    assert "\\u003c/script>" in html


def test_a_game_without_a_head_is_given_one_and_a_header_is_not_mistaken_for_it() -> None:
    bare = "<!DOCTYPE html><html><body><header>Hi</header><script>GAME()</script></body></html>"
    html = served(bare, setup())
    assert html.index("<head>" + META_POLICY) < html.index("<header>")


def test_the_policy_allows_scripts_and_nothing_from_outside() -> None:
    assert HEADER_POLICY.startswith("sandbox allow-scripts;")
    assert "allow-same-origin" not in HEADER_POLICY
    for rule in ("default-src 'none'", "connect-src 'none'", "form-action 'none'"):
        assert rule in HEADER_POLICY and rule in META_POLICY
    assert "https:" not in HEADER_POLICY


def test_the_runtime_talks_only_to_its_frame_and_only_about_known_missions() -> None:
    assert "event.source !== host" in RUNTIME
    assert "data.source !== 'mentora-host'" in RUNTIME
    assert "if (!known(id) || reached[id]) return;" in RUNTIME
