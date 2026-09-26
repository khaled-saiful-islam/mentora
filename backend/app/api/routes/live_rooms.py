"""Inside a live lesson: joining, following it, hearing it, raising a hand.

The same room for the teacher (who owns the session) and the group's
students (who can see it on their schedule). Students may only ever send
things to the tutor — a hand, a question when called on, a check-in answer —
never anything that reaches another student.
"""

from __future__ import annotations

import json
import re
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func, select
from sse_starlette.sse import EventSourceResponse

from app.api.deps import (
    CurrentUser,
    LiveRuntimeDep,
    NarratorDep,
    SessionDep,
    StreamUser,
    TranscriberDep,
    require_capability,
)
from app.api.schemas.live import session_summary
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.models.live import LiveHand, LiveParticipant, LiveSession, LiveTranscriptLine
from app.db.models.user import User
from app.db.session import session_scope
from app.policies.capabilities import capabilities_for
from app.providers.speech import SpeechError
from app.services.live_conductor import Hand
from app.services.live_plan_service import first_name
from app.services.live_room import Member
from app.services.live_session_service import LiveSessionService
from app.services.live_summary_service import LiveSummaryService

router = APIRouter(prefix="/live-rooms", tags=["live"])
control = APIRouter(
    prefix="/live-sessions",
    tags=["live"],
    dependencies=[Depends(require_capability("run_live_sessions"))],
)

_KEY = re.compile(r"^[0-9a-f]{64}$")
# Half a minute of 16 kHz mono WAV is under a megabyte.
MAX_CLIP_BYTES = 1_200_000
OPEN = ("lobby", "live")


class QuestionBody(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=400)]


class CheckinBody(BaseModel):
    segment_id: UUID
    choice: int = Field(ge=0, le=3)


class ControlBody(BaseModel):
    action: Literal["pause", "resume", "skip", "end"]


async def _access(db, user: User, session_id: UUID) -> tuple[LiveSession, str]:
    """The session and the caller's part in it — or it does not exist for them."""
    live = await db.get(LiveSession, session_id)
    if live is not None and live.teacher_id == user.id:
        return live, "teacher"
    if capabilities_for(user.role).join_live_sessions:
        visible = await LiveSessionService(db).visible(user.id, session_id)
        removed = await db.scalar(
            select(LiveParticipant.removed_at).where(
                LiveParticipant.session_id == session_id, LiveParticipant.student_id == user.id
            )
        )
        if removed is None:
            return visible, "student"
    raise NotFoundError("No such live session.")


@router.get("/time")
async def server_time(user: CurrentUser) -> dict[str, float]:
    """The server's clock, for keeping everyone's playback in step."""
    return {"now": time.time()}


@router.post("/{session_id}/join")
async def join(
    session_id: UUID, user: CurrentUser, session: SessionDep, runtime: LiveRuntimeDep
) -> dict[str, Any]:
    live, role = await _access(session, user, session_id)
    if role == "student":
        await _arrived(session, live.id, user.id)
    view = await LiveSessionService(session).view(live)
    room = await runtime.room(live.id)
    lines = (
        await session.execute(
            select(
                LiveTranscriptLine.speaker, LiveTranscriptLine.text, LiveTranscriptLine.student_id
            )
            .where(LiveTranscriptLine.session_id == live.id)
            .order_by(LiveTranscriptLine.seq.desc())
            .limit(60)
        )
    ).all()
    names = {m.id: m.name for m in room.members.values()}
    asked = await _asked(session, live.id, user.id) if role == "student" else 0
    allowed = int((live.settings.get("questions") or {}).get("max_per_student", 3))
    return {
        "session": {**session_summary(view), "segments_total": room.state.get("segments")},
        "role": role,
        "me": {"id": str(user.id), "name": first_name(user)},
        "questions": {
            "mode": (live.settings.get("questions") or {}).get("mode", "anytime"),
            "left": max(0, allowed - asked),
        },
        "snapshot": room.snapshot(),
        # Kept on the session, so it survives the room being forgotten.
        "quiz": await _quiz(session, live),
        "transcript": [
            {
                "speaker": speaker,
                "text": text,
                "name": names.get(student_id) if student_id else None,
            }
            for speaker, text, student_id in reversed(lines)
        ],
    }


@router.get("/{session_id}/stream")
async def stream(
    session_id: UUID,
    user: StreamUser,
    runtime: LiveRuntimeDep,
    since: int | None = Query(default=None),
) -> EventSourceResponse:
    async with session_scope() as db:
        live, role = await _access(db, user, session_id)
    room = await runtime.room(live.id)
    member = room.members.get(user.id) or Member(user.id, first_name(user), user.buddy, role)
    return EventSourceResponse(_frames(room.follow(member, since), live.id, user.id, role), ping=15)


@router.get("/{session_id}/clips/{key}")
async def clip(
    session_id: UUID, key: str, user: CurrentUser, session: SessionDep, narrator: NarratorDep
) -> Response:
    await _access(session, user, session_id)
    audio = narrator.cached(key) if _KEY.match(key) else None
    if audio is None:
        raise NotFoundError("No such clip.")
    return Response(
        audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=86400"}
    )


@router.post("/{session_id}/hand", status_code=status.HTTP_202_ACCEPTED)
async def raise_hand(
    session_id: UUID, user: CurrentUser, session: SessionDep, runtime: LiveRuntimeDep
) -> dict[str, Any]:
    live, role = await _access(session, user, session_id)
    conductor = runtime.conductor(live.id)
    if role != "student" or conductor is None or live.status != "live":
        raise ValidationError("Hands go up once the lesson has started.")
    allowed = int((live.settings.get("questions") or {}).get("max_per_student", 3))
    asked = await _asked(session, live.id, user.id)
    if asked >= allowed:
        raise ConflictError(f"You've asked {asked} questions already — that's all for this lesson.")
    hand = LiveHand(id=uuid4(), session_id=live.id, student_id=user.id, status="queued")
    session.add(hand)
    await session.commit()
    conductor.raise_hand(Hand(hand.id, user.id, first_name(user)))
    return {"id": str(hand.id), "left": allowed - asked - 1}


@router.delete("/{session_id}/hand", status_code=status.HTTP_204_NO_CONTENT)
async def lower_hand(
    session_id: UUID, user: CurrentUser, session: SessionDep, runtime: LiveRuntimeDep
) -> Response:
    live, _ = await _access(session, user, session_id)
    conductor = runtime.conductor(live.id)
    if conductor is not None and conductor.lower_hand(user.id):
        queued = (
            (
                await session.execute(
                    select(LiveHand).where(
                        LiveHand.session_id == live.id,
                        LiveHand.student_id == user.id,
                        LiveHand.status == "queued",
                    )
                )
            )
            .scalars()
            .all()
        )
        for hand in queued:
            hand.status = "lowered"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{session_id}/question", status_code=status.HTTP_202_ACCEPTED)
async def question(
    session_id: UUID,
    body: QuestionBody,
    user: CurrentUser,
    session: SessionDep,
    runtime: LiveRuntimeDep,
) -> dict[str, bool]:
    live, _ = await _access(session, user, session_id)
    conductor = runtime.conductor(live.id)
    if conductor is None or not conductor.ask(user.id, body.text):
        raise ConflictError("It isn't your turn to ask just now.")
    return {"ok": True}


@router.post("/{session_id}/question/voice", status_code=status.HTTP_202_ACCEPTED)
async def spoken_question(
    session_id: UUID,
    user: CurrentUser,
    session: SessionDep,
    runtime: LiveRuntimeDep,
    transcriber: TranscriberDep,
    clip: UploadFile = File(...),
) -> dict[str, Any]:
    """A question said aloud while called on. The clip is heard, turned into
    words, and dropped — only the words are kept, like everything said here."""
    live, _ = await _access(session, user, session_id)
    conductor = runtime.conductor(live.id)
    if conductor is None or not conductor.is_called(user.id):
        raise ConflictError("It isn't your turn to ask just now.")
    audio = await clip.read(MAX_CLIP_BYTES + 1)
    if not audio or len(audio) > MAX_CLIP_BYTES:
        raise ValidationError("That recording is too long. Keep a question under half a minute.")
    try:
        text = await transcriber.transcribe(
            audio, filename=clip.filename or "question.wav", mime=clip.content_type or "audio/wav"
        )
    except SpeechError as exc:
        raise ValidationError(str(exc)) from exc
    finally:
        del audio
    text = " ".join(text.split())
    if len(text) < 2:
        raise ValidationError(
            "Astra didn't catch that. Try again, a little closer to the microphone."
        )
    if not conductor.ask(user.id, text[:400]):
        raise ConflictError("It isn't your turn to ask just now.")
    return {"text": text[:400]}


@router.post("/{session_id}/checkin", status_code=status.HTTP_202_ACCEPTED)
async def checkin(
    session_id: UUID,
    body: CheckinBody,
    user: CurrentUser,
    session: SessionDep,
    runtime: LiveRuntimeDep,
) -> dict[str, bool]:
    live, role = await _access(session, user, session_id)
    conductor = runtime.conductor(live.id)
    if role != "student" or conductor is None:
        raise ValidationError("There is no quick check open.")
    return {"ok": conductor.answer_check(user.id, str(body.segment_id), body.choice)}


# --- the teacher's hand on the lesson --------------------------------------------


@control.post("/{session_id}/begin")
async def begin(
    session_id: UUID, user: CurrentUser, session: SessionDep, runtime: LiveRuntimeDep
) -> dict[str, str]:
    live = await LiveSessionService(session).owned(user.id, session_id)
    if live.status not in ("scheduled", "lobby", "live"):
        raise ValidationError("Schedule the lesson before starting it.")
    await session.commit()
    await runtime.start(live.id)
    return {"status": "live"}


@control.post("/{session_id}/control")
async def steer(
    session_id: UUID,
    body: ControlBody,
    user: CurrentUser,
    session: SessionDep,
    runtime: LiveRuntimeDep,
) -> dict[str, Any]:
    live = await LiveSessionService(session).owned(user.id, session_id)
    conductor = runtime.conductor(live.id)
    if conductor is None:
        raise ValidationError("The lesson isn't running.")
    getattr(conductor, body.action)()
    return {"action": body.action, "paused": conductor.paused}


@control.get("/{session_id}/summary")
async def summary(session_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    live = await LiveSessionService(session).owned(user.id, session_id)
    return await LiveSummaryService(session).summary(live)


@control.post(
    "/{session_id}/participants/{student_id}/remove", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_student(
    session_id: UUID,
    student_id: UUID,
    user: CurrentUser,
    session: SessionDep,
    runtime: LiveRuntimeDep,
) -> Response:
    """Out of the room, and kept out: their page is told, their hand comes down."""
    live = await LiveSessionService(session).owned(user.id, session_id)
    if student_id not in await LiveSessionService(session).audience(live):
        raise NotFoundError("That student isn't in this group.")
    now = datetime.now(UTC)
    found = await session.get(LiveParticipant, (live.id, student_id))
    if found is None:
        session.add(
            LiveParticipant(
                session_id=live.id,
                student_id=student_id,
                first_joined_at=now,
                last_seen_at=now,
                removed_at=now,
            )
        )
    else:
        found.removed_at = now
    await session.commit()
    room = await runtime.room(live.id)
    room.members.pop(student_id, None)
    room.publish({"type": "removed", "student_id": str(student_id)})
    room.publish({"type": "roster", "roster": room.roster()})
    conductor = runtime.conductor(live.id)
    if conductor is not None:
        conductor.lower_hand(student_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@control.post("/{session_id}/hands/{student_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_hand(
    session_id: UUID,
    student_id: UUID,
    user: CurrentUser,
    session: SessionDep,
    runtime: LiveRuntimeDep,
) -> Response:
    live = await LiveSessionService(session).owned(user.id, session_id)
    conductor = runtime.conductor(live.id)
    if conductor is not None and conductor.lower_hand(student_id):
        queued = (
            (
                await session.execute(
                    select(LiveHand).where(
                        LiveHand.session_id == live.id,
                        LiveHand.student_id == student_id,
                        LiveHand.status == "queued",
                    )
                )
            )
            .scalars()
            .all()
        )
        for hand in queued:
            hand.status = "dismissed"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{session_id}/notes")
async def notes(session_id: UUID, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    """A student's notes from a lesson that has happened: key points and all that was said."""
    live, _ = await _access(session, user, session_id)
    if live.status != "ended":
        raise ValidationError("Notes are ready once the lesson has finished.")
    return await LiveSummaryService(session).notes(live)


# --- helpers -------------------------------------------------------------------------


async def _quiz(db, live: LiveSession) -> dict[str, str] | None:
    if live.assignment_id is None:
        return None
    from app.db.models.learning import Assignment

    assignment = await db.get(Assignment, live.assignment_id)
    return {
        "assignment_id": str(live.assignment_id),
        "title": assignment.title if assignment else live.title,
    }


async def _arrived(db, session_id: UUID, student_id: UUID) -> None:
    now = datetime.now(UTC)
    found = await db.get(LiveParticipant, (session_id, student_id))
    if found is None:
        db.add(
            LiveParticipant(
                session_id=session_id, student_id=student_id, first_joined_at=now, last_seen_at=now
            )
        )
    else:
        found.last_seen_at = now
    await db.commit()


async def _asked(db, session_id: UUID, student_id: UUID) -> int:
    return int(
        await db.scalar(
            select(func.count())
            .select_from(LiveHand)
            .where(
                LiveHand.session_id == session_id,
                LiveHand.student_id == student_id,
                LiveHand.status.in_(("queued", "called", "answered", "redirected")),
            )
        )
        or 0
    )


async def _left(session_id: UUID, student_id: UUID, role: str) -> None:
    if role != "student":
        return
    try:
        async with session_scope() as db:
            found = await db.get(LiveParticipant, (session_id, student_id))
            if found is not None:
                now = datetime.now(UTC)
                found.seconds_present += int((now - found.last_seen_at).total_seconds())
                found.last_seen_at = now
    except Exception:  # noqa: BLE001 — attendance is best-effort; the lesson is not
        return


async def _seen(session_id: UUID, student_id: UUID) -> None:
    try:
        async with session_scope() as db:
            found = await db.get(LiveParticipant, (session_id, student_id))
            if found is not None:
                found.last_seen_at = datetime.now(UTC)
    except Exception:  # noqa: BLE001 — attendance is best-effort
        return


async def _frames(
    events: AsyncIterator[dict], session_id: UUID, user_id: UUID, role: str
) -> AsyncIterator[dict[str, str]]:
    if role == "student":
        await _seen(session_id, user_id)
    try:
        async for event in events:
            yield {
                "id": str(event.get("seq", "")),
                "event": str(event.get("type", "message")),
                "data": json.dumps(event, ensure_ascii=False, default=str),
            }
    finally:
        await _left(session_id, user_id, role)
