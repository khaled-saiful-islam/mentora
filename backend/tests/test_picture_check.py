"""Pictures are looked at before a child sees them; only a clear fit stays."""

from __future__ import annotations

import json

import httpx

from app.learning.picture_check import (
    JudgedPictures,
    Verdict,
    VisionPictureCheck,
    WordsPictureCheck,
    verdict_from,
)
from app.learning.research import Picture


def _picture(n: int, title: str) -> Picture:
    return Picture(
        image=f"https://example.org/{n}.png",
        thumbnail=f"https://example.org/t{n}.png",
        page=f"https://example.org/{n}",
        source="example.org",
        title=title,
    )


class Source:
    def __init__(self, found: list[Picture]) -> None:
        self.found, self.asked = found, []
        self.available = True

    async def pictures(self, query: str, *, limit: int) -> list[Picture]:
        self.asked.append((query, limit))
        return self.found[:limit]


class Scores:
    """A check that scores by picture number, and breaks on request."""

    def __init__(self, scores: dict[int, int], broken: frozenset[int] = frozenset()) -> None:
        self.scores, self.broken = scores, broken

    async def verdict(self, picture, *, want, topic, grade):
        n = int(picture.image.rsplit("/", 1)[1].split(".")[0])
        if n in self.broken:
            raise RuntimeError("the model is down")
        return Verdict(helps=self.scores.get(n, 0), safe=True)


def test_a_reply_is_read_through_the_model_s_wrapping() -> None:
    wrapped = '<|begin_of_box|>{"shows": "a food chain", "helps": 9, "safe": true}<|end_of_box|>'
    assert verdict_from(wrapped) == Verdict(helps=9, safe=True, shows="a food chain")
    assert verdict_from('{"helps": 42, "safe": true}').helps == 10
    assert verdict_from('{"helps": 9}').safe is False
    for nonsense in ("no idea", '{"helps": "high"}', "[1, 2]", '{"helps": true}'):
        assert verdict_from(nonsense) is None


def test_only_clear_safe_fits_are_kept() -> None:
    assert Verdict(helps=7, safe=True).keep
    assert not Verdict(helps=6, safe=True).keep
    assert not Verdict(helps=10, safe=False).keep


async def test_the_best_fits_come_first_and_the_rest_are_dropped() -> None:
    source = Source([_picture(n, "x") for n in range(5)])
    judged = JudgedPictures(
        source,
        Scores({0: 3, 1: 8, 2: 10, 3: 7, 4: 9}, broken=frozenset({4})),
        topic="t",
        grade=None,
    )
    kept = await judged.pictures("food chain", limit=2)
    assert [p.image for p in kept] == ["https://example.org/2.png", "https://example.org/1.png"]
    # Two more candidates are looked at than are wanted.
    assert source.asked == [("food chain", 4)]


async def test_nothing_fits_nothing_is_shown() -> None:
    judged = JudgedPictures(Source([_picture(0, "x")]), Scores({0: 2}), topic="t", grade=None)
    assert await judged.pictures("anything", limit=1) == []
    assert (
        await JudgedPictures(Source([]), Scores({}), topic="t", grade=None).pictures(
            "anything", limit=1
        )
        == []
    )


async def test_without_a_model_the_title_has_to_name_the_thing() -> None:
    check = WordsPictureCheck()
    leaf = await check.verdict(
        _picture(0, "A leaf, close up"), want="leaf close up Photosynthesis",
        topic="Photosynthesis", grade=None,
    )  # fmt: skip
    shoes = await check.verdict(
        _picture(1, "Photosynthesis sale — shoes"), want="leaf close up Photosynthesis",
        topic="Photosynthesis", grade=None,
    )  # fmt: skip
    assert leaf.keep and not shoes.keep


async def test_the_vision_check_looks_at_the_small_copy() -> None:
    seen: list[dict] = []

    def answer(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        reply = '{"shows": "a leaf", "helps": 8, "safe": true}'
        return httpx.Response(200, json={"choices": [{"message": {"content": reply}}]})

    check = VisionPictureCheck(
        base_url="https://models.test/v1", api_key="k", model="eyes",
        transport=httpx.MockTransport(answer),
    )  # fmt: skip
    verdict = await check.verdict(_picture(3, "leaf"), want="leaf", topic="Plants", grade="Year 4")
    assert verdict == Verdict(helps=8, safe=True, shows="a leaf")
    [body] = seen
    assert body["model"] == "eyes"
    image = body["messages"][0]["content"][0]["image_url"]["url"]
    assert image == "https://example.org/t3.png"
    assert "Year 4" in body["messages"][0]["content"][1]["text"]


async def test_a_vision_check_that_fails_says_nothing() -> None:
    check = VisionPictureCheck(
        base_url="https://models.test/v1", api_key="k", model="eyes",
        transport=httpx.MockTransport(lambda r: httpx.Response(400, text="no")),
    )  # fmt: skip
    assert await check.verdict(_picture(1, "x"), want="x", topic="t", grade=None) is None
