"""Only pictures that belong: every picture a search finds is looked at before
a child sees it.

A picture search answers with whatever ranks for the words, and a page's
title can match while its picture does not: an advert, a slide full of text,
a cartoon of the wrong thing. So each candidate is scored for how well it
shows *this part's idea* for *this lesson*. Only a clear, child-safe fit is
kept, the best first. None fits, none is shown. A picture that does not match
the lesson is worse than no picture.

Two checks, both behind `PictureCheck`:
- `VisionPictureCheck` asks a vision model to look at the picture itself —
  the real check, used whenever `PICTURE_CHECK_MODEL` is set.
- `WordsPictureCheck` keeps a picture only when its title or source shares a
  real word with what was asked for. Weaker, free, and never lets an
  unrelated title through.

`JudgedPictures` wraps any picture source with a check, and is itself a
picture source, so a study guide and a live lesson get it without changing.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.learning.research import Picture

logger = logging.getLogger(__name__)

# Out of 10: "clearly shows this idea". Below it, the picture is left out.
KEEP_AT = 7
# Candidates looked at per picture wanted, beyond the ones asked for.
EXTRA_CANDIDATES = 2
# Vision calls in flight at once, per lesson or set.
CONCURRENCY = 6

_STOP = frozenset(
    {
        "a", "an", "and", "the", "of", "for", "to", "in", "on", "at", "by", "with", "from",
        "is", "are", "be", "as", "or", "how", "what", "why", "diagram", "picture", "photo",
        "image", "illustration", "kids", "children", "simple", "chart",
    }
)  # fmt: skip


@dataclass(frozen=True, slots=True)
class Verdict:
    # 0-10: how well the picture shows the idea, for this lesson.
    helps: int
    safe: bool
    # What the picture shows, in a few words — for the log, and the curious.
    shows: str = ""

    @property
    def keep(self) -> bool:
        return self.safe and self.helps >= KEEP_AT


class PictureCheck(Protocol):
    async def verdict(
        self, picture: Picture, *, want: str, topic: str, grade: str | None
    ) -> Verdict | None:
        """How well `picture` shows `want`. None when it could not be told —
        which counts as "no"."""
        ...


class Pictures(Protocol):
    async def pictures(self, query: str, *, limit: int) -> list[Picture]: ...


class JudgedPictures:
    """A picture source whose every picture passed the check, best first."""

    def __init__(
        self,
        source: Pictures,
        check: PictureCheck,
        *,
        topic: str,
        grade: str | None,
    ) -> None:
        self._source = source
        self._check = check
        self._topic = topic
        self._grade = grade
        self._gate = asyncio.Semaphore(CONCURRENCY)

    @property
    def available(self) -> bool:
        return bool(getattr(self._source, "available", True))

    async def pictures(self, query: str, *, limit: int) -> list[Picture]:
        found = await self._source.pictures(query, limit=limit + EXTRA_CANDIDATES)
        if not found:
            return []
        verdicts = await asyncio.gather(*(self._judge(p, query) for p in found))
        kept = [
            (v.helps, i, p)
            for i, (p, v) in enumerate(zip(found, verdicts, strict=True))
            if v and v.keep
        ]
        kept.sort(key=lambda row: (-row[0], row[1]))
        logger.info("pictures for %r: kept %d of %d", query[:60], len(kept), len(found))
        return [p for _, _, p in kept][:limit]

    async def _judge(self, picture: Picture, want: str) -> Verdict | None:
        async with self._gate:
            try:
                return await self._check.verdict(
                    picture, want=want, topic=self._topic, grade=self._grade
                )
            except Exception:  # noqa: BLE001 — a picture nobody could check is left out
                logger.warning("picture check failed for %s", picture.page, exc_info=True)
                return None


class WordsPictureCheck:
    """Kept only when the picture's title or source names what was asked for."""

    async def verdict(
        self, picture: Picture, *, want: str, topic: str, grade: str | None
    ) -> Verdict | None:
        # What this part asked for, beyond the lesson's own words: a page
        # about the topic is not yet a picture of this idea.
        wanted = (_words(want) - _words(topic)) or _words(topic)
        said = _words(f"{picture.title} {picture.source}")
        shared = wanted & said
        enough = bool(shared) and len(shared) >= max(1, len(wanted) // 2)
        return Verdict(helps=KEEP_AT if enough else 0, safe=True, shows=picture.title)


class VisionPictureCheck:
    """A vision model looks at the picture itself — the small copy search keeps,
    which every model can fetch."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._transport = transport

    async def verdict(
        self, picture: Picture, *, want: str, topic: str, grade: str | None
    ) -> Verdict | None:
        payload = {
            "model": self._model,
            "temperature": 0.0,
            "max_tokens": 160,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": picture.thumbnail}},
                        {"type": "text", "text": _ask(want, topic, grade)},
                    ],
                }
            ],
        }
        async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
            response = await client.post(
                self._url, json=payload, headers={"Authorization": f"Bearer {self._api_key}"}
            )
        if response.status_code != 200:
            logger.info("picture check %s: %s", response.status_code, response.text[:200])
            return None
        content = response.json()["choices"][0]["message"]["content"] or ""
        return verdict_from(content)


def _ask(want: str, topic: str, grade: str | None) -> str:
    who = f"children in {grade}" if grade else "school children"
    return (
        f"You are checking a picture for a lesson for {who}.\n"
        f"The lesson is about: {topic}\n"
        f"This part needs a picture of: {want}\n\n"
        "Look at the picture. Reply with JSON only:\n"
        '{"shows": "what the picture shows, in under 12 words", '
        '"helps": 0-10, "safe": true or false}\n'
        "helps: 10 = a clear picture or diagram of exactly this idea; 7 = clearly "
        "about it and useful; 3 = loosely related; 0 = unrelated. Score low for an "
        "advert, a product, a meme, a watermark across it, a page that is mostly "
        "text, or the wrong thing.\n"
        "safe: false for anything a young child should not see."
    )


def verdict_from(text: str) -> Verdict | None:
    """The model's reply as a verdict. None when it is not one."""
    cleaned = re.sub(r"<\|[^|>]*\|>", "", text)
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        return None
    try:
        raw: Any = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(raw, dict):
        return None
    helps = raw.get("helps")
    if isinstance(helps, bool) or not isinstance(helps, int | float):
        return None
    return Verdict(
        helps=max(0, min(10, int(helps))),
        safe=raw.get("safe") is True,
        shows=str(raw.get("shows") or "")[:120],
    )


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", text.lower()) if w not in _STOP}
