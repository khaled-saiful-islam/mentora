"""Whole sentences out of a stream of tokens.

The tutor starts speaking an answer before the model has finished writing it:
each sentence is screened and recorded the moment it is complete. This cuts
the stream at sentence ends — and only at real ones, so "3.5" and "Mr. Tan"
stay whole.
"""

from __future__ import annotations

import re

_END = re.compile(r"[.!?…][\"')\]]*\s+")
_NOT_AN_END = re.compile(r"(?:\b(?:Mr|Mrs|Ms|Dr|St|No|vs|e\.g|i\.e)\.|\d\.)$")
# A first sentence this short ("Okay.") is held and said with the next one,
# so the voice does not start on a clipped fragment.
MIN_WORDS = 4


class SentenceStream:
    def __init__(self) -> None:
        self._buffer = ""

    def feed(self, text: str) -> list[str]:
        self._buffer += text
        out: list[str] = []
        start = 0
        for match in _END.finditer(self._buffer):
            candidate = self._buffer[start : match.end()].strip()
            head = self._buffer[start : match.start() + 1]
            if _NOT_AN_END.search(head.rstrip()):
                continue
            if len(candidate.split()) < MIN_WORDS:
                continue
            out.append(candidate)
            start = match.end()
        self._buffer = self._buffer[start:]
        return out

    def flush(self) -> list[str]:
        rest = self._buffer.strip()
        self._buffer = ""
        return [rest] if rest else []
