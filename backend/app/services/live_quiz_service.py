"""The quiz after a live lesson: written from what was taught, the teacher's
files and the questions the group asked, tagged by the parts the teacher
named, and shared with the group through the ordinary assignment path — so
it notifies, is taken, and lands in strengths and weaknesses like any quiz."""

from __future__ import annotations

import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.live import LiveHand, LiveSession, LiveSessionDocument, LiveTranscriptLine
from app.db.models.user import User
from app.events.bus import EventBus
from app.learning.generator import GenerationRequest
from app.learning.research import Source
from app.live.planner import slug
from app.services.assignment_service import AssignmentService, ShareSettings
from app.services.generation_service import GenerationDraft, GenerationService

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]
TRANSCRIPT_CHARS = 9000
DOCUMENT_CHARS = 3000


class LiveQuizService:
    def __init__(
        self,
        *,
        session_maker: SessionMaker,
        generation: Callable[[], GenerationService],
        bus: Callable[[], EventBus],
    ) -> None:
        self._db = session_maker
        self._generation = generation
        self._bus = bus

    async def make(self, session_id: UUID) -> dict[str, Any] | None:
        async with self._db() as db:
            live = await db.get(LiveSession, session_id)
            if live is None or not (live.settings.get("quiz") or {}).get("enabled", True):
                return None
            teacher = await db.get(User, live.teacher_id)
            if teacher is None:
                return None
            settings = dict(live.settings)
            sources = await self._sources(db, live)
            service = self._generation()
            quiz = settings.get("quiz") or {}
            draft = GenerationDraft(
                kind="quiz",
                topic=str(settings.get("topic", live.title)),
                subject=settings.get("subject"),
                grade_level=settings.get("grade_level"),
                count=int(quiz.get("count", 10)),
            )
            learning_set = await service.begin(db, teacher, draft)
            await db.commit()
            set_id = learning_set.id
        request = GenerationRequest(
            kind="quiz",
            topic=draft.topic,
            subject=draft.subject,
            grade_level=draft.grade_level,
            count=draft.count or 10,
            sources=tuple(sources),
            skills=tuple((slug(p), p[:60]) for p in settings.get("breakdown") or []),
        )
        outcome = None
        async for event in service.events(set_id, request):
            if event.get("type") in ("done", "failed", "refused"):
                outcome = event
        if not outcome or outcome.get("type") != "done":
            logger.warning("the live quiz for %s was not made: %s", session_id, outcome)
            return None
        return await self._share(session_id, set_id, quiz)

    async def _share(
        self, session_id: UUID, set_id: UUID, quiz: dict[str, Any]
    ) -> dict[str, Any] | None:
        async with self._db() as db:
            live = await db.get(LiveSession, session_id)
            teacher = await db.get(User, live.teacher_id) if live else None
            if live is None or teacher is None:
                return None
            due = quiz.get("due_at")
            view = await AssignmentService(db, self._bus()).share(
                teacher,
                set_id,
                live.class_id,
                ShareSettings(
                    group_ids=(live.group_id,),
                    feedback_mode="instant",
                    due_at=datetime.fromisoformat(due) if isinstance(due, str) and due else None,
                ),
            )
            live.quiz_set_id = set_id
            live.assignment_id = view.assignment.id
            await db.commit()
            return {"assignment_id": str(view.assignment.id), "title": view.assignment.title}

    async def _sources(self, db: AsyncSession, live: LiveSession) -> list[Source]:
        lines = (
            await db.execute(
                select(LiveTranscriptLine.speaker, LiveTranscriptLine.text)
                .where(LiveTranscriptLine.session_id == live.id)
                .order_by(LiveTranscriptLine.seq)
            )
        ).all()
        taught = " ".join(text for speaker, text in lines if speaker == "tutor")[:TRANSCRIPT_CHARS]
        asked = (
            (
                await db.execute(
                    select(LiveHand.question).where(
                        LiveHand.session_id == live.id, LiveHand.status == "answered"
                    )
                )
            )
            .scalars()
            .all()
        )
        questions = "; ".join(q for q in asked if q)
        level = (live.settings.get("quiz") or {}).get("difficulty", "intermediate")
        lesson = f"Quiz level: {level}. What the live lesson taught, in order: {taught}" + (
            f"\n\nQuestions the students asked during the lesson: {questions}" if questions else ""
        )
        sources = [
            Source(id="L1", title="The live lesson", url="", host="the lesson", excerpt=lesson)
        ]
        documents = (
            (
                await db.execute(
                    select(LiveSessionDocument).where(LiveSessionDocument.session_id == live.id)
                )
            )
            .scalars()
            .all()
        )
        for n, document in enumerate(documents, start=1):
            sources.append(
                Source(
                    id=f"D{n}",
                    title=document.filename,
                    url="",
                    host="your file",
                    excerpt=document.text[:DOCUMENT_CHARS],
                )
            )
        return sources
