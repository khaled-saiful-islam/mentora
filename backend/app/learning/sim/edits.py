"""Fixing or changing a game by its lines, not by rewriting it whole (§24).

A game is fifty kilobytes of code; asking for all of it back to change three
lines takes minutes and invites a model to abbreviate the rest ("… unchanged
…"), which is a broken game. So a fix or a change comes back as edits:

    <<<<<<< SEARCH
    exact lines from the game
    =======
    what replaces them
    >>>>>>> REPLACE

Each edit must match the game exactly once. If any does not, none are applied
and the caller asks for the whole document instead — a slower, older way that
always works.
"""

from __future__ import annotations

import re

_EDIT = re.compile(
    r"<{5,9} ?SEARCH[^\n]*\n(?P<search>.*?)\n?={5,9}[^\n]*\n(?P<replace>.*?)\n?>{5,9} ?REPLACE",
    re.DOTALL,
)
_START = re.compile(r"<!doctype html", re.IGNORECASE)
_END = re.compile(r"</html\s*>", re.IGNORECASE)

FORMAT = """Reply with edits only — no other words — each in exactly this form:

<<<<<<< SEARCH
lines copied exactly from the game, enough of them to be found only once
=======
the lines that replace them
>>>>>>> REPLACE

As many edits as the fix needs, in the order they appear in the game. Copy
the SEARCH lines character for character, with their indentation."""


def parse(text: str) -> list[tuple[str, str]]:
    return [(m.group("search"), m.group("replace")) for m in _EDIT.finditer(text)]


def apply(html: str, edits: list[tuple[str, str]]) -> str | None:
    """`html` with every edit made, or None if there were none or any of them
    does not match exactly once — a half-applied fix is a new bug."""
    if not edits:
        return None
    result = html
    for search, replace in edits:
        if not search.strip() or result.count(search) != 1:
            return None
        result = result.replace(search, replace, 1)
    return result


def document_of(text: str) -> str:
    """The HTML document in a reply: from its doctype to its last `</html>`,
    leaving out anything a model said around it."""
    start = _START.search(text)
    body = text[start.start() :] if start else text
    ends = list(_END.finditer(body))
    return body[: ends[-1].end()] if ends else body


def is_whole(html: str) -> bool:
    """Starts with a doctype and ends with `</html>`: not cut off part-way."""
    stripped = html.strip()
    return bool(_START.match(stripped)) and bool(_END.search(stripped[-20:]))
