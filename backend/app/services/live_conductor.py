"""The conductor: one live lesson, taught on the server's clock.

It walks the lesson sentence by sentence (`live/timeline.py`). For each it
makes sure the clip is recorded, gives it a start time on the server clock,
and tells the room a moment before — so every student hears the same
sentence at the same time, and a latecomer starts part-way through it. The
silence after each sentence is the script's.

Between sentences it looks up: a raised hand is called on (straight away, or
at the end of a part when questions are taken at pauses); a teacher's pause,
skip or end takes effect. A part with a quick check opens it, waits, and
reveals the answer. At the end: the recap was the last part, the lesson is
marked ended, and the quiz is made and shared.

The position is saved after every sentence, so a restart resumes where it
was rather than starting again.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.grades import grade_for
from app.db.models.live import (
    LiveCheckinAnswer,
    LiveHand,
    LiveSegment,
    LiveSession,
    LiveTranscriptLine,
)
from app.events.bus import EventBus
from app.live.answering import Answerer
from app.live.audio import Narrator, clip_key
from app.live.beats import SENTENCE_GAP
from app.live.mp3 import duration
from app.live.speakable import speakable
from app.live.timeline import Step, reveal_line, steps_of
from app.moderation.base import Flag
from app.services.live_plan_service import student_lines
from app.services.live_room import Room
from app.services.moderation_service import ModerationService, Where

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]
QuizMaker = Callable[[UUID], Awaitable[dict[str, Any] | None]]


@dataclass(frozen=True, slots=True)
class Timing:
    # A clip is told to the room this long before it starts, to be fetched.
    ahead: float = 1.2
    # The soonest a clip can start after it is decided.
    lead: float = 0.6
    # How long a called student has to ask.
    question_wait: float = 45.0
    # How long a quick check stays open.
    check_open: float = 20.0
    # Quiet after an answer, before the lesson carries on.
    after_answer: float = 0.8


@dataclass
class Hand:
    id: UUID
    student_id: UUID
    name: str


class Voice:
    """The session's voice: clips by text, with their exact lengths."""

    def __init__(self, narrator: Narrator, *, model: str, voice: str, speed: float) -> None:
        self._narrator = narrator
        self.model, self.voice, self.speed = model, voice, speed

    def key(self, text: str) -> str:
        return clip_key(model=self.model, voice=self.voice, speed=self.speed, text=speakable(text))

    async def clip(self, text: str) -> tuple[str, float]:
        audio = await self._narrator.speak(
            text, model=self.model, voice=self.voice, speed=self.speed
        )
        return self.key(text), duration(audio)


class Conductor:
    def __init__(
        self,
        session_id: UUID,
        *,
        room: Room,
        voice: Voice,
        answerer: Answerer,
        session_maker: SessionMaker,
        bus: Callable[[], EventBus],
        make_quiz: QuizMaker,
        timing: Timing = Timing(),
    ) -> None:
        self.session_id = session_id
        self._room = room
        self._voice = voice
        self._answerer = answerer
        self._db = session_maker
        self._bus = bus
        self._make_quiz = make_quiz
        self._t = timing
        self._free_at = 0.0
        self._hands: deque[Hand] = deque()
        self._question: asyncio.Future[str] | None = None
        self._called: Hand | None = None
        self._checkin: dict[str, Any] | None = None
        self._answers: dict[UUID, int] = {}
        self._running = asyncio.Event()
        self._running.set()
        self._skip = False
        self._stop = False
        self._taught: list[str] = []
        self._at_part_end = True
        self._settings: dict[str, Any] = {}
        self._names: dict[UUID, str] = {}
        self.done = asyncio.Event()

    # --- what the room can ask of it ---------------------------------------------

    def raise_hand(self, hand: Hand) -> None:
        if any(h.student_id == hand.student_id for h in self._hands):
            return
        self._hands.append(hand)
        self._publish_hands()
        if len(self._hands) == 1:
            # While the tutor finishes its sentence, warm the model for the question.
            asyncio.create_task(self._warm())

    def lower_hand(self, student_id: UUID) -> bool:
        before = len(self._hands)
        self._hands = deque(h for h in self._hands if h.student_id != student_id)
        self._publish_hands()
        return len(self._hands) < before

    def ask(self, student_id: UUID, text: str) -> bool:
        """The called student's question. False if they are not the one called."""
        if self._called is None or self._called.student_id != student_id:
            return False
        if self._question is None or self._question.done():
            return False
        self._question.set_result(text)
        return True

    def answer_check(self, student_id: UUID, segment_id: str, choice: int) -> bool:
        if not self._checkin or self._checkin["segment_id"] != segment_id:
            return False
        if student_id in self._answers:
            return False
        self._answers[student_id] = choice
        self._room.publish(
            {"type": "checkin_count", "segment_id": segment_id, "answered": len(self._answers)}
        )
        return True

    def pause(self) -> None:
        self._running.clear()

    def resume(self) -> None:
        self._running.set()

    def skip(self) -> None:
        self._skip = True

    def end(self) -> None:
        self._stop = True
        self._running.set()

    @property
    def paused(self) -> bool:
        return not self._running.is_set()

    # --- the lesson ------------------------------------------------------------------

    async def run(self) -> None:
        try:
            steps, start = await self._load()
            await self._mark_live()
            self._room.publish({"type": "phase", "phase": "teaching"})
            self._free_at = time.time() + self._t.lead
            index = start
            while index < len(steps) and not self._stop:
                await self._between()
                if self._stop:
                    break
                if self._skip:
                    self._skip = False
                    index = _next_segment(steps, index)
                    continue
                step = steps[index]
                if step.kind == "check":
                    await self._check(step)
                elif not await self._say_step(step, steps):
                    continue  # interrupted before it was said: look up, then say it
                index += 1
                await self._save_position(index)
            await self._finish()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("live session %s stopped with an error", self.session_id)
            self._room.publish({"type": "error", "message": "The lesson stopped unexpectedly."})
        finally:
            self.done.set()

    async def _between(self) -> None:
        """Pause, a hand to take — whatever should happen before the next sentence."""
        if self.paused:
            self._room.publish({"type": "phase", "phase": "paused"})
            await self._running.wait()
            self._free_at = max(self._free_at, time.time() + self._t.lead)
            self._room.publish({"type": "phase", "phase": "teaching"})
        while self._hands and self._may_take_hand() and not self._stop:
            await self._take(self._hands.popleft())

    def _may_take_hand(self) -> bool:
        mode = (self._settings.get("questions") or {}).get("mode", "anytime")
        return mode == "anytime" or self._at_part_end

    async def _say_step(self, step: Step, steps: list[Step]) -> bool:
        said = await self._say(
            step.text,
            lane="lesson",
            pause=step.pause,
            extra={
                "step": step.index,
                "steps": len(steps),
                "segment": step.segment,
                "segment_id": step.segment_id,
                "beat_id": step.beat_id,
                "show": step.show,
            },
            interruptible=True,
        )
        if said:
            self._taught.append(step.text)
            self._at_part_end = step.part_end
            upcoming = steps[step.index + 1] if step.index + 1 < len(steps) else None
            if upcoming and upcoming.kind == "say":
                asyncio.create_task(self._prefetch(upcoming.text))
        return said

    async def _say(
        self,
        text: str,
        *,
        lane: str,
        pause: float,
        extra: dict[str, Any] | None = None,
        interruptible: bool = False,
    ) -> bool:
        key, seconds = await self._voice.clip(text)
        start = max(time.time() + self._t.lead, self._free_at)
        await asyncio.sleep(max(0.0, start - self._t.ahead - time.time()))
        if interruptible and (
            self._stop or self.paused or self._skip or (self._hands and self._may_take_hand())
        ):
            return False
        start = max(start, time.time() + self._t.lead / 2)
        self._room.publish(
            {
                "type": "clip",
                "key": key,
                "text": text,
                "lane": lane,
                "start": start,
                "duration": seconds,
                **(extra or {}),
            }
        )
        self._free_at = start + seconds + pause
        await self._line("tutor", text, segment_id=(extra or {}).get("segment_id"))
        return True

    async def _prefetch(self, text: str) -> None:
        """Tell the room the next clip is ready to fetch — once it really is.
        Recording it here, ahead, also means it is waiting when its turn comes."""
        try:
            key, _ = await self._voice.clip(text)
        except Exception:  # noqa: BLE001 — its turn will record it, or say why
            return
        self._room.publish({"type": "prefetch", "key": key})

    async def _until_quiet(self) -> None:
        await asyncio.sleep(max(0.0, self._free_at - time.time()))

    # --- a raised hand -------------------------------------------------------------------

    async def _take(self, hand: Hand) -> None:
        self._called = hand
        self._publish_hands()
        self._room.publish({"type": "phase", "phase": "called"})
        self._room.publish(
            {
                "type": "called",
                "student_id": str(hand.student_id),
                "name": hand.name,
                "hand_id": str(hand.id),
            }
        )
        await self._hand_status(hand.id, "called")
        lines = student_lines(self.session_id, hand.name)
        loop = asyncio.get_running_loop()
        self._question = loop.create_future()
        await self._say(lines.call, lane="tutor", pause=0.3)
        try:
            await self._until_quiet()
            question = await asyncio.wait_for(self._question, self._t.question_wait)
        except TimeoutError:
            await self._say(lines.later, lane="tutor", pause=self._t.after_answer)
            await self._hand_status(hand.id, "missed")
            self._done_calling()
            return
        await self._answer(hand, question, lines)
        self._done_calling()

    async def _answer(self, hand: Hand, question: str, lines: Any) -> None:
        self._room.publish({"type": "phase", "phase": "answering"})
        self._room.publish(
            {
                "type": "question",
                "student_id": str(hand.student_id),
                "name": hand.name,
                "text": question,
            }
        )
        await self._line("student", question, student_id=hand.student_id)
        said: list[str] = []
        kept_out: dict[str, Any] | None = None
        async for event in self._answerer.answer(
            question=question,
            student=hand.name,
            topic=str(self._settings.get("topic", "")),
            grade=grade_for(self._settings.get("grade_level")),
            taught=self._taught[-40:],
            redirect=lines.redirect,
        ):
            if event["type"] == "redirect":
                kept_out = event
                await self._say(event["text"], lane="tutor", pause=self._t.after_answer)
            elif event["type"] == "sentence":
                if not said:
                    await self._say(lines.thanks, lane="tutor", pause=0.3)
                said.append(event["text"])
                await self._say(event["text"], lane="tutor", pause=SENTENCE_GAP)
        self._free_at += self._t.after_answer
        if kept_out:
            await self._hand_status(hand.id, "redirected", question=question)
            await self._flag(hand, question, kept_out)
        else:
            await self._hand_status(hand.id, "answered", question=question, answer=" ".join(said))

    def _done_calling(self) -> None:
        self._called = None
        self._question = None
        self._room.publish({"type": "called", "student_id": None})
        self._room.publish({"type": "phase", "phase": "teaching"})

    async def _warm(self) -> None:
        try:
            await self._answerer.warm(
                topic=str(self._settings.get("topic", "")),
                grade=grade_for(self._settings.get("grade_level")),
                taught=self._taught[-40:],
            )
        except Exception:  # noqa: BLE001 — warming is only ever an optimisation
            logger.info("live: warming failed", exc_info=True)

    def _publish_hands(self) -> None:
        queue = [
            {"id": str(h.id), "student_id": str(h.student_id), "name": h.name} for h in self._hands
        ]
        self._room.publish({"type": "hands", "queue": queue})

    # --- a quick check ----------------------------------------------------------------------

    async def _check(self, step: Step) -> None:
        checkin = step.checkin or {}
        await self._until_quiet()
        opens = time.time()
        closes = opens + self._t.check_open
        self._answers = {}
        self._checkin = {
            "segment_id": step.segment_id,
            "question": checkin.get("question"),
            "options": checkin.get("options"),
        }
        self._room.publish({"type": "phase", "phase": "checkin"})
        self._room.publish({"type": "checkin", **self._checkin, "closes_at": closes})
        while time.time() < closes and not self._stop:
            here = self._room.here()
            if here and all(student in self._answers for student in here):
                break
            await asyncio.sleep(0.25)
        answer = int(checkin.get("answer", 0))
        counts = [0] * len(checkin.get("options") or [])
        for choice in self._answers.values():
            if 0 <= choice < len(counts):
                counts[choice] += 1
        await self._save_answers(step.segment_id, answer)
        self._checkin = None
        self._room.publish(
            {
                "type": "checkin_result",
                "segment_id": step.segment_id,
                "counts": counts,
                "answer": answer,
                "explanation": checkin.get("explanation", ""),
                "total": len(self._answers),
            }
        )
        self._free_at = max(self._free_at, time.time() + self._t.lead)
        await self._say(
            reveal_line(checkin),
            lane="lesson",
            pause=0.8,
            extra={"segment": step.segment, "segment_id": step.segment_id},
        )
        self._room.publish({"type": "phase", "phase": "teaching"})
        self._at_part_end = True

    # --- the end ------------------------------------------------------------------------------

    async def _finish(self) -> None:
        await self._until_quiet()
        await self._mark_ended()
        self._room.publish({"type": "phase", "phase": "ended"})
        self._room.publish({"type": "ended"})
        try:
            made = await self._make_quiz(self.session_id)
        except Exception:
            logger.exception("the quiz for live session %s could not be made", self.session_id)
            made = None
        if made:
            self._room.publish({"type": "quiz", **made})

    # --- keeping the record ----------------------------------------------------------------------

    async def _load(self) -> tuple[list[Step], int]:
        async with self._db() as db:
            live = await db.get(LiveSession, self.session_id)
            if live is None:
                raise RuntimeError("no such session")
            self._settings = dict(live.settings)
            rows = (
                (
                    await db.execute(
                        select(LiveSegment)
                        .where(LiveSegment.session_id == live.id)
                        .order_by(LiveSegment.position)
                    )
                )
                .scalars()
                .all()
            )
            segments = [{"id": r.id, "beats": r.beats, "checkin": r.checkin} for r in rows]
            start = int((live.position or {}).get("index", 0))
            self._room.state["segments"] = len(segments)
        return steps_of(segments), start

    async def _mark_live(self) -> None:
        async with self._db() as db:
            live = await db.get(LiveSession, self.session_id)
            if live is not None and live.status != "live":
                live.status = "live"
                live.started_at = live.started_at or datetime.now(UTC)
                await db.commit()

    async def _mark_ended(self) -> None:
        async with self._db() as db:
            live = await db.get(LiveSession, self.session_id)
            if live is not None:
                live.status = "ended"
                live.ended_at = datetime.now(UTC)
                await db.commit()

    async def _save_position(self, index: int) -> None:
        try:
            async with self._db() as db:
                live = await db.get(LiveSession, self.session_id)
                if live is not None:
                    live.position = {"index": index}
                    await db.commit()
        except Exception:  # noqa: BLE001 — losing one position means resuming a sentence early
            logger.warning("could not save the position of %s", self.session_id, exc_info=True)

    async def _line(
        self, speaker: str, text: str, *, segment_id: Any = None, student_id: UUID | None = None
    ) -> None:
        try:
            async with self._db() as db:
                seq = await db.scalar(
                    select(func.coalesce(func.max(LiveTranscriptLine.seq), 0)).where(
                        LiveTranscriptLine.session_id == self.session_id
                    )
                )
                db.add(
                    LiveTranscriptLine(
                        session_id=self.session_id,
                        seq=int(seq or 0) + 1,
                        speaker=speaker,
                        student_id=student_id,
                        segment_id=UUID(str(segment_id)) if segment_id else None,
                        text=text,
                    )
                )
                await db.commit()
        except Exception:  # noqa: BLE001 — the lesson goes on; the transcript misses a line
            logger.warning(
                "could not keep a transcript line for %s", self.session_id, exc_info=True
            )

    async def _hand_status(
        self, hand_id: UUID, status: str, *, question: str | None = None, answer: str | None = None
    ) -> None:
        try:
            async with self._db() as db:
                hand = await db.get(LiveHand, hand_id)
                if hand is None:
                    return
                hand.status = status
                now = datetime.now(UTC)
                if status == "called":
                    hand.called_at = now
                if question is not None:
                    hand.question = question[:2000]
                    hand.answered_at = now
                if answer is not None:
                    hand.answer = answer[:4000]
                await db.commit()
        except Exception:  # noqa: BLE001
            logger.warning("could not update a raised hand in %s", self.session_id, exc_info=True)

    async def _save_answers(self, segment_id: str, answer: int) -> None:
        try:
            async with self._db() as db:
                for student_id, choice in self._answers.items():
                    db.add(
                        LiveCheckinAnswer(
                            segment_id=UUID(segment_id),
                            student_id=student_id,
                            session_id=self.session_id,
                            choice=choice,
                            correct=choice == answer,
                        )
                    )
                await db.commit()
        except Exception:  # noqa: BLE001
            logger.warning("could not keep check-in answers for %s", self.session_id, exc_info=True)

    async def _flag(self, hand: Hand, question: str, kept_out: dict[str, Any]) -> None:
        """A question kept out of the room goes to the safety log, and a student
        who may be at risk is brought to a person's attention."""
        support = kept_out.get("decision") == "support"
        flag = Flag(
            kind="support" if support else "held",
            source="user_input",
            severity="high" if support else "medium",
            category=str(kept_out.get("category") or "none"),
            rule="live_question",
            screen="rules",
            excerpt=question[:500],
        )
        try:
            async with self._db() as db:
                await ModerationService(db, self._bus()).record(
                    flag, Where(user_id=hand.student_id)
                )
                await db.commit()
        except Exception:
            logger.exception("could not log a held question in %s", self.session_id)


def _next_segment(steps: list[Step], index: int) -> int:
    if index >= len(steps):
        return index
    current = steps[index].segment
    for step in steps[index:]:
        if step.segment != current:
            return step.index
    return len(steps)
