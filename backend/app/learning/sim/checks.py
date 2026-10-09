"""What can be refused without running a game (§24.4).

Unlike the studio's games, where these were notes nobody acted on, every one
of these goes back to the model to fix, and a game that still has one after
its fixes is not shipped. Each is a sentence the model can act on.
"""

from __future__ import annotations

import re

from app.learning.sim.edits import is_whole

_SCRIPT = re.compile(r"<script\b[^>]*>([\s\S]*?)</script>", re.IGNORECASE)

# Things a game must never do, and why, in the model's terms.
BANNED: tuple[tuple[str, str], ...] = (
    (r"\bfetch\s*\(", "calls `fetch`: there is no network; everything must be in the file"),
    (r"\bXMLHttpRequest\b", "uses `XMLHttpRequest`: there is no network"),
    (r"\bWebSocket\b", "opens a WebSocket: there is no network"),
    (r"\bimport\s*\(", "imports code at runtime: everything must be in the file"),
    (r"\beval\s*\(", "calls `eval`, which is blocked here"),
    (r"\bnew\s+Function\s*\(", "builds code with `new Function`, which is blocked here"),
    (r"while\s*\(\s*(?:true|1)\s*\)", "has a `while (true)` loop, which freezes the page"),
    (r"for\s*\(\s*;\s*;\s*\)", "has a `for (;;)` loop, which freezes the page"),
    (r"\b(?:local|session)Storage\b", "uses web storage, which throws here: keep state in memory"),
    (r"\bindexedDB\b", "uses indexedDB, which throws here: keep state in memory"),
    (r"\bdocument\.cookie\b", "reads cookies, which do not exist here"),
    (r"\b(?:alert|confirm|prompt)\s*\(", "calls alert/confirm/prompt, which are blocked here"),
    (r"\bpostMessage\s*\(", "calls postMessage: talk to the app only through `Mentora`"),
    (r"\bwindow\.parent\b|\bwindow\.top\b|\btop\.location\b", "reaches outside its frame"),
)
# A game must use the runtime at all. How well — playing the right missions by
# id, calling `ready`, a demo that reaches mission 1 — is what the playtest
# proves by running it, whatever way the code happens to spell it.
REQUIRED: tuple[tuple[str, str], ...] = (
    (r"\bMentora\b", "never uses the `Mentora` runtime, so it cannot report a mission"),
)
# A mission's words are what the child reads, and its maker may reword them: a
# game that decides what a mission does by comparing them (`m.control ===
# "Knife"`) does nothing at all once the words are not the design's.
_FIELDS = r"(?:control|goal|learn|guide|icon)"
LINE_SHOWN = 160
_WORDING = re.compile(
    rf"\.{_FIELDS}\s*[!=]==?\s*[\"'`]"
    rf"|[\"'`]\s*[!=]==?\s*[\w.\[\]()]+\.{_FIELDS}\b"
    rf"|switch\s*\(\s*[\w.\[\]()]+\.{_FIELDS}\s*\)"
    rf"|\.{_FIELDS}(?:\.toLowerCase\(\))?\.(?:includes|indexOf|startsWith|endsWith|match)\s*\("
)
_ELSEWHERE = (
    (r"<script[^>]+\bsrc\s*=", "loads a script from elsewhere"),
    (r"<link\b[^>]*\bhref\s*=\s*[\"']?(?:https?:)?//", "links to something on the web"),
    (r"@import\b", "imports a stylesheet"),
    (r"url\(\s*[\"']?(?:https?:)?//", "uses a picture or font from the web"),
    (r"<img\b[^>]+\bsrc\s*=\s*[\"']?(?:https?:)?//", "shows a picture from the web"),
)


def complaints(html: str, *, max_bytes: int) -> list[str]:
    """Everything wrong that reading the document can find, as fixes to make."""
    found: list[str] = []
    if not is_whole(html):
        found.append(
            "The game is not one whole HTML document: it must start with <!DOCTYPE html> "
            "and end with </html>, with nothing cut off."
        )
    if len(html.encode()) > max_bytes:
        found.append(f"The game is larger than {max_bytes // 1000} KB: make it smaller.")
    script = "\n".join(_SCRIPT.findall(html))
    if not script.strip():
        found.append("The game has no script, so there is no game.")
        return found
    found.extend(f"The game {why}." for pattern, why in BANNED if re.search(pattern, script))
    found.extend(f"The game {why}." for pattern, why in REQUIRED if not re.search(pattern, script))
    if wording := _WORDING.search(script):
        found.append(
            f"The game tells missions apart by their words (`{_line_of(script, wording)}`): "
            "a mission's words are what the child reads, and its maker may change them, "
            "so nothing happens. Set each mission up by its `id` (or its place in "
            "`Mentora.missions`) and never compare its words."
        )
    found.extend(
        f"The game {why}; it must be self-contained."
        for pattern, why in _ELSEWHERE
        if re.search(pattern, html, re.IGNORECASE)
    )
    return found


def _line_of(script: str, match: re.Match[str]) -> str:
    """The whole line a match is on, so the writer can find it."""
    start = script.rfind("\n", 0, match.start()) + 1
    end = script.find("\n", match.end())
    return script[start : end if end >= 0 else len(script)].strip()[:LINE_SHOWN]


_LITERAL = re.compile(r"""(["'`])((?:(?!\1)[^\\\n]|\\.){3,240})\1""")


def words_of(html: str) -> str:
    """The words a game could show, for the safety screen: its markup's text
    and its script's string literals that read like words."""
    scripts = _SCRIPT.findall(html)
    markup = re.sub(r"<[^>]+>", " ", _SCRIPT.sub(" ", re.sub(r"<style[\s\S]*?</style>", " ", html)))
    literals = [
        value
        for script in scripts
        for _, value in _LITERAL.findall(script)
        if re.search(r"[A-Za-z]{2,}\s+[A-Za-z]{2,}", value)
    ]
    return " ".join([*markup.split(), *literals])
