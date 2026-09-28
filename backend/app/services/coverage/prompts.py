"""What the coverage map asks a model for: a syllabus to start from, which
topic each taught thing belongs to, and what to teach next."""

from __future__ import annotations

from app.core.grades import Grade


def _who(grade: Grade | None) -> str:
    return f"{grade.label} (about {grade.age} years old)" if grade else "school students"


def draft(subject: str, grade: Grade | None, class_name: str) -> tuple[str, str]:
    system = (
        "You plan a school year for a teacher in Malaysia. Write the year's syllabus "
        "for one subject as 5 to 9 AREAS in the order they are usually taught, each "
        "with 2 to 5 TOPICS. Areas and topics are short noun phrases (2 to 6 words), "
        "never sentences. Follow the Malaysian national curriculum — KSSR for primary, "
        "KSSM for secondary — where you know it; otherwise what is usual for the age. "
        'Reply with JSON: {"areas": [{"title": "…", "topics": ["…", "…"]}]}'
    )
    user = f"Subject: {subject}\nClass: {class_name}\nFor: {_who(grade)}"
    return system, user


def sort(outline: str, items: list[str]) -> tuple[str, str]:
    # Two easy questions rather than one hard one. Asked whether each thing
    # "fits" a topic, a model filed "Living Things", "Scientific Skills" and
    # "The water cycle" nowhere — and which ones changed with the wording. The
    # closest topic always exists, and "is this the same subject?" is plain.
    system = (
        "You sort what a class was taught onto its syllabus. For each numbered thing "
        "taught, give the id of the ONE topic closest to what it teaches, exactly as "
        "written inside the brackets but without them (for example a2t1). There is "
        "always a closest topic: judge by meaning, not shared words — 'How plants make "
        "food' is closest to a photosynthesis or plants topic, 'Scientific skills' to "
        "science process skills, 'The water cycle' to changes of state or matter, and "
        "something named after a whole area to the topic in it that fits best. Then say "
        "whether it is from this class's subject at all: same_subject is false only for "
        "work from another subject entirely, such as a maths quiz on a science "
        "syllabus. Reply with JSON only: "
        '{"links": [{"item": 1, "closest": "a2t1", "same_subject": true}, '
        '{"item": 2, "closest": "a1t3", "same_subject": false}]}'
    )
    listed = "\n".join(f"{n}. {text}" for n, text in enumerate(items, start=1))
    user = f"SYLLABUS (id, area — topic):\n{outline}\n\nTAUGHT:\n{listed}"
    return system, user


def plan(
    grade: Grade | None, status: str, today: str, weeks_left: int, subject: str
) -> tuple[str, str]:
    system = (
        "You help a teacher plan the rest of the school year. Given each topic of the "
        "syllabus with what has been taught and how the class did, suggest up to 6 next "
        "steps, most useful first. Prefer topics not taught yet, in syllabus order, and "
        "topics where the class scored low. Each step is one of: a study guide (to "
        "teach something new), flashcards (for its key words), a quiz (to check it "
        "landed) or a live lesson (at most two in the whole plan — they take the most "
        "time). Mix them. Spread them over the weeks left. Reply with "
        'JSON: {"steps": [{"topic": "a3t1", "kind": "quiz|flashcard|study_guide|live", '
        '"title": "what to make, 3 to 8 words", "when": "this week | next week | in '
        'November", "why": "one short sentence a teacher would say"}]}'
    )
    user = (
        f"Subject: {subject}\nFor: {_who(grade)}\nToday: {today}\n"
        f"Weeks left in the school year: {weeks_left}\n\nTOPICS (id, area — topic: status):\n"
        f"{status}"
    )
    return system, user
