"""The arithmetic of the Daily Quest (§28.3.4): when a skill is due for
review, how a streak counts, and what a class aims for each week. Pure, so it
is tested without a database.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

# Questions in a quest: up to three on skills due for review, the rest new.
QUEST_SIZE = 5
REVIEW_SIZE = 3
# Fewer than this is not a quest worth doing.
SMALLEST_QUEST = 3

# Leitner boxes: a skill done well moves up a box and comes back later; one
# found hard goes back to the first and comes back tomorrow.
REVIEW_AFTER_DAYS: tuple[int, ...] = (1, 2, 4, 7, 14, 30)
TOP_BOX = len(REVIEW_AFTER_DAYS) - 1
WELL = 0.8
HARD = 0.5
# Items with no particular skill have nothing to review.
NO_SKILL = frozenset({"", "general"})

# A streak earns a freeze every week, and holds at most two.
FREEZE_EVERY = 7
MOST_FREEZES = 2

# A class aims for this many quests a student, each week.
CLASS_QUESTS_EACH = 3


def next_box(box: int, share_right: float) -> int:
    if share_right >= WELL:
        return min(TOP_BOX, box + 1)
    if share_right < HARD:
        return 0
    return box


def due_on(box: int, today: date) -> date:
    return today + timedelta(days=REVIEW_AFTER_DAYS[max(0, min(TOP_BOX, box))])


@dataclass(frozen=True, slots=True)
class Streak:
    days: int
    freezes: int
    today_done: bool


def streak_of(active: Iterable[date], today: date) -> Streak:
    """Days in a row with something finished, up to today. A missed day is
    covered by a freeze when there is one — earned every seven days in a row,
    at most two held — so a flu day does not wipe a month. Today unfinished
    breaks nothing yet."""
    days = {day for day in active if day <= today}
    if not days:
        return Streak(0, 0, False)
    streak = freezes = 0
    day = min(days)
    while day <= today:
        if day in days:
            streak += 1
            if streak % FREEZE_EVERY == 0:
                freezes = min(MOST_FREEZES, freezes + 1)
        elif day != today:
            if freezes:
                freezes -= 1
            else:
                streak = 0
        day += timedelta(days=1)
    return Streak(streak, freezes, today in days)


def week_of(day: date) -> tuple[date, date]:
    """Monday to Sunday, the week `day` is in."""
    monday = day - timedelta(days=day.weekday())
    return monday, monday + timedelta(days=6)
