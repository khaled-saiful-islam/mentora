"""A chat turn's safety checks, kept out of `chat_service.py`.

The turn calls in at four points and knows nothing else:

    screen_question   in _open, before the message is stored — so a phone
                      number a child typed never reaches the database
    hold_or_note      in _prepare — a refused or at-risk message is held back
                      from the model; a redaction is explained
    screen_answer     after _generate — an unsafe answer is withdrawn
    log_flags         after _close — everything that acted, for review
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.registry import build_bus
from app.guards.base import GuardVerdict
from app.moderation.base import KIND_FOR, Decision, Flag, Screening
from app.moderation.gate import HOLDS, ModerationGate
from app.moderation.replies import redacted_note, reply_for, retracted
from app.providers.base import Usage, UsageSource
from app.services.events import ChatEvent, DeltaEvent, GuardEventPayload, RetractEvent
from app.services.moderation_service import ModerationService, Where

if TYPE_CHECKING:
    from app.services.chat_service import TurnState

logger = logging.getLogger(__name__)

SessionMaker = Callable[[], AbstractAsyncContextManager[AsyncSession]]


async def screen_question(gate: ModerationGate | None, text: str) -> Screening | None:
    return await gate.check_input(text) if gate else None


def hold_or_note(state: TurnState) -> list[ChatEvent]:
    """Act on the question's screening. Returns what the person should see."""
    screening = state.screening
    if screening is None or not screening.acted:
        return []
    kind = KIND_FOR.get(screening.decision)
    if kind:
        state.flags.append(Flag.of(kind, "user_input", screening, state.question))
    if screening.decision in HOLDS:
        state.held = reply_for(screening, state.language)
        return []
    if screening.decision is Decision.REDACT:
        return [
            GuardEventPayload(
                source="user_input",
                severity="low",
                rules=("personal_info",),
                evidence=redacted_note(state.language),
            )
        ]
    return []


def note_injection(state: TurnState, verdict: GuardVerdict, text: str) -> None:
    """The injection guard fired: log it alongside everything else."""
    state.flags.append(
        Flag(
            kind="injection",
            source=str(verdict.source),
            severity=verdict.severity.label if verdict.severity.label != "none" else "low",
            rule=",".join(verdict.rules)[:64],
            screen="prompt_injection",
            excerpt=text[:500],
            findings=tuple({"rule": f.rule, "evidence": f.evidence} for f in verdict.findings),
        )
    )


async def held_reply(state: TurnState) -> AsyncIterator[ChatEvent]:
    """The reply to a held message, streamed like any other answer."""
    if state.held is None:
        return
    state.chunks.append(state.held)
    # No model was asked, so nothing was spent — a child's allowance is not
    # charged for being kept safe.
    state.add_usage(Usage(prompt_tokens=0, completion_tokens=0, source=UsageSource.PROVIDER))
    yield DeltaEvent(text=state.held)


def screen_answer(gate: ModerationGate | None, state: TurnState) -> list[ChatEvent]:
    """Withdraw an unsafe answer. The person saw it arrive, so they are told
    it was taken back rather than finding it silently gone on reload."""
    if gate is None or state.held is not None or not state.answer.strip():
        return []
    screening = gate.check_output(state.answer)
    if screening.decision is not Decision.BLOCK:
        return []
    state.flags.append(Flag.of("retracted", "model_output", screening, state.answer))
    notice = retracted(state.language)
    state.chunks = [notice]
    state.retracted = True
    return [RetractEvent(text=notice)]


async def log_flags(
    session_maker: SessionMaker,
    state: TurnState,
    user_message_id: UUID | None,
) -> None:
    if not state.flags:
        return
    answers = [f for f in state.flags if f.source == "model_output"]
    questions = [f for f in state.flags if f.source != "model_output"]
    try:
        async with session_maker() as session:
            log = ModerationService(session, build_bus())
            base = Where(user_id=state.user_id, conversation_id=state.conversation_id)
            await log.record_quietly(questions, _at(base, user_message_id))
            await log.record_quietly(answers, _at(base, state.assistant_id))
    except Exception:  # noqa: BLE001 — the answer is saved; only its log line is lost
        logger.exception("could not log moderation flags for %s", state.assistant_id)


def _at(where: Where, message_id: UUID | None) -> Where:
    return Where(
        user_id=where.user_id, conversation_id=where.conversation_id, message_id=message_id
    )
