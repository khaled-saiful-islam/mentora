"""What the planner asks the model for: a breakdown to suggest, each part of
the lesson written as spoken segments, a check of those parts against the
sources, and a rewrite when the teacher asks for one."""

from __future__ import annotations

from app.core.grades import Grade
from app.live.prompts import TUTOR_VOICE
from app.live.settings import APPROACHES, DIFFICULTY_RULES, SessionSettings, check_size

SEGMENT_SHAPE = (
    '{"title": "a short title", "key_points": ["under 12 words", "…"], '
    '"beats": [{"say": "…", "show": "…" or null, "pause": "short|breath|think"}], '
    '"checkin": {"question": "…", "options": ["…", "…", "…", "…"], "answer": 0, '
    '"explanation": "one sentence"} or null, '
    '"image_query": "a picture search for this segment, 3 to 6 words, or null"}'
)


NO_SOURCES = "None — teach only what you are sure of."


def _who(grade: Grade | None) -> str:
    return f"{grade.label} students, about {grade.age} years old" if grade else "school students"


def breakdown(
    subject: str, topic: str, grade: Grade | None, difficulty: str, notes: str
) -> tuple[str, str]:
    system = (
        "You plan live lessons for a school teacher. Break a topic into 3 to 6 parts "
        'taught in order, each a short noun phrase of 2 to 6 words ("What plants need", '
        '"Inside a leaf") — never a sentence. Build from simple to harder. Reply with '
        'JSON: {"parts": ["…", "…"]}'
    )
    user = f"Subject: {subject}\nTopic: {topic}\nFor: {_who(grade)}\nLevel: {difficulty}\n" + (
        f"\nThe teacher's materials begin:\n{notes}\n" if notes else ""
    )
    return system, user


def part_system() -> str:
    return (
        TUTOR_VOICE
        + f"""

You are writing ONE PART of a live lesson, as one or more SEGMENTS. A segment is a \
minute or two of speech, made of beats. A beat is 2 to 4 sentences said in one go — \
one small idea. After each beat there is a pause:
- "short": the thought continues straight on,
- "breath": a new idea is coming,
- "think": you asked the room something and give them a moment.

Each beat can put something on the screen ("show"): a key point in under 12 words, a \
tiny worked example, or null. The screen supports what you say; never read it out.

A segment can ask for a picture ("image_query"): 3 to 6 words naming a real thing or \
diagram the room should look at while you talk ("leaf cross section diagram", "Mount \
Kinabalu"). Ask only when seeing it helps them understand. Use null for an idea with \
nothing to see (a rule, a definition, a feeling), and never ask for a person by name. \
Every picture is checked before it is shown; one that does not fit is dropped.

Ground every fact in the SOURCES given. The teacher's own files (ids starting with D) \
come first: teach what they teach, in their words and examples where you can. Web \
sources (ids starting with W) only fill gaps. Never invent a fact the sources do not \
support; if you are unsure, leave it out.

The LAST segment of the part ends with a quick check for the room: say one sentence \
introducing it in the last beat ("Let's see if that's clear — have a look at the \
question on your screen."), and give the question in "checkin": four short options, \
"answer" is the index of the right one. Other segments have "checkin": null.

Reply with one JSON object: {{"segments": [{SEGMENT_SHAPE}]}}"""
    )


def part_user(
    settings: SessionSettings,
    grade: Grade | None,
    *,
    index: int,
    segments: int,
    students: list[str],
    sources: str,
    seconds: int,
) -> str:
    parts = settings.breakdown
    here = parts[index]
    before = f'The part before was "{parts[index - 1]}".' if index > 0 else ""
    after = f'The next part is "{parts[index + 1]}".' if index + 1 < len(parts) else ""
    opening = (
        "This is the very FIRST part: open with a warm hello to the group, say you are "
        "Astra and what today's lesson is about, then begin the story or question that "
        "draws them in."
        if index == 0
        else f"Pick up gently from the part before. {before}"
    )
    closing = (
        "This is the LAST part: after its check, end with a short, warm recap of the "
        "whole lesson and a goodbye."
        if index + 1 == len(parts)
        else f"End by pointing, in one sentence, to what comes next. {after}"
    )
    style = APPROACHES[settings.approach]
    size = check_size(settings.grade_level)
    check = (
        f"The quick check is on screen for only {size.seconds} seconds: its question at most "
        f"{size.question_words} words, each option at most {size.option_words} words."
    )
    words = round(seconds * 2.8)
    names = ", ".join(students) if students else "the group"
    extra = (
        f"\nThe teacher also asks: {settings.custom_instruction}"
        if settings.custom_instruction
        else ""
    )
    return (
        f"Lesson: {settings.topic} ({settings.subject}), for {_who(grade)}.\n"
        f"All the parts, in order: {' → '.join(parts)}.\n"
        f'THIS PART ({index + 1} of {len(parts)}): "{here}".\n'
        f"Write it as {segments} segment{'s' if segments > 1 else ''}, each about {seconds} "
        f"seconds spoken — roughly {words} words and 6 to 9 beats each.\n"
        f"Approach — {style.label}: {style.rules}\n"
        f"Level: {DIFFICULTY_RULES[settings.difficulty]}\n"
        f"Students you may name once or twice, warmly and in passing: {names}.\n"
        f"{check}\n{opening}\n{closing}{extra}\n\n<sources>\n{sources or NO_SOURCES}\n</sources>"
    )


def verify(part: str, grade: Grade | None, written: str, sources: str) -> tuple[str, str]:
    system = (
        "You check a spoken lesson script before a teacher sees it. List real problems "
        "only: a fact that is wrong or not supported by the sources, something unsuitable "
        "for the students' age, something off the part's subject, a check-in question "
        "whose marked answer is wrong. Say each in one sentence the writer can act on. "
        'Reply with JSON: {"problems": ["…"]} — an empty list if it is fine.'
    )
    user = (
        f'Part: "{part}"\nFor: {_who(grade)}\n\n<script>\n{written}\n</script>\n\n'
        f"<sources>\n{sources or 'None given.'}\n</sources>"
    )
    return system, user


def repair(written: str, problems: list[str]) -> str:
    listed = "\n".join(f"- {p}" for p in problems)
    return (
        f"Here is the part you wrote:\n{written}\n\nFix every one of these problems:\n{listed}\n\n"
        "Keep what was good and the same number of segments. Same JSON shape."
    )


def rewrite(written: str, instruction: str) -> str:
    return (
        f"Here is one segment of the lesson:\n{written}\n\n"
        f"The teacher asks you to change it: {instruction or 'make it clearer and more engaging'}\n"
        f'Rewrite that ONE segment. Reply with JSON: {{"segments": [{SEGMENT_SHAPE}]}}'
    )
