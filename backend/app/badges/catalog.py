"""Every badge there is: the attempt rules, and the three places on a podium."""

from __future__ import annotations

from dataclasses import dataclass

from app.badges.base import BadgeRule
from app.badges.rules import (
    Bookworm,
    CardShark,
    Comeback,
    EarlyBird,
    HotStreak,
    PerfectScore,
    PracticePro,
    SelfStarter,
    SkillMaster,
    StarScorer,
)


@dataclass(frozen=True, slots=True)
class BadgeInfo:
    key: str
    name: str
    description: str
    hint: str


RULES: tuple[BadgeRule, ...] = (
    PerfectScore(),
    StarScorer(),
    HotStreak(),
    Comeback(),
    EarlyBird(),
    CardShark(),
    Bookworm(),
    SelfStarter(),
    PracticePro(),
    SkillMaster(),
)

# Awarded when a quiz's leaderboard is final (closed, or past its due date).
PODIUM: tuple[BadgeInfo, ...] = (
    BadgeInfo("gold", "Gold Medal", "First place on a class quiz.", "Top the leaderboard."),
    BadgeInfo(
        "silver", "Silver Medal", "Second place on a class quiz.", "Come second on a leaderboard."
    ),
    BadgeInfo(
        "bronze", "Bronze Medal", "Third place on a class quiz.", "Come third on a leaderboard."
    ),
)

CATALOG: dict[str, BadgeInfo] = {
    **{info.key: info for info in PODIUM},
    **{r.key: BadgeInfo(r.key, r.name, r.description, r.hint) for r in RULES},
}
