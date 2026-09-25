"""Finding what a learning set is grounded in.

SafeSearch at the source; then hosts a child should not be sent to are
dropped, educational hosts go first, pages are read for the paragraph that
answers, and every excerpt passes the prompt-injection guard before a model
sees it — a web page is information, never instructions.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from app.guards.base import ContentSource, Guard
from app.providers.base import ToolResult
from app.tools.page_reader import PageReader
from app.tools.serpapi import SearchProvider, SearchUnavailable

logger = logging.getLogger(__name__)

# Never taught from: adult, gambling, and places where anyone writes anything.
BLOCKED_HOSTS = frozenset(
    {
        "reddit.com", "quora.com", "4chan.org", "tiktok.com", "facebook.com",
        "instagram.com", "x.com", "twitter.com", "pinterest.com", "tumblr.com",
        "onlyfans.com", "pornhub.com", "xvideos.com", "xnxx.com", "bet365.com",
        "stake.com", "1xbet.com", "telegram.org", "discord.com",
    }
)  # fmt: skip
BLOCKED_WORDS = ("porn", "xxx", "casino", "gambl", "betting", "sex", "adult", "escort", "nsfw")
PREFERRED_HOSTS = (
    "britannica.com", "nationalgeographic.com", "bbc.co.uk", "khanacademy.org",
    "wikipedia.org", "ck12.org", "sciencekids.co.nz", "dkfindout.com", "kiddle.co",
    "nasa.gov", "who.int", "moe.gov.my", "dbp.gov.my",
)  # fmt: skip
PREFERRED_SUFFIXES = (".edu", ".gov", ".edu.my", ".gov.my", ".ac.uk", ".org.my")
EXCERPT_LIMIT = 1200


@dataclass(frozen=True, slots=True)
class Source:
    id: str
    title: str
    url: str
    host: str
    excerpt: str
    published: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "host": self.host,
            "excerpt": self.excerpt,
            "published": self.published,
        }

    def listing(self) -> str:
        return f"[{self.id}] {self.title} ({self.host})\n{self.excerpt[:900]}"


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").removeprefix("www.").lower()


def is_blocked(url: str) -> bool:
    host = host_of(url)
    if not host:
        return True
    if any(host == h or host.endswith(f".{h}") for h in BLOCKED_HOSTS):
        return True
    return any(word in host for word in BLOCKED_WORDS)


def is_preferred(url: str) -> bool:
    host = host_of(url)
    return host.endswith(PREFERRED_SUFFIXES) or any(
        host == h or host.endswith(f".{h}") for h in PREFERRED_HOSTS
    )


@dataclass(frozen=True, slots=True)
class Picture:
    """An image found for a set, and where it came from — a picture with no
    page is not one anybody can check, or credit."""

    image: str
    thumbnail: str
    page: str
    source: str
    title: str

    def as_dict(self) -> dict[str, str]:
        return {
            "image": self.image,
            "thumbnail": self.thumbnail,
            "page": self.page,
            "source": self.source,
            "title": self.title,
        }


def listing(sources: list[Source]) -> str:
    return "\n\n".join(source.listing() for source in sources) or "(no sources were found)"


class Researcher:
    def __init__(
        self,
        search: SearchProvider | None,
        reader: PageReader | None,
        guard: Guard | None,
        *,
        per_query: int = 6,
        read: int = 4,
        keep: int = 8,
    ) -> None:
        self._search = search
        self._reader = reader
        self._guard = guard
        self._per_query = per_query
        self._read = read
        self._keep = keep

    @property
    def available(self) -> bool:
        return self._search is not None

    async def gather(self, queries: list[str]) -> list[Source]:
        """Sources for these queries, best first. Empty — never an error —
        when search is down: a set can still be written, and says it is
        ungrounded."""
        if self._search is None or not queries:
            return []
        found = await asyncio.gather(*(self._one(q) for q in queries[:4]))
        merged = _merge([r for batch in found for r in batch])
        if self._reader is not None and merged:
            merged = await self._reader.enrich(merged, query=queries[0], limit=self._read)
        return [self._source(i, r) for i, r in enumerate(merged[: self._keep], start=1)]

    async def pictures(self, query: str, *, limit: int = 4) -> list[Picture]:
        """Pictures for a query, SafeSearch on, from hosts a child may be sent
        to. Empty — never an error — when search is down or finds nothing."""
        if self._search is None or not query.strip():
            return []
        try:
            found = await self._search.search_images(query, limit=limit + 4)
        except SearchUnavailable as exc:
            logger.info("picture search failed for %r: %s", query, exc)
            return []
        pictures: list[Picture] = []
        for result in found:
            image = result.image_url or result.thumbnail_url
            if not image.startswith("https://") or is_blocked(result.url):
                continue
            pictures.append(
                Picture(
                    image=image,
                    # Google's copy: small, but it is there when a site refuses
                    # to be shown on someone else's page.
                    thumbnail=_https_or(result.thumbnail_url, image),
                    page=result.url,
                    source=(result.snippet or host_of(result.url))[:120],
                    title=result.title[:200],
                )
            )
        return pictures[:limit]

    async def _one(self, query: str) -> list[ToolResult]:
        try:
            return await self._search.search(query, limit=self._per_query)  # type: ignore[union-attr]
        except SearchUnavailable as exc:
            logger.info("learning search failed for %r: %s", query, exc)
            return []

    def _source(self, n: int, result: ToolResult) -> Source:
        text = (result.excerpt or result.snippet or "")[:EXCERPT_LIMIT]
        if self._guard is not None and text:
            # Marked, not deleted: a useful page can carry one hostile line.
            text = self._guard.inspect(text, ContentSource.WEB_SEARCH).sanitized
        return Source(
            id=f"s{n}",
            title=result.title[:200],
            url=result.url,
            host=host_of(result.url),
            excerpt=text,
            published=result.published,
        )


def _https_or(url: str, fallback: str) -> str:
    return url if url.startswith("https://") else fallback


def _merge(results: list[ToolResult]) -> list[ToolResult]:
    seen: set[str] = set()
    kept: list[ToolResult] = []
    for result in results:
        if result.url in seen or is_blocked(result.url) or not (result.snippet or result.excerpt):
            continue
        seen.add(result.url)
        kept.append(result)
    # Educational hosts first; otherwise keep the search's own order.
    return sorted(kept, key=lambda r: (not is_preferred(r.url), r.rank))
