"""My materials: a teacher's own files, kept and made from."""

from __future__ import annotations

from typing import Any

import pytest

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.learning.research import Source
from app.services.material_service import MaterialService, title_from
from tests.test_learning_generator import SourcesFound, Stage, generator, happy, run

NOTES = (
    "Photosynthesis happens in the leaf. Chlorophyll in the chloroplasts traps light "
    "energy, and the plant turns water and carbon dioxide into glucose and oxygen. "
) * 20


def _settings(**changes: Any):
    return get_settings().model_copy(update=changes)


def test_a_file_s_name_becomes_a_tidy_title() -> None:
    assert title_from("Chapter_3 - Photosynthesis.pdf") == "Chapter 3 - Photosynthesis"
    assert title_from("notes") == "notes"
    assert title_from("food-chains-notes.txt") == "food chains notes"


async def test_a_file_is_read_once_and_kept(session, teacher) -> None:
    service = MaterialService(session, _settings())
    material = await service.upload(
        teacher.id, filename="leaf_notes.txt", data=NOTES.encode(), media_type="text/plain"
    )
    assert material.title == "leaf notes"
    assert "Chlorophyll" in material.text
    [listed] = await service.list(teacher.id, q="chloroplast")
    assert listed.id == material.id
    assert await service.list(teacher.id, q="volcano") == []
    renamed = await service.rename(teacher.id, material.id, "  Year 5   leaf notes ")
    assert renamed.title == "Year 5 leaf notes"


async def test_empty_huge_and_one_too_many_are_refused(session, teacher) -> None:
    small = MaterialService(session, _settings(material_max_bytes=100, materials_per_owner=1))
    with pytest.raises(ValidationError, match="empty"):
        await small.upload(teacher.id, filename="a.txt", data=b"", media_type="text/plain")
    with pytest.raises(ValidationError, match="limit"):
        await small.upload(teacher.id, filename="a.txt", data=b"x" * 101, media_type="text/plain")
    await small.upload(teacher.id, filename="a.txt", data=b"Leaves.", media_type="text/plain")
    with pytest.raises(ConflictError):
        await small.upload(teacher.id, filename="b.txt", data=b"Roots.", media_type="text/plain")


async def test_nobody_else_can_use_your_files(session, teacher, account) -> None:
    service = MaterialService(session, _settings())
    mine = await service.upload(
        teacher.id, filename="notes.txt", data=b"Leaves make food.", media_type="text/plain"
    )
    other = await account("teacher")
    with pytest.raises(NotFoundError):
        await service.owned(other.id, mine.id)
    with pytest.raises(NotFoundError):
        await service.several(other.id, [mine.id])


async def test_the_chosen_files_become_the_first_sources(session, teacher) -> None:
    service = MaterialService(session, _settings(material_token_budget=1600))
    long = await service.upload(
        teacher.id, filename="chapter.txt", data=NOTES.encode(), media_type="text/plain"
    )
    short = await service.upload(
        teacher.id, filename="summary.txt", data=b"Plants need light.", media_type="text/plain"
    )
    sources = await service.sources_for(teacher.id, [short.id, long.id], topic="photosynthesis")
    assert [s.id for s in sources] == ["M1", "M2"]
    assert [s.title for s in sources] == ["summary", "chapter"]
    assert {s.host for s in sources} == {"your materials"}
    assert sources[0].excerpt == "Plants need light."


# --- making from them ---------------------------------------------------------------

MATERIAL = Source(id="M1", title="leaf notes", url="", host="your materials", excerpt=NOTES)


async def test_only_your_files_when_the_web_is_off() -> None:
    gen, model, search = generator(happy())
    updates = await run(gen, count=5, sources=(MATERIAL,), sources_note="Reading your materials")
    [found] = [u for u in updates if isinstance(u, SourcesFound)]
    assert [s.id for s in found.sources] == ["M1"]
    assert search.queries == []
    labels = {u.label for u in updates if isinstance(u, Stage) and u.key == "research"}
    assert labels == {"Reading your materials"}


async def test_your_files_first_then_the_web_fills_gaps() -> None:
    gen, _, search = generator(happy())
    updates = await run(
        gen, count=5, sources=(MATERIAL,), web_too=True, sources_note="Reading your materials"
    )
    [found] = [u for u in updates if isinstance(u, SourcesFound)]
    assert found.sources[0].id == "M1"
    assert len(found.sources) > 1
    assert search.queries
    labels = {u.label for u in updates if isinstance(u, Stage) and u.key == "research"}
    assert labels == {"Reading your materials and trusted sources"}


# --- over HTTP ----------------------------------------------------------------------


async def test_the_library_over_http(client, teacher, student, account) -> None:
    async with client(teacher) as c:
        made = await c.post(
            "/api/materials", files={"file": ("notes.txt", NOTES.encode(), "text/plain")}
        )
        assert made.status_code == 201
        body = made.json()
        assert body["title"] == "notes" and body["kind"] == "text"
        listed = (await c.get("/api/materials")).json()
        assert [m["id"] for m in listed["items"]] == [body["id"]]
        assert (await c.delete(f"/api/materials/{body['id']}")).status_code == 204
    async with client(student) as c:
        assert (await c.get("/api/materials")).status_code == 403
    other = await account("teacher")
    async with client(other) as c:
        assert (await c.delete(f"/api/materials/{body['id']}")).status_code == 404


async def test_a_set_cannot_be_made_from_someone_else_s_file(client, teacher, account) -> None:
    async with client(teacher) as c:
        made = await c.post(
            "/api/materials", files={"file": ("notes.txt", NOTES.encode(), "text/plain")}
        )
    other = await account("teacher")
    async with client(other) as c:
        refused = await c.post(
            "/api/learning-sets/generate",
            json={"kind": "quiz", "topic": "Photosynthesis", "material_ids": [made.json()["id"]]},
        )
    assert refused.status_code == 404


# --- photos -------------------------------------------------------------------------


class _Eyes:
    """A vision model that sees a leaf, and remembers what it was asked."""

    info = None

    def __init__(self) -> None:
        self.prompts: list[str] = []

    async def read(self, data: bytes, *, media_type: str, prompt: str = "") -> str:
        self.prompts.append(prompt)
        return (
            "LEAF\nWhat it shows: A green leaf with its veins, stalk and tip labelled. It is wet."
        )


def _photo() -> bytes:
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (64, 48), "green").save(buffer, format="JPEG")
    return buffer.getvalue()


async def test_a_photo_is_read_for_its_words_and_what_it_shows(session, teacher) -> None:
    from app.vision.base import LESSON_PROMPT

    eyes = _Eyes()
    service = MaterialService(session, _settings(), eyes)
    material = await service.upload(
        teacher.id, filename="IMG_2031.jpg", data=_photo(), media_type="image/jpeg"
    )
    assert eyes.prompts == [LESSON_PROMPT]
    assert material.unit == "image"
    assert "What it shows:" in material.text
    assert material.title == "A green leaf with its veins, stalk and tip labelled"
    assert (material.thumbnail or "").startswith("data:image/jpeg;base64,")
    named = await service.upload(
        teacher.id, filename="Leaf diagram.png", data=_photo(), media_type="image/png"
    )
    assert named.title == "Leaf diagram"
    from app.services.material_service import photo_title

    long = "What it shows: A tall tree with many branches and a nest of birds in it."
    assert photo_title("IMG_9.jpg", long) == "A tall tree with many branches and a nest…"


async def test_a_photo_needs_a_vision_model(session, teacher) -> None:
    with pytest.raises(ValidationError, match="vision model"):
        await MaterialService(session, _settings()).upload(
            teacher.id, filename="IMG_1.jpg", data=_photo(), media_type="image/jpeg"
        )


async def test_a_photo_lists_as_a_photo(client, session, teacher) -> None:
    await MaterialService(session, _settings(), _Eyes()).upload(
        teacher.id, filename="IMG_7.jpg", data=_photo(), media_type="image/jpeg"
    )
    async with client(teacher) as c:
        [listed] = (await c.get("/api/materials")).json()["items"]
    assert listed["kind"] == "image" and listed["thumbnail"].startswith("data:image/jpeg")
