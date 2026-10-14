"""How a buddy grows, and how a student meets a new one (§28.3.1).

Every number is here and nowhere else. Growth comes only from learning:
finishing work, doing it well, coming back, badges and skills mastered —
never from time spent, and never taken away.
"""

from __future__ import annotations

from app.badges.base import SkillTally

# What each learning moment is worth.
POINTS: dict[str, int] = {
    "finished": 2,  # a quiz, deck, study guide or game, once per set per day
    "stars": 2,  # three stars on a set, once per set
    "day": 1,  # a day with something finished
    "badge": 3,  # any badge
    "skill": 10,  # a skill mastered, once per skill
    "quest": 3,  # today's quest done (§28.3.4), once a day
    "second_chance": 1,  # right on a second chance (§28.3.7), a few a day
}

# Second chances that grow the buddy in one day: enough to reward trying
# again, too few to make getting things wrong on purpose worth it.
SECOND_CHANCES_A_DAY = 5

# The growth at which each stage begins: newborn, little one, young, grown.
STAGE_AT: tuple[int, ...] = (0, 10, 60, 200)
GROWN = len(STAGE_AT) - 1

# Three stars, as the player draws them (`starsFor` in play/session.ts).
THREE_STARS = 90.0

# A skill is mastered as the Skill Master badge says: most answers right,
# often enough, across enough different sets.
MASTERED_SHARE = 0.8
MASTERED_ANSWERS = 8
MASTERED_SETS = 3
# Items with no particular skill are not a skill to master.
NO_SKILL = frozenset({"", "general"})

# A new buddy to meet for every this many badges; the first is free.
BADGES_PER_BUDDY = 3


def stage_for(points: int) -> int:
    return max(stage for stage, at in enumerate(STAGE_AT) if points >= at)


def next_at(points: int) -> int | None:
    """The growth the next stage starts at, or None when grown."""
    stage = stage_for(points)
    return STAGE_AT[stage + 1] if stage < GROWN else None


def mastered(tally: SkillTally) -> bool:
    return (
        tally.skill not in NO_SKILL
        and tally.sets >= MASTERED_SETS
        and tally.total >= MASTERED_ANSWERS
        and tally.correct / tally.total >= MASTERED_SHARE
    )


def buddies_allowed(badges: int, of: int) -> int:
    """How many buddies a student may have met, out of `of`."""
    return min(of, 1 + max(0, badges) // BADGES_PER_BUDDY)


def badges_for_next(badges: int, of: int) -> int | None:
    """Badges still to earn before the next new buddy, or None when all are met."""
    if buddies_allowed(badges, of) >= of:
        return None
    return BADGES_PER_BUDDY - (max(0, badges) % BADGES_PER_BUDDY)
