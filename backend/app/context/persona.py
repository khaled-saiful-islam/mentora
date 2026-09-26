"""Who the assistant is for this person: a study buddy for a child, a
teaching assistant for a teacher, a helper at home for a parent.

Order 110 — right after the system prompt, before anything from this turn —
so it reads as standing instructions. Built from the person, not fetched:
the role, grade and buddy arrive with the request.
"""

from __future__ import annotations

from dataclasses import dataclass

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


PARENT = "\n".join(
    (
        "You are Mentora, a friendly helper for parents and carers in Malaysia who are "
        "supporting their child's learning at home.",
        "- Use plain, warm words, not teacher jargon. Give practical ideas a busy parent can "
        "try tonight: everyday examples from home, the kitchen, the pasar, money and play.",
        "- Know the Malaysian school years: Year 1-6 in primary (KSSR) and Form 1-5 in "
        "secondary (KSSM). Say so when something depends on the school or the current "
        "syllabus, rather than guessing.",
        "- Encourage effort and short, regular practice over long sessions. Suggest reading "
        "together and asking the child to explain what they learned.",
        "- {children}",
        "- Talk about a child's progress only when the parent asks about their own child. "
        "Never mention other children, classmates, or anyone's scores.",
        "- If a parent is worried about their child's wellbeing or safety, answer with care "
        "and suggest talking to the class teacher or the school counsellor.",
        "- You cannot make posters, slides, games or websites here. For practice, suggest "
        "they make a quiz, flashcards or a study guide with Make, and send it home.",
    )
)


@dataclass(frozen=True, slots=True)
class ChildBrief:
    """What the parent's helper knows about one of their children: never a
    score, never anyone else."""

    first_name: str
    grade_label: str | None = None
    strong: tuple[str, ...] = ()
    practise: tuple[str, ...] = ()
    waiting: int = 0
    late: int = 0


def persona_for(
    role: str,
    *,
    grade_level: str | None = None,
    buddy: str | None = None,
    children: tuple[ChildBrief, ...] = (),
) -> str:
    if role == Role.PARENT.value:
        return PARENT.format(children=_children(children))
    if role != Role.STUDENT.value:
        return TEACHER
    grade = grade_for(grade_level)
    who = f"a {grade.label} student (about {grade.age} years old)" if grade else "a school student"
    name = buddy.capitalize() if buddy and is_buddy(buddy) else "Mentora"
    return STUDENT.format(buddy=name, who=who)


def _children(children: tuple[ChildBrief, ...]) -> str:
    if not children:
        return (
            "They have not connected to a child in Mentora yet. They can, with the "
            "6-letter family code from their child's Settings."
        )
    return "Their children in Mentora: " + "; ".join(_brief(c) for c in children) + "."


def _brief(child: ChildBrief) -> str:
    parts = [_plain(child.first_name) + (f" ({child.grade_label})" if child.grade_label else "")]
    if child.strong:
        parts.append("strong at " + ", ".join(_plain(s) for s in child.strong))
    if child.practise:
        parts.append("worth practising " + ", ".join(_plain(s) for s in child.practise))
    if child.waiting:
        pieces = "piece" if child.waiting == 1 else "pieces"
        late = f", {child.late} past due" if child.late else ""
        parts.append(f"{child.waiting} {pieces} of work waiting{late}")
    return " — ".join(parts)


def _plain(text: str) -> str:
    """One line, short: a skill label or a name is data, never instructions."""
    return " ".join(text.split())[:60]


class PersonaContributor(ContextContributor):
    name = "persona"
    order = 110

    def __init__(self, persona: str = "") -> None:
        self._persona = persona.strip()

    async def contribute(self, ctx: TurnContext) -> list[ChatMessage]:
        return [system(self._persona)] if self._persona else []
