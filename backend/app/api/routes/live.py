"""Live tutoring. For now the voice lab: judging the tutor's voice before any
session is built on it (PLAN.md §19, Phase 0)."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field, StringConstraints, field_validator
from sse_starlette.sse import EventSourceResponse

from app.api.deps import (
    NarratorDep,
    SettingsDep,
    VoiceLabDep,
    limit_chat,
    limit_generate,
    limit_speech,
    require_capability,
)
from app.core.errors import UpstreamError, ValidationError
from app.core.grades import Grade, grade_for, is_grade
from app.learning.model import GenerationUnavailable
from app.live.voice_lab import LessonUnavailable, lines_for
from app.providers.speech import MAX_SPEED, MIN_SPEED, VOICE_NOTES, SpeechError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/live",
    tags=["live"],
    dependencies=[Depends(require_capability("run_live_sessions"))],
)

MAX_STUDENTS = 8


def _name(value: str) -> str:
    # First names only are ever spoken in a room.
    return " ".join(value.split())[:40].split(" ")[0]


# One line of the lesson already said, sent back as the answer's context.
Taught = Annotated[str, StringConstraints(max_length=600)]


class LessonRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=160)
    grade_level: str | None = None
    students: list[str] = Field(default_factory=list, max_length=MAX_STUDENTS)

    @field_validator("grade_level")
    @classmethod
    def _grade(cls, value: str | None) -> str | None:
        if value is not None and not is_grade(value):
            raise ValueError("not a school level Mentora knows")
        return value

    @field_validator("students")
    @classmethod
    def _names(cls, value: list[str]) -> list[str]:
        return [name for name in (_name(v) for v in value) if name]


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=900)
    voice: str | None = None
    model: str | None = None
    speed: float | None = Field(default=None, ge=MIN_SPEED, le=MAX_SPEED)


class AnswerRequest(BaseModel):
    question: str = Field(min_length=2, max_length=400)
    student: str = Field(min_length=1, max_length=40)
    topic: str = Field(min_length=2, max_length=160)
    grade_level: str | None = None
    taught: list[Taught] = Field(default_factory=list, max_length=40)


@router.get("/voices")
async def voices(settings: SettingsDep) -> dict[str, Any]:
    return {
        "voices": settings.speech_voice_list,
        "labels": {v: VOICE_NOTES.get(v, v) for v in settings.speech_voice_list},
        "models": settings.speech_model_list,
        "voice": settings.speech_voice,
        "model": settings.speech_model,
        "speed": settings.speech_speed,
        "min_speed": MIN_SPEED,
        "max_speed": MAX_SPEED,
    }


@router.post("/voice-lab/lesson", dependencies=[Depends(limit_generate)])
async def lesson(body: LessonRequest, lab: VoiceLabDep) -> dict[str, Any]:
    try:
        made = await lab.lesson(body.topic, grade_for(body.grade_level), body.students)
    except (LessonUnavailable, GenerationUnavailable) as exc:
        raise UpstreamError("The lesson could not be written. Try again in a moment.") from exc
    return {
        "title": made.title,
        "beats": [beat.as_dict() for beat in made.beats],
        "recap": made.recap,
        "seconds": made.seconds,
        "problems": list(made.problems),
        "lines": {
            name: {"call": said.call, "thanks": said.thanks, "redirect": said.redirect}
            for name, said in ((n, lines_for(n)) for n in body.students)
        },
    }


@router.post("/speech", dependencies=[Depends(limit_speech)])
async def speech(body: SpeechRequest, narrator: NarratorDep, settings: SettingsDep) -> Response:
    voice = body.voice or settings.speech_voice
    model = body.model or settings.speech_model
    if voice not in settings.speech_voice_list:
        raise ValidationError("That voice is not one of the ones on offer.")
    if model not in settings.speech_model_list:
        raise ValidationError("That voice model is not one of the ones on offer.")
    try:
        audio = await narrator.speak(
            body.text, model=model, voice=voice, speed=body.speed or settings.speech_speed
        )
    except SpeechError as exc:
        raise UpstreamError(str(exc)) from exc
    # The same words in the same voice are the same clip, so the browser may
    # keep it for the length of a lesson.
    return Response(
        audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.post("/voice-lab/answer", dependencies=[Depends(limit_chat)])
async def answer(body: AnswerRequest, lab: VoiceLabDep) -> EventSourceResponse:
    events = lab.answer(
        question=body.question,
        student=_name(body.student) or "friend",
        topic=body.topic,
        grade=_grade(body.grade_level),
        taught=body.taught,
    )
    return EventSourceResponse(_frames(events), ping=15)


class WarmRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=160)
    grade_level: str | None = None
    taught: list[Taught] = Field(default_factory=list, max_length=40)


@router.post("/voice-lab/warm", status_code=204, dependencies=[Depends(limit_chat)])
async def warm(body: WarmRequest, lab: VoiceLabDep) -> Response:
    """Called the moment a hand goes up, so the answer starts quickly."""
    await lab.warm(topic=body.topic, grade=_grade(body.grade_level), taught=body.taught)
    return Response(status_code=204)


def _grade(code: str | None) -> Grade | None:
    return grade_for(code) if code and is_grade(code) else None


async def _frames(events: AsyncIterator[dict[str, Any]]) -> AsyncIterator[dict[str, str]]:
    async for event in events:
        yield {
            "event": str(event.get("type", "message")),
            "data": json.dumps(event, ensure_ascii=False),
        }
