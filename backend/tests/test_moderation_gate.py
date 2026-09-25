"""The gate around a student's chat: rules, then the classifier; and the
persona that tells the model who it is talking to."""

from __future__ import annotations

import asyncio

from app.api.deps import get_chat_service
from app.context.persona import PersonaContributor, persona_for
from app.core.config import get_settings
from app.db.models.user import User
from app.moderation.base import Category, Decision, Screening
from app.moderation.classifier import ModelClassifier
from app.moderation.gate import ModerationGate
from app.moderation.replies import reply_for, retracted
from app.providers.base import ChatRequest, Completion, ProviderInfo, Usage, UsageSource


class Answering:
    """A provider that answers a one-shot call with fixed text, or fails."""

    info = ProviderInfo(name="fake", model="fake", base_url="http://fake", supports_tools=False)

    def __init__(self, text: str = "", *, fail: bool = False, delay: float = 0.0) -> None:
        self._text, self._fail, self._delay = text, fail, delay
        self.requests: list[ChatRequest] = []

    async def complete(self, req: ChatRequest) -> Completion:
        self.requests.append(req)
        if self._delay:
            await asyncio.sleep(self._delay)
        if self._fail:
            raise RuntimeError("down")
        return Completion(text=self._text, usage=Usage(1, 1, UsageSource.ESTIMATED))


async def test_the_classifier_decides_only_what_the_rules_could_not() -> None:
    provider = Answering('{"decision": "allow", "category": "biology"}')
    gate = ModerationGate(classifier=ModelClassifier(provider), grade_label="Form 3")

    assert (await gate.check_input("Explain photosynthesis")).decision is Decision.ALLOW
    assert provider.requests == []
    assert (await gate.check_input("what is sex")).decision is Decision.ALLOW
    assert len(provider.requests) == 1
    assert "Form 3" in provider.requests[0].messages[0].content


async def test_the_classifier_can_refuse_or_ask_for_care() -> None:
    blocking = ModerationGate(classifier=ModelClassifier(Answering('{"decision":"block"}')))
    caring = ModerationGate(
        classifier=ModelClassifier(
            Answering('```json\n{"decision":"support","category":"self_harm"}\n```')
        )
    )
    assert (await blocking.check_input("why do people take drugs")).decision is Decision.BLOCK
    cared = await caring.check_input("why do people take drugs")
    assert (cared.decision, cared.category) == (Decision.SUPPORT, Category.SELF_HARM)


async def test_a_classifier_that_fails_or_stalls_lets_the_message_through() -> None:
    for provider in (Answering(fail=True), Answering("not json at all"), Answering(delay=0.2)):
        gate = ModerationGate(classifier=ModelClassifier(provider, timeout=0.05))
        assert (await gate.check_input("what is a condom")).decision is Decision.ALLOW


async def test_without_a_classifier_an_unsure_message_is_allowed() -> None:
    assert (await ModerationGate().check_input("what is sex")).decision is Decision.ALLOW


async def test_a_broken_screen_is_skipped_not_fatal() -> None:
    class Broken:
        name = "broken"

        def screen(self, text: str) -> Screening:
            raise RuntimeError("bug")

    gate = ModerationGate(inputs=(Broken(),), outputs=(Broken(),))
    assert (await gate.check_input("hello")).decision is Decision.ALLOW
    assert gate.check_output("hello").decision is Decision.ALLOW


def test_replies_are_kind_and_in_the_student_s_language() -> None:
    support = Screening(Decision.SUPPORT, "x", Category.SELF_HARM)
    assert "15999" in reply_for(support, "en") and "999" in reply_for(support, "en")
    assert "Talian Kasih" in reply_for(support, "ms") and "awak" in reply_for(support, "ms")
    blocked = reply_for(Screening(Decision.BLOCK, "x", Category.SEXUAL), "en")
    assert "study buddy" in blocked and "15999" not in blocked
    assert retracted("ms").startswith("Alamak")


def test_a_student_s_persona_knows_their_age_and_their_buddy() -> None:
    persona = persona_for("student", grade_level="year_4", buddy="ollie")
    assert "You are Ollie" in persona and "Year 4" in persona and "10 years old" in persona
    assert "personal details" in persona
    assert "You are Mentora" in persona_for("student", grade_level=None, buddy="nobody")
    assert "teaching assistant" in persona_for("teacher")


async def test_the_persona_speaks_right_after_the_system_prompt() -> None:
    contributor = PersonaContributor("Be kind.")
    assert contributor.order == 110
    [message] = await contributor.contribute(None)  # type: ignore[arg-type]
    assert message.content == "Be kind."
    assert await PersonaContributor("").contribute(None) == []  # type: ignore[arg-type]


def test_only_a_student_s_turn_is_screened() -> None:
    settings = get_settings()
    student = User(role="student", username="kid", grade_level="year_3", buddy="momo")
    teacher = User(role="teacher", email="t@example.com")
    assert get_chat_service(settings, student)._gate is not None
    assert get_chat_service(settings, teacher)._gate is None
