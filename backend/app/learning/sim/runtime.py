"""The `Mentora` object a game is given, and how a game is served (§24.4).

A game is model-written code, so it never talks to Mentora directly. Its
one way out is this runtime, put in front of its own script when it is
served: `Mentora.done(id)` when a mission is reached, `Mentora.tried(id)`
when a go at it fails, `Mentora.say(text)` for the buddy. Each becomes a
`postMessage` to the page around the game, which listens only to that frame
and only for these shapes (`frontend/src/features/game/bridge.ts`).

What a game is told about the player — the missions to play, the buddy's
name, the level, the language, calm motion, sound — is set per viewer when it
is served, so one stored document serves every student.

The content policy is sent twice: as a header on the response, which also
sandboxes it, and as a `<meta>` inside the document, which still holds if the
document is ever shown some other way.
"""

from __future__ import annotations

import json
import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

# No network of any kind, nothing from outside the document. `sandbox
# allow-scripts` without `allow-same-origin` gives it an opaque origin: no
# cookies, no storage, no way to reach this API or the page around it.
_POLICY = (
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
    "img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; "
    "form-action 'none'; base-uri 'none'"
)
HEADER_POLICY = f"sandbox allow-scripts; {_POLICY}; frame-ancestors 'self'"
META_POLICY = f'<meta http-equiv="Content-Security-Policy" content="{_POLICY}">'
# The frame's own attribute: scripts, and nothing else.
FRAME_SANDBOX = "allow-scripts"

# What the buddy may be given to say from inside a game, at most.
SAY_LIMIT = 140


@dataclass(frozen=True, slots=True)
class Setup:
    """What one viewer's copy of a game is told."""

    # The missions to play, in order: `{"id", "goal", "number"}`. A replay
    # of the missed ones is a shorter list, numbered as in the whole game.
    missions: Sequence[dict[str, Any]] = field(default_factory=tuple)
    buddy: str = "your buddy"
    level: str = "beginner"
    language: str = "en"
    calm: bool = False
    sound: bool = True

    def as_json(self) -> dict[str, Any]:
        return {
            "missions": [
                {"id": str(m["id"]), "goal": str(m.get("goal", "")), "number": int(m["number"])}
                for m in self.missions
            ],
            "buddy": self.buddy,
            "level": self.level,
            "language": self.language,
            "calm": self.calm,
            "sound": self.sound,
        }


def numbered(missions: Sequence[dict[str, Any]], only: set[str] | None = None) -> list[dict]:
    """The missions for a setup, numbered by their place in the whole game;
    just the ones in `only` when that is given (a replay of the missed)."""
    return [
        {"id": m["id"], "goal": m.get("goal", ""), "number": n}
        for n, m in enumerate(missions, start=1)
        if only is None or m["id"] in only
    ]


RUNTIME = """(function () {
  var setup = window.MENTORA_SETUP || { missions: [] };
  var host = window.parent;
  var tries = {}, reached = {}, listeners = { sound: [], calm: [] }, audio = null, ready = false;
  var log = (window.__mentora = []);
  function post(message) {
    message.source = 'mentora-game';
    log.push(message);
    try { host.postMessage(message, '*'); } catch (e) {}
  }
  function known(id) {
    for (var i = 0; i < M.missions.length; i++) if (M.missions[i].id === id) return true;
    return false;
  }
  function fire(name, value) {
    (listeners[name] || []).forEach(function (fn) { try { fn(value); } catch (e) {} });
  }
  function tone(at, freq, length, type, gain, slide) {
    var now = audio.currentTime + at, osc = audio.createOscillator(), amp = audio.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, now + length);
    amp.gain.setValueAtTime(gain || 0.1, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(amp); amp.connect(audio.destination);
    osc.start(now); osc.stop(now + length + 0.02);
  }
  var SOUNDS = {
    tap: [[0, 660, 0.06, 'triangle', 0.06]],
    good: [[0, 523, 0.12], [0.1, 659, 0.12], [0.2, 784, 0.22]],
    oops: [[0, 330, 0.28, 'sawtooth', 0.05, 180]],
    grow: [[0, 392, 0.35, 'sine', 0.07, 784]],
    win: [[0, 523, 0.14], [0.12, 659, 0.14], [0.24, 784, 0.14], [0.36, 1047, 0.4]]
  };
  var M = {
    missions: (setup.missions || []).slice(),
    buddy: setup.buddy || 'your buddy',
    level: setup.level || 'beginner',
    language: setup.language || 'en',
    calm: !!setup.calm,
    sound: setup.sound !== false,
    demo: null,
    ready: function () { if (!ready) { ready = true; post({ type: 'ready' }); } },
    tried: function (id) {
      if (!known(id) || reached[id]) return;
      tries[id] = (tries[id] || 0) + 1;
      post({ type: 'tried', id: id, tries: tries[id] });
    },
    done: function (id) {
      if (!known(id) || reached[id]) return;
      reached[id] = true;
      post({ type: 'done', id: id, tries: (tries[id] || 0) + 1 });
      if (Object.keys(reached).length === M.missions.length) post({ type: 'finished' });
    },
    say: function (text) {
      if (typeof text !== 'string' || !text.trim()) return;
      post({ type: 'say', text: text.trim().slice(0, %SAY%) });
    },
    play: function (name) {
      if (!M.sound || !SOUNDS[name]) return;
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        SOUNDS[name].forEach(function (t) { tone(t[0], t[1], t[2], t[3], t[4], t[5]); });
      } catch (e) {}
    },
    on: function (name, fn) {
      if (listeners[name] && typeof fn === 'function') listeners[name].push(fn);
    }
  };
  window.addEventListener('message', function (event) {
    if (event.source !== host) return;
    var data = event.data || {};
    if (data.source !== 'mentora-host') return;
    if (data.type === 'sound') { M.sound = !!data.on; fire('sound', M.sound); }
    if (data.type === 'calm') { M.calm = !!data.on; fire('calm', M.calm); }
  });
  window.Mentora = M;
})();""".replace("%SAY%", str(SAY_LIMIT))


def served(html: str, setup: Setup) -> str:
    """The game as it is sent to a browser: the content policy, the setup and
    the runtime first in its head, before any of its own code can run."""
    preamble = (
        META_POLICY
        + f"<script>window.MENTORA_SETUP={_script_json(setup.as_json())};</script>"
        + f"<script>{RUNTIME}</script>"
    )
    return first_in_head(html, preamble)


def _script_json(value: Any) -> str:
    """JSON that cannot end the script it sits in."""
    text = json.dumps(value, ensure_ascii=False)
    return text.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


_OPENING = (
    re.compile(r"<head(?:\s[^>]*)?>", re.IGNORECASE),
    re.compile(r"<html(?:\s[^>]*)?>", re.IGNORECASE),
)


def first_in_head(html: str, preamble: str) -> str:
    """`preamble` at the very start of the head — or of a head made for it."""
    head, root = _OPENING
    found = head.search(html)
    if found:
        return html[: found.end()] + preamble + html[found.end() :]
    found = root.search(html)
    if found:
        return html[: found.end()] + f"<head>{preamble}</head>" + html[found.end() :]
    return preamble + html
