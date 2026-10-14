"""A guide's short quiz (§28.3.8): finishing a study guide unlocks a quiz on
it, made from the guide itself — its checks, and its words to know asked as
"What does … mean?" — so it costs no model call and asks only what was read.

It is a practice set the student owns (`choices.from_guide` is the guide's
set), played in the quiz player with its second chance, and made once:
asking again opens the same quiz.
"""

from __future__ import annotations

import random
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.db.models.attempt import AttemptAnswer
from app.db.models.learning import LearningSet, LearningSetVersion
from app.db.models.user import User
from app.learning.base import Item, Skill
from app.learning.quiz import QuizKind
from app.services.attempt_service import AttemptService

GUIDE_KEY = "from_guide"
QUIZ_SIZE = 8
# What a word question asks, in the guide's language.
ASK = {"en": 'What does "{term}" mean?', "ms": 'Apakah maksud "{term}"?'}
TITLE = {"en": "Quiz: {title}", "ms": "Kuiz: {title}"}
NOT_YET = "Finish every part of the guide first."


async def guide_quiz(session: AsyncSession, student: User, attempt_id: UUID) -> LearningSet:
    """The quiz for the guide this attempt read: made now, or as made before."""
    loaded = await AttemptService(session).loaded(student.id, attempt_id)
    guide = loaded.learning_set
    if guide.kind != "study_guide":
        raise ValidationError("Only a study guide has a quiz like this.")
    answered = await session.scalar(
        select(func.count())
        .select_from(AttemptAnswer)
        .where(AttemptAnswer.attempt_id == attempt_id)
    )
    if (answered or 0) < len(loaded.attempt.plan["order"]):
        raise ValidationError(NOT_YET)
    made = await session.scalar(
        select(LearningSet).where(
            LearningSet.owner_id == student.id,
            LearningSet.purpose == "practice",
            LearningSet.choices[GUIDE_KEY].astext == str(guide.id),
        )
    )
    if made is not None:
        return made
    items = quiz_items(loaded.version.items, guide.language or "en", loaded.version.skills)
    if len(items) < 3:
        raise ValidationError("This guide has too few questions for a quiz.")
    return await _make(session, student, guide, loaded.version, items)


def quiz_items(sections: list[Item], language: str, skills: list[dict[str, Any]]) -> list[Item]:
    """The guide's checks, then its words, as quiz questions: up to
    `QUIZ_SIZE`, in an order of their own."""
    kind = QuizKind()
    known = tuple(Skill(s["slug"], s["label"]) for s in skills if "slug" in s)
    checks = [{**s, "id": f"c{n}"} for n, s in enumerate(sections, start=1)]
    words = _word_questions(sections, language)
    rng = random.Random(" ".join(s.get("id", "") for s in sections))  # noqa: S311 - variety
    asked = [
        found
        for raw in [*checks, *words]
        if (found := kind.normalise(raw, skills=known, source_ids=set(raw.get("source_ids", []))))
    ][:QUIZ_SIZE]
    rng.shuffle(asked)
    return asked


def _word_questions(sections: list[Item], language: str) -> list[Item]:
    # Each word once, from the part it first appears in.
    first = {
        str(t.get("term", "")).lower(): (t, s)
        for s in reversed(sections)
        for t in s.get("terms", [])
        if t.get("meaning")
    }
    terms = list(reversed(first.values()))
    meanings = list(dict.fromkeys(t["meaning"] for t, _ in terms))
    if len(meanings) < 4:
        return []
    ask = ASK.get(language, ASK["en"])
    rng = random.Random(" ".join(meanings))  # noqa: S311 - variety, not a secret
    questions: list[Item] = []
    for n, (term, section) in enumerate(terms, start=1):
        wrong = rng.sample([m for m in meanings if m != term["meaning"]], 3)
        options = rng.sample([term["meaning"], *wrong], 4)
        questions.append(
            {
                "id": f"w{n}",
                "prompt": ask.format(term=term["term"]),
                "options": options,
                "answer": options.index(term["meaning"]),
                "explanation": f"{term['term']}: {term['meaning']}",
                "skill": section.get("skill", "general"),
                "difficulty": "easy",
                "source_ids": section.get("source_ids", []),
            }
        )
    return questions


async def _make(
    session: AsyncSession,
    student: User,
    guide: LearningSet,
    version: LearningSetVersion,
    items: list[Item],
) -> LearningSet:
    language = guide.language or "en"
    quiz = LearningSet(
        owner_id=student.id,
        purpose="practice",
        kind="quiz",
        title=TITLE.get(language, TITLE["en"]).format(title=guide.title)[:200],
        topic=guide.topic,
        subject=guide.subject,
        grade_level=guide.grade_level or student.grade_level,
        language=language,
        status="ready",
        requested_count=len(items),
        current_version=1,
        web_sources=False,
        choices={GUIDE_KEY: str(guide.id)},
    )
    session.add(quiz)
    await session.flush()
    used = {i["skill"] for i in items}
    session.add(
        LearningSetVersion(
            set_id=quiz.id,
            version=1,
            items=items,
            skills=[s for s in version.skills if s.get("slug") in used],
            sources=list(version.sources or []),
            extras={},
        )
    )
    await session.flush()
    return quiz
