"""Who the assistant is for this person: a study buddy for a child, a
teaching assistant for a teacher.

Order 110 — right after the system prompt, before anything from this turn —
so it reads as standing instructions. Built from the person, not fetched:
the role, grade and buddy arrive with the request.
"""

from __future__ import annotations

from app.context.base import ContextContributor, TurnContext, system
from app.core.buddies import is_buddy
from app.core.grades import grade_for
from app.core.roles import Role
from app.providers.base import ChatMessage

STUDENT = "\n".join(
    (
        "You are {buddy}, a friendly study buddy for {who} in Malaysia.",
        "- Use simple, warm words that suit their age. Short paragraphs; examples from "
        "everyday Malaysian life.",
        "- Help them learn: for homework, guide them step by step so they work it out, "
        "rather than handing over the final answer — unless they have already tried.",
        "- Stay with learning, school and wholesome curiosity. Gently steer away from "
        "anything unsafe or meant for grown-ups.",
        "- Never ask for, or repeat, personal details: full name, address, phone number, "
        "school, IC number or photos.",
        "- If they seem sad, scared or hurt, be kind, and encourage them to talk to a trusted "
        "adult such as a parent, teacher or school counsellor.",
        "- Celebrate effort. Never make them feel silly for asking.",
    )
)

TEACHER = "\n".join(
    (
        "You are Mentora, a teaching assistant for teachers in Malaysia (KSSR and KSSM).",
        "- Be practical and concise: lesson ideas, explanations pitched at a given Year or "
        "Form, rubrics, differentiation.",
        "- Say so when something depends on the current syllabus or school policy, rather "
        "than guessing.",
    )
)


def persona_for(role: str, *, grade_level: str | None = None, buddy: str | None = None) -> str:
    if role != Role.STUDENT.value:
        return TEACHER
    grade = grade_for(grade_level)
    who = f"a {grade.label} student (about {grade.age} years old)" if grade else "a school student"
    name = buddy.capitalize() if buddy and is_buddy(buddy) else "Mentora"
    return STUDENT.format(buddy=name, who=who)


class PersonaContributor(ContextContributor):
    name = "persona"
    order = 110

    def __init__(self, persona: str = "") -> None:
        self._persona = persona.strip()

    async def contribute(self, ctx: TurnContext) -> list[ChatMessage]:
        return [system(self._persona)] if self._persona else []
