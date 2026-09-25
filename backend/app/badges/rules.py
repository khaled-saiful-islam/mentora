"""The badges a single attempt can earn."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from app.badges.base import Award, Context


@dataclass(frozen=True)
class PerfectScore:
    key: str = "perfect_score"
    name: str = "Perfect Score"
    description: str = "Every answer right on a quiz from your teacher."
    hint: str = "Get 100% on a quiz."

    def evaluate(self, ctx: Context) -> Award | None:
        if ctx.kind == "quiz" and ctx.purpose == "assign" and ctx.percent >= 100:
            return Award(self.key, ctx.scope, "100% — not a single slip!")
        return None


@dataclass(frozen=True)
class StarScorer:
    key: str = "star_scorer"
    name: str = "Star Scorer"
    description: str = "90% or more on a quiz from your teacher."
    hint: str = "Score 90% or more on a quiz."

    def evaluate(self, ctx: Context) -> Award | None:
        if ctx.kind == "quiz" and ctx.purpose == "assign" and 90 <= ctx.percent < 100:
            return Award(self.key, ctx.scope, f"{ctx.percent:.0f}% — so close to perfect!")
        return None


@dataclass(frozen=True)
class HotStreak:
    key: str = "hot_streak"
    name: str = "Hot Streak"
    description: str = "Five right answers in a row."
    hint: str = "Answer 5 in a row correctly."

    def evaluate(self, ctx: Context) -> Award | None:
        if ctx.kind == "quiz" and ctx.best_streak >= 5:
            return Award(self.key, ctx.scope, f"{ctx.best_streak} in a row!")
        return None


@dataclass(frozen=True)
class Comeback:
    key: str = "comeback"
    name: str = "Comeback"
    description: str = "Did much better on a second try."
    hint: str = "Improve by 20 points on a retake."

    def evaluate(self, ctx: Context) -> Award | None:
        if (
            ctx.number >= 2
            and ctx.first_percent is not None
            and ctx.percent - ctx.first_percent >= 20
        ):
            gained = ctx.percent - ctx.first_percent
            return Award(self.key, ctx.scope, f"Up {gained:.0f} points from your first try!")
        return None


@dataclass(frozen=True)
class EarlyBird:
    key: str = "early_bird"
    name: str = "Early Bird"
    description: str = "Finished a day or more before it was due."
    hint: str = "Finish something a day before it's due."

    def evaluate(self, ctx: Context) -> Award | None:
        if ctx.due_at is not None and ctx.due_at - ctx.completed_at >= timedelta(days=1):
            return Award(self.key, ctx.scope, "Done well before the deadline.")
        return None


@dataclass(frozen=True)
class CardShark:
    key: str = "card_shark"
    name: str = "Card Shark"
    description: str = "Knew every card in a deck, first time through."
    hint: str = "Know every flashcard in a deck."

    def evaluate(self, ctx: Context) -> Award | None:
        if ctx.kind == "flashcard" and ctx.percent >= 100:
            return Award(self.key, ctx.scope, "Every single card!")
        return None


@dataclass(frozen=True)
class SelfStarter:
    key: str = "self_starter"
    name: str = "Self-Starter"
    description: str = "Finished a practice set you made yourself."
    hint: str = "Make and finish your own practice set."

    def evaluate(self, ctx: Context) -> Award | None:
        if ctx.purpose == "practice" and ctx.practice_completed >= 1:
            return Award(self.key, "", "You practised all on your own!")
        return None


@dataclass(frozen=True)
class PracticePro:
    key: str = "practice_pro"
    name: str = "Practice Pro"
    description: str = "Finished five practice sets."
    hint: str = "Finish 5 practice sets."

    def evaluate(self, ctx: Context) -> Award | None:
        if ctx.purpose == "practice" and ctx.practice_completed >= 5:
            return Award(self.key, "", "Five practice sets done!")
        return None


@dataclass(frozen=True)
class SkillMaster:
    key: str = "skill_master"
    name: str = "Skill Master"
    description: str = "80% or more on one skill, across three sets."
    hint: str = "Master a skill across 3 different sets."

    def evaluate(self, ctx: Context) -> Award | None:
        for tally in ctx.skills:
            if tally.sets >= 3 and tally.total >= 8 and tally.correct / tally.total >= 0.8:
                return Award(self.key, f"skill:{tally.skill}", "A true master of this skill!")
        return None
