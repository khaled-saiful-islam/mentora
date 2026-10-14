"""A guide's short quiz (§28.3.8): unlocked by finishing every part, made from
the guide's own checks and words to know, and made once."""

from __future__ import annotations

from typing import Any

from app.db.models.learning import LearningSet, LearningSetVersion
from app.events.registry import build_bus
from app.learning.study_guide import StudyGuideKind
from app.services.assignment_service import AssignmentService, ShareSettings
from app.services.guide_quiz import QUIZ_SIZE, quiz_items
from tests.play_helpers import class_with
from tests.test_study_guide import SKILLS, section

KIND = StudyGuideKind()
WORDS = [
    {"term": "vapour", "meaning": "Water as a gas.", "translation": ""},
    {"term": "cloud", "meaning": "Tiny drops floating together.", "translation": ""},
    {"term": "rain", "meaning": "Drops heavy enough to fall.", "translation": ""},
    {"term": "evaporate", "meaning": "To turn from liquid into gas.", "translation": ""},
]


def _sections(n: int = 3) -> list[dict[str, Any]]:
    made = [
        KIND.normalise(section(i, terms=WORDS[i - 1 : i + 1]), skills=SKILLS, source_ids={"s1"})
        for i in range(1, n + 1)
    ]
    return [{**s, "id": f"g{i}"} for i, s in enumerate(made, start=1) if s]


def test_the_quiz_asks_the_checks_then_the_words() -> None:
    items = quiz_items(_sections(), "en", [{"slug": "water-cycle", "label": "Water"}])
    prompts = [i["prompt"] for i in items]
    assert sum(p.startswith("Question") for p in prompts) == 3
    assert any(p == 'What does "vapour" mean?' for p in prompts)
    assert len(items) <= QUIZ_SIZE
    word = next(i for i in items if i["prompt"] == 'What does "vapour" mean?')
    assert len(set(word["options"])) == 4 and word["options"][word["answer"]] == "Water as a gas."
    # A word in two parts is asked once.
    assert prompts.count('What does "cloud" mean?') <= 1


def test_a_guide_in_malay_asks_in_malay_and_too_few_words_ask_none() -> None:
    items = quiz_items(_sections(), "ms", [])
    assert any(i["prompt"].startswith("Apakah maksud") for i in items)
    few = [{**s, "terms": s["terms"][:1]} for s in _sections(2)]
    assert all(i["prompt"].startswith("Question") for i in quiz_items(few, "en", []))


async def _shared_guide(session, teacher, student):
    guide = LearningSet(
        owner_id=teacher.id, purpose="assign", kind="study_guide", title="Rain",
        topic="the water cycle", status="ready", current_version=1, requested_count=3,
    )  # fmt: skip
    session.add(guide)
    await session.flush()
    session.add(
        LearningSetVersion(
            set_id=guide.id,
            version=1,
            items=_sections(),
            skills=[{"slug": s.slug, "label": s.label} for s in SKILLS],
            sources=[],
        )
    )
    await session.flush()
    class_id = await class_with(session, teacher, [student])
    view = await AssignmentService(session, build_bus()).share(
        teacher, guide.id, class_id, ShareSettings()
    )
    return view.assignment


async def test_finishing_a_guide_unlocks_its_quiz_once(session, client, teacher, student) -> None:
    assignment = await _shared_guide(session, teacher, student)
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        early = await c.post(f"/api/me/attempts/{attempt['id']}/guide-quiz")
        for item in attempt["items"]:
            await c.post(
                f"/api/me/attempts/{attempt['id']}/answers",
                json={"item_id": item["id"], "choice": 0, "time_ms": 900},
            )
        made = await c.post(f"/api/me/attempts/{attempt['id']}/guide-quiz")
        again = await c.post(f"/api/me/attempts/{attempt['id']}/guide-quiz")
        played = await c.post(f"/api/me/practice/{made.json()['set_id']}/attempts")
    assert early.status_code == 422
    assert made.status_code == 200 and made.json()["title"] == "Quiz: Rain"
    assert again.json()["set_id"] == made.json()["set_id"]
    assert played.status_code == 200 and played.json()["kind"] == "quiz"
    assert played.json()["second_chance"] is True


async def test_only_a_guide_has_a_guide_quiz(session, client, teacher, student) -> None:
    from tests.play_helpers import shared

    quiz = await shared(session, teacher, [student])
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{quiz.id}/attempts")).json()
        refused = await c.post(f"/api/me/attempts/{attempt['id']}/guide-quiz")
    assert refused.status_code == 422
