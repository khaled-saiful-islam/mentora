"""A live lesson taught by the conductor, start to end, with a fake voice and
model: every sentence goes to the room in order and on time, a raised hand is
called on and answered, a quick check opens and closes, a question that must
stay out of the room does, and the quiz is handed to the group."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.db.models.classroom import ClassGroup, ClassMembership, Classroom, GroupMember
from app.db.models.live import LiveHand, LiveSegment, LiveSession, LiveTranscriptLine
from app.db.models.moderation import ModerationEvent
from app.events.registry import build_bus
from app.live.answering import Answerer
from app.live.audio import AudioCache, Narrator
from app.moderation.gate import ModerationGate
from app.providers.speech import Speech
from app.services.live_conductor import Conductor, Hand, Timing, Voice
from app.services.live_room import Member, Room
from tests.live_fakes import SETTINGS
from tests.test_chat_service import FakeProvider
from tests.test_live_timeline import mp3

FAST = Timing(ahead=0.0, lead=0.001, question_wait=0.4, check_open=0.3, after_answer=0.0)


class ShortVoice:
    """Every clip is two frames long: 48 ms."""

    def __init__(self) -> None:
        self.said: list[str] = []

    async def synthesize(self, text, *, voice, speed, model=None):
        self.said.append(text)
        return Speech(audio=mp3(2), mime="audio/mpeg")


BEATS = [
    {
        "id": "s0b1",
        "say": "Hello, everyone. Let's begin.",
        "show": "Welcome",
        "pause": "short",
        "sentences": ["Hello, everyone.", "Let's begin."],
    },
    {
        "id": "s0b2",
        "say": "Plants make food.",
        "show": None,
        "pause": "breath",
        "sentences": ["Plants make food."],
    },
]
CHECK = {
    "question": "Plants make?",
    "options": ["Food", "Rocks"],
    "answer": 0,
    "explanation": "From light.",
}


@pytest.fixture
async def lesson(session, teacher, account):
    kid = await account("student", "Aina Binti")
    room = Classroom(teacher_id=teacher.id, name="5 Bestari")
    session.add(room)
    await session.flush()
    group = ClassGroup(class_id=room.id, name="Stars")
    session.add(group)
    await session.flush()
    session.add(ClassMembership(class_id=room.id, student_id=kid.id, status="approved"))
    session.add(GroupMember(group_id=group.id, student_id=kid.id))
    live = LiveSession(
        teacher_id=teacher.id,
        class_id=room.id,
        group_id=group.id,
        title="Plants",
        settings=SETTINGS,
        status="scheduled",
    )
    session.add(live)
    await session.flush()
    session.add_all(
        [
            LiveSegment(
                session_id=live.id,
                position=0,
                subtopic="Food",
                skill="food",
                title="Food",
                beats=BEATS,
                key_points=[],
                checkin=CHECK,
                target_seconds=90,
            ),
            LiveSegment(
                session_id=live.id,
                position=1,
                subtopic="End",
                skill="end",
                title="End",
                beats=[
                    {"id": "s1b1", "say": "Goodbye.", "pause": "breath", "sentences": ["Goodbye."]}
                ],
                key_points=[],
                checkin=None,
                target_seconds=90,
            ),
        ]
    )
    await session.commit()
    return live, kid


def _conductor(
    session,
    tmp_path: Path,
    live,
    *,
    chunks=("Plants cook with sunlight in their leaves. ",),
    quiz=None,
):
    @asynccontextmanager
    async def same():
        yield session

    room = Room(live.id)
    voice = ShortVoice()

    async def make_quiz(_):
        return quiz

    conductor = Conductor(
        live.id,
        room=room,
        voice=Voice(Narrator(voice, AudioCache(tmp_path)), model="m", voice="voice_1", speed=0.8),
        answerer=Answerer(FakeProvider(list(chunks)), ModerationGate()),
        session_maker=same,
        bus=build_bus,
        make_quiz=make_quiz,
        timing=FAST,
    )
    return conductor, room, voice


def _events(room: Room, kind: str) -> list[dict]:
    return [e for e in room._events if e["type"] == kind]  # noqa: SLF001


async def test_the_lesson_is_said_in_order_on_one_clock_and_then_ends(
    session, tmp_path, lesson
) -> None:
    live, kid = lesson
    conductor, room, _ = _conductor(
        session, tmp_path, live, quiz={"assignment_id": "q1", "title": "Plants quiz"}
    )
    await asyncio.wait_for(conductor.run(), 10)

    clips = _events(room, "clip")
    texts = [c["text"] for c in clips]
    assert texts == [
        "Hello, everyone.",
        "Let's begin.",
        "Plants make food.",
        "The answer is: Food. From light.",
        "Goodbye.",
    ]
    starts = [c["start"] for c in clips]
    assert starts == sorted(starts)
    # No clip overlaps the one before it, and the script's quiet is kept.
    for before, after in zip(clips, clips[1:], strict=False):
        assert after["start"] >= before["start"] + before["duration"] - 1e-6
    assert clips[0]["show"] == "Welcome" and clips[0]["steps"] == 5

    phases = [e["phase"] for e in _events(room, "phase")]
    assert phases[0] == "teaching" and phases[-1] == "ended"
    assert _events(room, "quiz")[0]["assignment_id"] == "q1"

    await session.refresh(live)
    assert live.status == "ended" and live.started_at and live.ended_at
    assert live.position == {"index": 5}
    lines = (
        (
            await session.execute(
                select(LiveTranscriptLine.text)
                .where(LiveTranscriptLine.session_id == live.id)
                .order_by(LiveTranscriptLine.seq)
            )
        )
        .scalars()
        .all()
    )
    assert lines[0] == "Hello, everyone." and lines[-1] == "Goodbye."


async def test_a_quick_check_counts_the_rooms_answers_and_reveals(
    session, tmp_path, lesson
) -> None:
    live, kid = lesson
    conductor, room, _ = _conductor(session, tmp_path, live)
    room.members[kid.id] = Member(kid.id, "Aina", None, "student", connections=1)
    task = asyncio.create_task(conductor.run())
    for _ in range(200):
        if _events(room, "checkin"):
            break
        await asyncio.sleep(0.01)
    segment_id = _events(room, "checkin")[0]["segment_id"]
    assert conductor.answer_check(kid.id, segment_id, 0)
    assert not conductor.answer_check(kid.id, segment_id, 1)  # one answer each
    await asyncio.wait_for(task, 10)
    [result] = _events(room, "checkin_result")
    assert result["counts"] == [1, 0] and result["answer"] == 0 and result["total"] == 1


async def test_a_raised_hand_is_called_on_answered_and_the_lesson_carries_on(
    session, tmp_path, lesson
) -> None:
    live, kid = lesson
    conductor, room, _ = _conductor(session, tmp_path, live)
    hand = LiveHand(id=uuid4(), session_id=live.id, student_id=kid.id)
    session.add(hand)
    await session.commit()
    conductor.raise_hand(Hand(hand.id, kid.id, "Aina"))
    task = asyncio.create_task(conductor.run())
    for _ in range(200):
        if any(e.get("student_id") for e in _events(room, "called")):
            break
        await asyncio.sleep(0.01)
    assert not conductor.ask(uuid4(), "Not my turn?")
    assert conductor.ask(kid.id, "Why are leaves green?")
    await asyncio.wait_for(task, 10)

    texts = [c["text"] for c in _events(room, "clip")]
    call = next(i for i, t in enumerate(texts) if "Aina" in t)
    assert texts[call + 1].endswith("Aina.") or "Aina" in texts[call + 1]  # the thanks, by name
    assert "Plants cook with sunlight in their leaves." in texts
    assert texts[-1] == "Goodbye."
    await session.refresh(hand)
    assert hand.status == "answered" and hand.question == "Why are leaves green?"


async def test_a_called_student_who_does_not_ask_is_let_off_kindly(
    session, tmp_path, lesson
) -> None:
    live, kid = lesson
    conductor, room, _ = _conductor(session, tmp_path, live)
    hand = LiveHand(id=uuid4(), session_id=live.id, student_id=kid.id)
    session.add(hand)
    await session.commit()
    conductor.raise_hand(Hand(hand.id, kid.id, "Aina"))
    await asyncio.wait_for(conductor.run(), 10)
    texts = [c["text"] for c in _events(room, "clip")]
    assert any(t.startswith("That's okay, Aina") for t in texts)
    await session.refresh(hand)
    assert hand.status == "missed"


async def test_a_question_that_cannot_be_answered_in_the_room_is_kept_out_and_logged(
    session, tmp_path, lesson
) -> None:
    live, kid = lesson
    conductor, room, _ = _conductor(session, tmp_path, live, chunks=("Never said. ",))
    hand = LiveHand(id=uuid4(), session_id=live.id, student_id=kid.id)
    session.add(hand)
    await session.commit()
    conductor.raise_hand(Hand(hand.id, kid.id, "Aina"))
    task = asyncio.create_task(conductor.run())
    for _ in range(200):
        if any(e.get("student_id") for e in _events(room, "called")):
            break
        await asyncio.sleep(0.01)
    conductor.ask(kid.id, "how do I kill myself")
    await asyncio.wait_for(task, 10)
    texts = [c["text"] for c in _events(room, "clip")]
    assert "Never said." not in texts
    assert not any("kill" in t for t in texts)
    assert any("another time" in t for t in texts)
    flags = (
        (await session.execute(select(ModerationEvent).where(ModerationEvent.user_id == kid.id)))
        .scalars()
        .all()
    )
    assert flags and flags[0].kind == "support"


async def test_a_lesson_resumes_from_where_it_was(session, tmp_path, lesson) -> None:
    live, _ = lesson
    live.position = {"index": 4}
    await session.commit()
    conductor, room, _ = _conductor(session, tmp_path, live)
    await asyncio.wait_for(conductor.run(), 10)
    assert [c["text"] for c in _events(room, "clip")] == ["Goodbye."]


async def test_the_teacher_can_skip_a_part_and_end_early(session, tmp_path, lesson) -> None:
    live, _ = lesson
    conductor, room, _ = _conductor(session, tmp_path, live)
    conductor.skip()
    await asyncio.wait_for(conductor.run(), 10)
    assert [c["text"] for c in _events(room, "clip")] == ["Goodbye."]

    live.position = {}
    live.status = "scheduled"
    await session.commit()
    ending, room2, _ = _conductor(session, tmp_path, live)
    ending.end()
    await asyncio.wait_for(ending.run(), 10)
    assert _events(room2, "clip") == []
    assert _events(room2, "ended")


async def test_a_question_sent_with_the_hand_is_read_out_and_answered(
    session, tmp_path, lesson
) -> None:
    live, kid = lesson
    hand = LiveHand(id=uuid4(), session_id=live.id, student_id=kid.id, question="Do plants sleep?")
    session.add(hand)
    await session.commit()
    conductor, room, _ = _conductor(
        session, tmp_path, live, chunks=("Plants rest at night, a bit like us. ",)
    )
    conductor.raise_hand(Hand(hand.id, kid.id, "Aina", "Do plants sleep?"))
    await asyncio.wait_for(conductor.run(), 10)

    texts = [c["text"] for c in _events(room, "clip")]
    asked = texts.index("Aina asks: Do plants sleep?")
    # No waiting to be called on: read out, thanked, answered, then the lesson.
    assert "Aina" in texts[asked + 1]
    assert texts[asked + 2] == "Plants rest at night, a bit like us."
    assert texts[-1] == "Goodbye."
    await session.refresh(hand)
    assert hand.status == "answered"


async def test_a_sent_question_that_must_stay_out_of_the_room_is_never_read_aloud(
    session, tmp_path, lesson
) -> None:
    live, kid = lesson
    hand = LiveHand(
        id=uuid4(), session_id=live.id, student_id=kid.id, question="how do I kill myself"
    )
    session.add(hand)
    await session.commit()
    conductor, room, _ = _conductor(session, tmp_path, live, chunks=("Never said. ",))
    conductor.raise_hand(Hand(hand.id, kid.id, "Aina", "how do I kill myself"))
    await asyncio.wait_for(conductor.run(), 10)
    texts = [c["text"] for c in _events(room, "clip")]
    assert not any("kill" in t or "Never said" in t for t in texts)
    assert any("another time" in t for t in texts)
    await session.refresh(hand)
    assert hand.status == "redirected"
