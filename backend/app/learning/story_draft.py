"""A first story for a game (§23), for its maker to read and edit before the
build — "Draft with AI". The topic is screened like any build's; the draft is
only ever shown back to the person who asked, and is screened again with the
rest of the build once they make the game.
"""

from __future__ import annotations

from app.core.errors import ValidationError
from app.core.grades import grade_for
from app.learning import game_prompts
from app.learning.game import AUTO, LIMITS, WORLDS, fit_paragraphs
from app.learning.generator import REFUSED_TOPIC
from app.learning.model import GenerationUnavailable, JsonModel
from app.moderation.base import Decision
from app.moderation.rules import InputRules


class StoryDrafter:
    def __init__(self, model: JsonModel) -> None:
        self._model = model

    async def draft(
        self,
        *,
        topic: str,
        subject: str | None,
        grade_level: str | None,
        level: str | None,
        language: str,
        world: str,
    ) -> str:
        topic = " ".join(topic.split())
        subject = " ".join((subject or "").split()) or None
        screened = InputRules().screen(" ".join(filter(None, [subject, topic])))
        if screened.decision is Decision.BLOCK:
            raise ValidationError(REFUSED_TOPIC)
        system, user = game_prompts.draft_story(
            topic=topic,
            subject=subject,
            grade=grade_for(grade_level),
            language=language,
            level=level,
            world=world if world in WORLDS else AUTO,
        )
        reply = await self._model.ask("story", system, user, temperature=0.9, max_tokens=700)
        story = fit_paragraphs(reply.get("story"), LIMITS["story"])
        if not story:
            raise GenerationUnavailable("Couldn't draft a story just now. Try again, or write one.")
        return story
