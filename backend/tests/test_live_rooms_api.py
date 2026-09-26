"""Into the room: who may come in, what a student may send (only ever to the
tutor), and the clock that reminds, opens the room and starts the lesson."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select

from app.api.deps import get_live_runtime, get_narrator, get_transcriber
from app.db.models.classroom import ClassGroup, ClassMembership, Classroom, GroupMember
from app.db.models.live import LiveHand, LiveParticipant, LiveSession
from app.db.models.notification import Notification
from app.events.registry import build_bus
from app.live.audio import AudioCache, Narrator, clip_key
from app.services.live_room import Member, RoomRegistry
from app.services.live_scheduler import LiveScheduler
from tests.live_fakes import SETTINGS
from tests.test_live_voice import FakeSpeech


class FakeConductor:
    def __init__(self) -> None:
        self.hands: list = []
        self.asked: list = []
        self.actions: list[str] = []
        self.called = None

    def raise_hand(self, hand) -> None:
        self.hands.append(hand)

    def lower_hand(self, student_id) -> bool:
        return True

    def is_called(self, student_id) -> bool:
        return self.called == student_id

    def ask(self, student_id, text) -> bool:
        if self.called != student_id:
            return False
        self.asked.append(text)
        return True

    def answer_check(self, student_id, segment_id, choice) -> bool:
        return True

    @property
    def paused(self) -> bool:
        return "pause" in self.actions

    def __getattr__(self, name):
        if name in ("pause", "resume", "skip", "end"):
            return lambda: self.actions.append(name)
        raise AttributeError(name)


class FakeEars:
    def __init__(self) -> None:
        self.heard: list[bytes] = []
        self.fail = False

    async def transcribe(self, audio, *, filename, mime):
        from app.providers.speech import SpeechError

        if self.fail:
            raise SpeechError("That couldn't be heard. Try again, or type it.")
        self.heard.append(audio)
        return "  why are   leaves green  "


class FakeRuntime:
    def __init__(self) -> None:
        self.rooms = RoomRegistry()
        self.running: dict = {}
        self.started: list = []

    async def room(self, session_id):
        return self.rooms.get(session_id)

    def conductor(self, session_id):
        return self.running.get(session_id)

    async def start(self, session_id):
        self.started.append(session_id)
        return self.running.setdefault(session_id, FakeConductor())


@pytest.fixture
def runtime() -> FakeRuntime:
    return FakeRuntime()


@pytest.fixture
def room_api(client, runtime, tmp_path: Path):
    narrator = Narrator(FakeSpeech(), AudioCache(tmp_path))
    ears = FakeEars()

    def make(user):
        c = client(user)
        c._transport.app.dependency_overrides[get_live_runtime] = lambda: runtime  # noqa: SLF001
        c._transport.app.dependency_overrides[get_narrator] = lambda: narrator  # noqa: SLF001
        c._transport.app.dependency_overrides[get_transcriber] = lambda: ears  # noqa: SLF001
        return c

    make.narrator = narrator
    make.ears = ears
    return make


@pytest.fixture
async def scheduled(session, teacher, account):
    kid = await account("student", "Aina Binti")
    outsider = await account("student", "Hafiz")
    room = Classroom(teacher_id=teacher.id, name="5 Bestari")
    session.add(room)
    await session.flush()
    group = ClassGroup(class_id=room.id, name="Stars")
    session.add(group)
    await session.flush()
    session.add_all(
        [
            ClassMembership(class_id=room.id, student_id=kid.id, status="approved"),
            ClassMembership(class_id=room.id, student_id=outsider.id, status="approved"),
            GroupMember(group_id=group.id, student_id=kid.id),
        ]
    )
    live = LiveSession(
        teacher_id=teacher.id,
        class_id=room.id,
        group_id=group.id,
        title="Plants",
        settings=SETTINGS,
        status="scheduled",
        scheduled_at=datetime.now(UTC) + timedelta(minutes=10),
        reminders_sent=["day"],
    )
    session.add(live)
    await session.commit()
    return live, kid, outsider


async def test_the_groups_students_and_their_teacher_may_come_in_and_nobody_else(
    room_api, session, scheduled, teacher
) -> None:
    live, kid, outsider = scheduled
    async with room_api(kid) as c:
        joined = await c.post(f"/api/live-rooms/{live.id}/join")
    assert joined.status_code == 200, joined.text
    body = joined.json()
    assert body["role"] == "student"
    assert body["me"]["name"] == "Aina"
    assert body["questions"] == {"mode": "anytime", "left": 3}
    assert body["snapshot"]["type"] == "snapshot"
    assert await session.get(LiveParticipant, (live.id, kid.id)) is not None

    async with room_api(teacher) as c:
        assert (await c.post(f"/api/live-rooms/{live.id}/join")).json()["role"] == "teacher"
    async with room_api(outsider) as c:
        assert (await c.post(f"/api/live-rooms/{live.id}/join")).status_code == 404


async def test_a_hand_goes_up_only_once_the_lesson_is_live_and_within_the_limit(
    room_api, runtime, session, scheduled
) -> None:
    live, kid, _ = scheduled
    async with room_api(kid) as c:
        early = await c.post(f"/api/live-rooms/{live.id}/hand")
    assert early.status_code == 422

    live.status = "live"
    await session.commit()
    conductor = await runtime.start(live.id)
    async with room_api(kid) as c:
        for _ in range(3):
            assert (await c.post(f"/api/live-rooms/{live.id}/hand")).status_code == 202
        too_many = await c.post(f"/api/live-rooms/{live.id}/hand")
    assert too_many.status_code == 409
    assert [h.name for h in conductor.hands] == ["Aina"] * 3
    rows = (
        (await session.execute(select(LiveHand).where(LiveHand.session_id == live.id)))
        .scalars()
        .all()
    )
    assert len(rows) == 3


async def test_only_the_called_student_may_ask(room_api, runtime, session, scheduled) -> None:
    live, kid, _ = scheduled
    live.status = "live"
    await session.commit()
    conductor = await runtime.start(live.id)
    async with room_api(kid) as c:
        assert (
            await c.post(f"/api/live-rooms/{live.id}/question", json={"text": "Why?"})
        ).status_code == 409
        conductor.called = kid.id
        assert (
            await c.post(
                f"/api/live-rooms/{live.id}/question", json={"text": "Why are leaves green?"}
            )
        ).status_code == 202
    assert conductor.asked == ["Why are leaves green?"]


async def test_recorded_clips_are_served_to_the_room_by_key_only(room_api, scheduled) -> None:
    live, kid, _ = scheduled
    await room_api.narrator.speak("Hello.", model="m", voice="voice_1", speed=0.8)
    key = clip_key(model="m", voice="voice_1", speed=0.8, text="Hello.")
    async with room_api(kid) as c:
        heard = await c.get(f"/api/live-rooms/{live.id}/clips/{key}")
        missing = await c.get(f"/api/live-rooms/{live.id}/clips/{'0' * 64}")
        bad = await c.get(f"/api/live-rooms/{live.id}/clips/..%2F..%2Fetc")
    assert heard.status_code == 200 and heard.content == b"voice_1:Hello."
    assert missing.status_code == 404 and bad.status_code == 404


async def test_the_teacher_begins_and_steers_the_lesson(
    room_api, runtime, scheduled, teacher
) -> None:
    live, kid, _ = scheduled
    async with room_api(kid) as c:
        assert (await c.post(f"/api/live-sessions/{live.id}/begin")).status_code == 403
    async with room_api(teacher) as c:
        assert (await c.post(f"/api/live-sessions/{live.id}/begin")).status_code == 200
        steered = await c.post(f"/api/live-sessions/{live.id}/control", json={"action": "pause"})
    assert runtime.started == [live.id]
    assert steered.json() == {"action": "pause", "paused": True}


async def test_nothing_a_student_sends_reaches_another_student() -> None:
    """The room API offers students a hand, a question to the tutor and a
    check-in answer — and no route that carries anything to a classmate."""
    from app.api.routes import live_rooms

    student_routes = {
        r.path for r in live_rooms.router.routes if "POST" in getattr(r, "methods", set())
    }
    assert student_routes == {
        "/live-rooms/{session_id}/join",
        "/live-rooms/{session_id}/hand",
        "/live-rooms/{session_id}/question",
        "/live-rooms/{session_id}/question/voice",
        "/live-rooms/{session_id}/checkin",
        "/live-rooms/{session_id}/report",
    }


# --- the clock ---------------------------------------------------------------------


def _clock(session, runtime) -> LiveScheduler:
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def same():
        yield session

    return LiveScheduler(runtime=runtime, session_maker=same, bus=build_bus)


async def test_ten_minutes_before_the_room_opens_and_the_group_is_reminded(
    session, runtime, scheduled
) -> None:
    live, kid, outsider = scheduled
    await _clock(session, runtime).tick(datetime.now(UTC))
    await session.refresh(live)
    assert live.status == "lobby"
    assert live.reminders_sent == ["day", "soon"]
    ours = Notification.user_id.in_([kid.id, outsider.id])
    reminders = select(Notification).where(Notification.type == "live_reminder", ours)
    told = [n.user_id for n in (await session.execute(reminders)).scalars()]
    assert told == [kid.id]
    # A second tick sends nothing twice.
    await _clock(session, runtime).tick(datetime.now(UTC))
    assert len((await session.execute(reminders)).scalars().all()) == 1


async def test_at_its_time_the_lesson_starts_once_someone_is_there(
    session, runtime, scheduled
) -> None:
    live, kid, _ = scheduled
    live.status = "lobby"
    live.scheduled_at = datetime.now(UTC) - timedelta(seconds=5)
    await session.commit()
    await _clock(session, runtime).tick(datetime.now(UTC))
    # Nobody in the room yet. (Only this lesson counts: the database is shared.)
    assert live.id not in runtime.started

    room = await runtime.room(live.id)
    room.members[kid.id] = Member(kid.id, "Aina", None, "student", connections=1)
    await _clock(session, runtime).tick(datetime.now(UTC))
    assert live.id in runtime.started


async def test_a_lesson_running_when_the_server_restarted_carries_on(
    session, runtime, scheduled
) -> None:
    live, _, _ = scheduled
    live.status = "live"
    await session.commit()
    await _clock(session, runtime).tick(datetime.now(UTC))
    assert live.id in runtime.started


# --- after the lesson, and the teacher's hand in it ---------------------------------


async def test_a_removed_student_is_told_and_kept_out(
    room_api, runtime, session, scheduled, teacher
) -> None:
    live, kid, _ = scheduled
    room = await runtime.room(live.id)
    async with room_api(teacher) as c:
        gone = await c.post(f"/api/live-sessions/{live.id}/participants/{kid.id}/remove")
    assert gone.status_code == 204
    assert any(e["type"] == "removed" and e["student_id"] == str(kid.id) for e in room._events)  # noqa: SLF001
    async with room_api(kid) as c:
        assert (await c.post(f"/api/live-rooms/{live.id}/join")).status_code == 404


async def test_notes_are_for_the_group_once_the_lesson_has_ended(
    room_api, session, scheduled
) -> None:
    from app.db.models.live import LiveTranscriptLine

    live, kid, outsider = scheduled
    session.add(
        LiveTranscriptLine(session_id=live.id, seq=1, speaker="tutor", text="Hello, everyone.")
    )
    session.add(
        LiveTranscriptLine(
            session_id=live.id, seq=2, speaker="student", student_id=kid.id, text="Why?"
        )
    )
    await session.commit()
    async with room_api(kid) as c:
        early = await c.get(f"/api/live-rooms/{live.id}/notes")
    assert early.status_code == 422

    live.status = "ended"
    await session.commit()
    async with room_api(kid) as c:
        notes = (await c.get(f"/api/live-rooms/{live.id}/notes")).json()
    assert [(line["speaker"], line["name"], line["text"]) for line in notes["transcript"]] == [
        ("tutor", None, "Hello, everyone."),
        ("student", "Aina", "Why?"),
    ]
    async with room_api(outsider) as c:
        assert (await c.get(f"/api/live-rooms/{live.id}/notes")).status_code == 404


async def test_the_summary_says_who_came_what_they_asked_and_how_checks_went(
    room_api, session, scheduled, teacher
) -> None:
    live, kid, _ = scheduled
    now = datetime.now(UTC)
    session.add(
        LiveParticipant(
            session_id=live.id,
            student_id=kid.id,
            first_joined_at=now - timedelta(minutes=12),
            last_seen_at=now,
        )
    )
    session.add(
        LiveHand(
            session_id=live.id,
            student_id=kid.id,
            status="answered",
            question="Why?",
            answer="Because.",
        )
    )
    await session.commit()
    async with room_api(teacher) as c:
        summary = (await c.get(f"/api/live-sessions/{live.id}/summary")).json()
    assert summary["attendance"] == [
        {
            "student_id": str(kid.id),
            "name": "Aina",
            "came": True,
            "joined_at": summary["attendance"][0]["joined_at"],
            "minutes": 12.0,
            "removed": False,
        }
    ]
    assert summary["questions"][0] == {
        **summary["questions"][0],
        "name": "Aina",
        "question": "Why?",
        "answer": "Because.",
    }
    async with room_api(kid) as c:
        assert (await c.get(f"/api/live-sessions/{live.id}/summary")).status_code == 403


async def test_a_spoken_question_is_heard_only_from_the_called_student(
    room_api, runtime, session, scheduled
) -> None:
    live, kid, _ = scheduled
    live.status = "live"
    await session.commit()
    conductor = await runtime.start(live.id)
    clip = {"clip": ("question.wav", b"RIFF....WAVE", "audio/wav")}
    async with room_api(kid) as c:
        early = await c.post(f"/api/live-rooms/{live.id}/question/voice", files=clip)
        conductor.called = kid.id
        heard = await c.post(f"/api/live-rooms/{live.id}/question/voice", files=clip)
        room_api.ears.fail = True
        missed = await c.post(f"/api/live-rooms/{live.id}/question/voice", files=clip)
    assert early.status_code == 409 and room_api.ears.heard == [b"RIFF....WAVE"]
    assert heard.status_code == 202 and heard.json() == {"text": "why are leaves green"}
    assert conductor.asked == ["why are leaves green"]
    assert missed.status_code == 422


async def test_a_recording_that_is_too_long_is_refused(
    room_api, runtime, session, scheduled
) -> None:
    live, kid, _ = scheduled
    live.status = "live"
    await session.commit()
    conductor = await runtime.start(live.id)
    conductor.called = kid.id
    async with room_api(kid) as c:
        big = await c.post(
            f"/api/live-rooms/{live.id}/question/voice",
            files={"clip": ("q.wav", b"x" * 1_300_000, "audio/wav")},
        )
    assert big.status_code == 422


async def test_a_report_reaches_the_safety_queue_and_flags_the_lesson(
    room_api, session, scheduled, teacher
) -> None:
    from app.db.models.moderation import ModerationEvent

    live, kid, outsider = scheduled
    async with room_api(kid) as c:
        sent = await c.post(
            f"/api/live-rooms/{live.id}/report", json={"text": "The picture was scary."}
        )
    async with room_api(outsider) as c:
        stranger = await c.post(f"/api/live-rooms/{live.id}/report", json={"text": "Hmm."})
    assert sent.status_code == 202 and stranger.status_code == 404
    await session.refresh(live)
    assert live.flagged_at is not None
    [event] = (
        (await session.execute(select(ModerationEvent).where(ModerationEvent.user_id == kid.id)))
        .scalars()
        .all()
    )
    assert event.kind == "report" and "scary" in event.excerpt
