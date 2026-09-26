"""The pure parts of a live lesson: its steps, reminders, clip lengths, and
the room that carries it to everyone."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.live.mp3 import duration
from app.live.timeline import already_told, due_reminders, lobby_open, reveal_line, steps_of
from app.services.live_room import Member, Room

# One MPEG-1 Layer III frame header: 128 kbps, 48 kHz, mono. 384 bytes, 24 ms.
FRAME = bytes.fromhex("FFFB94C4") + bytes(380)


def mp3(frames: int, *, id3: bool = True) -> bytes:
    tag = b"ID3\x04\x00\x00\x00\x00\x00\x0a" + bytes(10) if id3 else b""
    return tag + FRAME * frames


SEGMENTS = [
    {
        "id": "a",
        "beats": [
            {
                "id": "s0b1",
                "say": "Hello. Where does rain come from?",
                "pause": "think",
                "sentences": ["Hello.", "Where does rain come from?"],
                "show": "Rain",
            },
            {"id": "s0b2", "say": "From clouds.", "pause": "breath", "sentences": ["From clouds."]},
        ],
        "checkin": {
            "question": "Rain comes from?",
            "options": ["Clouds", "Rocks"],
            "answer": 0,
            "explanation": "Clouds hold water.",
        },
    },
    {
        "id": "b",
        "beats": [{"id": "s1b1", "say": "Goodbye.", "pause": "breath", "sentences": ["Goodbye."]}],
        "checkin": None,
    },
]


def test_a_lesson_is_laid_out_sentence_by_sentence_with_its_checks() -> None:
    steps = steps_of(SEGMENTS)
    assert [(s.kind, s.text) for s in steps] == [
        ("say", "Hello."),
        ("say", "Where does rain come from?"),
        ("say", "From clouds."),
        ("check", ""),
        ("say", "Goodbye."),
    ]
    assert [s.index for s in steps] == [0, 1, 2, 3, 4]
    # The quiet after each: a gap between sentences, the beat's own pause at its end.
    assert steps[0].pause == pytest.approx(0.45)
    assert steps[1].pause == pytest.approx(1.8)
    assert steps[2].part_end and steps[3].part_end and not steps[0].part_end
    assert steps[0].show == "Rain"
    assert steps[4].segment == 1


def test_the_reveal_says_the_right_answer_and_why() -> None:
    assert reveal_line(SEGMENTS[0]["checkin"]) == "The answer is: Clouds. Clouds hold water."


def test_each_reminder_is_due_once_in_its_window_and_never_late() -> None:
    at = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)
    assert due_reminders(at, at - timedelta(hours=20), []) == ["day"]
    assert due_reminders(at, at - timedelta(hours=20), ["day"]) == []
    assert due_reminders(at, at - timedelta(minutes=10), ["day"]) == ["soon"]
    assert due_reminders(at, at + timedelta(minutes=2), ["day", "soon"]) == ["now"]
    # An hour before, "tomorrow" is noise, and "soon" is not yet due.
    assert due_reminders(at, at - timedelta(hours=1), []) == []
    assert due_reminders(at, at + timedelta(minutes=30), []) == []


def test_a_lesson_scheduled_inside_the_day_skips_the_day_note() -> None:
    at = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)
    assert already_told(at, at - timedelta(hours=3)) == ["day"]
    assert already_told(at, at - timedelta(days=3)) == []


def test_the_room_opens_ten_minutes_before() -> None:
    at = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)
    assert not lobby_open(at, at - timedelta(minutes=11))
    assert lobby_open(at, at - timedelta(minutes=9))


def test_a_clip_is_as_long_as_its_frames_say() -> None:
    assert duration(mp3(125)) == pytest.approx(3.0)
    assert duration(mp3(50, id3=False)) == pytest.approx(1.2)
    # Garbage is estimated, never an error.
    assert duration(b"not audio at all") >= 0


async def test_the_room_replays_what_a_reconnecting_browser_missed() -> None:
    room = Room(uuid4())
    kid = Member(uuid4(), "Aina", "kiko", "student")
    room.members[kid.id] = kid
    first = room.publish({"type": "clip", "text": "One.", "lane": "lesson"})
    room.publish({"type": "clip", "text": "Two.", "lane": "lesson"})

    stream = room.follow(Member(kid.id, "Aina", "kiko", "student"), since=first["seq"])
    got = await asyncio.wait_for(stream.__anext__(), 1)
    assert got["type"] == "clip" and got["text"] == "Two."
    await stream.aclose()


async def test_a_fresh_browser_gets_a_snapshot_and_the_roster_shows_who_is_here() -> None:
    room = Room(uuid4())
    aina = Member(uuid4(), "Aina", "kiko", "student")
    mei = Member(uuid4(), "Mei", None, "student")
    room.members.update({aina.id: aina, mei.id: mei})
    room.publish({"type": "clip", "text": "One.", "lane": "lesson", "segment": 0, "show": "Rain"})

    stream = room.follow(aina, since=None)
    snapshot = await asyncio.wait_for(stream.__anext__(), 1)
    assert snapshot["type"] == "snapshot"
    assert snapshot["state"]["show"] == "Rain"
    assert {r["name"]: r["here"] for r in snapshot["roster"]} == {"Aina": True, "Mei": False}
    assert room.here() == [aina.id]
    await stream.aclose()
    assert room.here() == []
