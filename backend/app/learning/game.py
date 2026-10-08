"""A story game (§23): challenges a player meets along a story, in a world.

The model writes what changes from game to game — the challenges, checked like
any quiz question, and the story and world they sit in. Mentora's own engine
(`frontend/src/features/game`) plays them, so no model-written code runs on a
child's device and every answer is marked here, on the server.

A game is played in three chapters, easiest challenges first. The engine splits
the challenges between the chapters with `chapter_sizes`, so the story's
chapter intros, written from the same split, lead into the right challenges.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.learning import game_prompts
from app.learning.base import Graded, Item, Skill, clean_text, new_id, pick_skill, pick_sources
from app.learning.enrich import Finishing, Pictures
from app.learning.model import GenerationUnavailable, JsonModel
from app.learning.quiz import BEST_POINTS, DIFFICULTIES, answer_from
from app.live.settings import check_size

logger = logging.getLogger(__name__)

STYLES = ("quest", "runner", "catch", "match")
WORLDS = ("rainforest", "reef", "kampung", "city", "space")
AUTO = "auto"
CHAPTERS = 3
MIN_OPTIONS, MAX_OPTIONS = 2, 4

# Written into and read out of the prompts, so the two cannot drift.
LIMITS = {
    "prompt": 220,
    # Asked for at most `option_target`, so it fits a bubble or a lane; kept
    # up to `option` rather than refused for a few letters over.
    "option_target": 40,
    "option": 60,
    "explanation": 300,
    "hint": 160,
    "title": 80,
    "hook": 600,
    "goal": 200,
    "chapter_title": 60,
    "intro": 320,
    "outro": 240,
    "win": 320,
    "retry": 200,
    "story": 2000,
}
_EASIEST_FIRST = {"easy": 0, "medium": 1, "hard": 2}

# Points (§23), worked out on the server from what was answered — never sent by
# the game. A right answer is worth more the harder it is; a run of them builds
# a combo; a quick one earns a speed bonus when the game is timed; asking the
# buddy for a hint costs a little. A wrong answer scores nothing, never less.
POINTS_RIGHT = 100
POINTS_HARDER = {"easy": 0, "medium": 25, "hard": 50}
POINTS_COMBO_STEP, POINTS_COMBO_MOST = 10, 50
POINTS_SPEED_MOST = 50
POINTS_HINT = 40
# An answer time below this is a game that was not really played, or a clock
# that was not trusted: it earns what a one-second answer does.
QUICKEST_MS = 1_000


@dataclass(frozen=True, slots=True)
class Answered:
    """One answer, as points need it, in the order it was given."""

    correct: bool
    time_ms: int
    hinted: bool
    difficulty: str


class GameKind:
    name = "game"
    label = "Game"
    item_noun = "challenge"
    item_noun_plural = "challenges"
    default_count = 9
    min_count = CHAPTERS
    max_count = 15
    # Teachers and parents make games; a student's practice stays quizzes.
    for_students = False
    # Chapters are played in order, easiest first: never shuffled.
    keeps_order = True
    # A class leaderboard, when the teacher turns one on, ranks each player's
    # best points: a game is made to be played again.
    leaderboard = BEST_POINTS
    finish_label = "Writing the story and building the world"

    # --- the challenge -------------------------------------------------------

    def normalise(
        self, raw: dict[str, Any], *, skills: tuple[Skill, ...], source_ids: set[str]
    ) -> Item | None:
        prompt = clean_text(raw.get("prompt") or raw.get("question"), LIMITS["prompt"])
        options = _options(raw.get("options"))
        answer = answer_from(raw.get("answer"), options) if options else None
        if prompt is None or options is None or answer is None or answer >= len(options):
            return None
        difficulty = raw.get("difficulty")
        return {
            "id": raw.get("id") if isinstance(raw.get("id"), str) and raw["id"] else new_id(),
            "prompt": prompt,
            "options": options,
            "answer": answer,
            "explanation": clean_text(raw.get("explanation"), LIMITS["explanation"]) or "",
            "hint": clean_text(raw.get("hint"), LIMITS["hint"]) or "",
            "skill": pick_skill(raw.get("skill"), skills),
            "difficulty": difficulty if difficulty in DIFFICULTIES else "medium",
            "source_ids": pick_sources(raw.get("source_ids"), source_ids),
        }

    def public(self, item: Item) -> dict[str, Any]:
        """The challenge, and whether a hint is there to ask for — not the
        hint itself: asking is what costs points (`AttemptService.hint`)."""
        return {
            "id": item["id"],
            "prompt": item["prompt"],
            "options": list(item["options"]),
            "has_hint": bool(item.get("hint")),
            "skill": item["skill"],
            "difficulty": item.get("difficulty", "medium"),
        }

    def grade(self, item: Item, response: dict[str, Any]) -> Graded:
        choice = response.get("choice")
        correct = (
            isinstance(choice, int) and not isinstance(choice, bool) and choice == item["answer"]
        )
        return Graded(
            correct=correct,
            reveal={"answer": item["answer"], "explanation": item.get("explanation", "")},
        )

    def writing_rules(self) -> str:
        return game_prompts.challenge_rules(LIMITS)

    def rules_for(self, choices: Mapping[str, Any]) -> str:
        """The rules, with the world each challenge's little scene is set in —
        a rambutan to share in the rainforest, not a pizza — and the maker's
        story, so the challenges belong to the game they are in."""
        chosen = self.choices(choices)
        return game_prompts.challenge_rules(LIMITS, world=chosen["world"], story=chosen["story"])

    def summary(self, item: Item) -> str:
        return item["prompt"]

    def arrange(self, items: list[Item]) -> list[Item]:
        """Easiest first, so the story builds to its boss. Stable: challenges
        of one difficulty keep the order they were written in."""
        return sorted(items, key=lambda i: _EASIEST_FIRST.get(i.get("difficulty", ""), 1))

    # --- points and the timer ------------------------------------------------

    def seconds(self, *, grade_level: str | None, level: str | None) -> int | None:
        """How long a challenge's timer runs: the year's quick-check time
        (30 / 20 / 15 s, as in a live lesson), and none for beginners."""
        if level == "beginner":
            return None
        return check_size(grade_level).seconds

    def points(
        self, answered: Sequence[Answered], *, grade_level: str | None, level: str | None
    ) -> int:
        seconds = self.seconds(grade_level=grade_level, level=level)
        total = streak = 0
        for answer in answered:
            if not answer.correct:
                streak = 0
                continue
            streak += 1
            earned = POINTS_RIGHT + POINTS_HARDER.get(answer.difficulty, 0)
            earned += min(POINTS_COMBO_STEP * (streak - 1), POINTS_COMBO_MOST)
            if seconds:
                taken = max(answer.time_ms, QUICKEST_MS) / (seconds * 1000)
                # Halves round up, as the game's own count does (points.ts).
                earned += int(POINTS_SPEED_MOST * max(0.0, 1 - taken) + 0.5)
            if answer.hinted:
                earned -= POINTS_HINT
            total += max(earned, 0)
        return total

    # --- what the maker chose --------------------------------------------

    def choices(self, raw: Mapping[str, Any]) -> dict[str, Any]:
        """The style, world and story the maker chose, cleaned. "auto" lets
        Mentora decide; a story is kept in its paragraphs, cut between words
        rather than refused when it runs long."""
        return {
            "style": _pick(raw.get("style"), STYLES, AUTO),
            "world": _pick(raw.get("world"), WORLDS, AUTO),
            "story": fit_paragraphs(raw.get("story"), LIMITS["story"]),
        }

    # --- the finishing stage -------------------------------------------------

    async def illustrate(self, items: list[Item], *, topic: str, pictures: Pictures) -> list[Item]:
        """No pictures: a game's world is drawn by the engine, never searched."""
        return items

    async def wrap(self, model: JsonModel, finishing: Finishing) -> dict[str, Any]:
        """The story and world. What the maker chose stands over what the model
        picks; a model that cannot answer leaves a plain story, never no game."""
        chosen = self.choices(finishing.choices)
        system, user = game_prompts.wrap_game(
            title=finishing.title,
            topic=finishing.topic,
            grade=finishing.grade,
            language=finishing.language,
            level=finishing.level,
            style=chosen["style"],
            world=chosen["world"],
            story=chosen["story"],
            outline=_outline(finishing.items),
        )
        try:
            reply = await model.ask("wrap", system, user, temperature=0.8, max_tokens=1400)
        except GenerationUnavailable:
            # The challenges are written and checked; the story can be edited in.
            logger.warning("game story for %r could not be written", finishing.topic)
            reply = _told_as_written(finishing.title, chosen["story"])
        extras = self.normalise_extras({**reply, "authored": bool(chosen["story"])})
        for key in ("style", "world"):
            if chosen[key] != AUTO:
                extras[key] = chosen[key]
        return extras

    def normalise_extras(self, raw: Any) -> dict[str, Any]:
        """A playable story and world from a model or an editor. Never raises:
        a missing part is empty, a missing chapter a plain one, an unknown style
        or world the first of its list."""
        raw = raw if isinstance(raw, dict) else {}
        story = raw.get("story") if isinstance(raw.get("story"), dict) else {}
        return {
            "title": fit_text(raw.get("title"), LIMITS["title"]),
            "style": _pick(raw.get("style"), STYLES, STYLES[0]),
            "world": _pick(raw.get("world"), WORLDS, WORLDS[0]),
            "story": {
                "hook": fit_paragraphs(story.get("hook"), LIMITS["hook"]),
                "goal": fit_text(story.get("goal"), LIMITS["goal"]),
                "chapters": _chapters(story.get("chapters")),
                "win": fit_text(story.get("win"), LIMITS["win"]),
                "retry": fit_text(story.get("retry"), LIMITS["retry"]),
            },
            "authored": raw.get("authored") is True,
        }

    def finish_detail(self, items: list[Item], extras: dict[str, Any]) -> str:
        title = extras.get("title") or "Your game"
        return f"{title} · {extras.get('style', STYLES[0])} · {extras.get('world', WORLDS[0])}"


def _told_as_written(title: str, story: str) -> dict[str, Any]:
    """A maker's own story, laid out by its paragraphs, for when the model
    that shapes it cannot answer: their words are kept, never dropped."""
    parts = [p for p in story.split("\n\n") if p.strip()]
    if not parts:
        return {"title": title}
    hook, *rest = parts
    return {
        "title": title,
        "story": {
            "hook": hook,
            "chapters": [{"intro": intro} for intro in rest[:CHAPTERS]],
            "win": rest[CHAPTERS] if len(rest) > CHAPTERS else "",
        },
    }


# --- chapters -----------------------------------------------------------------


def chapter_sizes(count: int) -> list[int]:
    """How many challenges each chapter has: as even as it goes, the extra
    ones in the earlier, easier chapters. The engine splits them the same way."""
    base, extra = divmod(max(0, count), CHAPTERS)
    return [base + (1 if n < extra else 0) for n in range(CHAPTERS)]


def _outline(items: tuple[Item, ...]) -> str:
    lines: list[str] = []
    start = 0
    for number, size in enumerate(chapter_sizes(len(items)), start=1):
        lines.append(f"Chapter {number}:")
        lines.extend(f"- {item['prompt']}" for item in items[start : start + size])
        start += size
    return "\n".join(lines)


def _chapters(value: Any) -> list[dict[str, str]]:
    given = value if isinstance(value, list) else []
    chapters: list[dict[str, str]] = []
    for number in range(1, CHAPTERS + 1):
        found = given[number - 1] if number <= len(given) else None
        raw = found if isinstance(found, dict) else {}
        title = fit_text(raw.get("title"), LIMITS["chapter_title"])
        chapters.append(
            {
                "title": title or f"Chapter {number}",
                "intro": fit_text(raw.get("intro"), LIMITS["intro"]),
                "outro": fit_text(raw.get("outro"), LIMITS["outro"]),
            }
        )
    return chapters


# --- cleaning -------------------------------------------------------------------


def _options(value: Any) -> list[str] | None:
    if not isinstance(value, list) or not MIN_OPTIONS <= len(value) <= MAX_OPTIONS:
        return None
    options = [clean_text(v, LIMITS["option"]) for v in value]
    if any(o is None for o in options):
        return None
    if len({o.lower() for o in options}) != len(options):  # type: ignore[union-attr]
        return None
    return options  # type: ignore[return-value]


def _pick(value: Any, allowed: tuple[str, ...], fallback: str) -> str:
    wanted = value.strip().lower() if isinstance(value, str) else ""
    return wanted if wanted in allowed or wanted == fallback else fallback


def fit_text(value: Any, limit: int) -> str:
    """One line of tidied text within `limit`: cut at the last sentence end
    that fits, else between words. Empty when absent."""
    if not isinstance(value, str):
        return ""
    return _fit(" ".join(value.split()), limit)


def fit_paragraphs(value: Any, limit: int) -> str:
    """Like `fit_text`, keeping paragraphs apart with a blank line."""
    if not isinstance(value, str):
        return ""
    paragraphs = [" ".join(part.split()) for part in value.replace("\r", "").split("\n")]
    return _fit("\n\n".join(p for p in paragraphs if p), limit)


def _fit(text: str, limit: int) -> str:
    """`text` within `limit`: cut at the last paragraph or sentence that ends
    inside it, else between words — never mid-word, never on a blank line."""
    if len(text) <= limit:
        return text
    cut = text[: limit + 1]  # one more, so a word ending exactly at the limit stays
    paragraph = cut.rfind("\n\n")
    if paragraph > limit // 2:
        return cut[:paragraph].rstrip()
    sentence = max(cut.rfind(end) for end in (". ", "! ", "? ", ".\n", "!\n", "?\n"))
    if sentence > limit // 2:
        return cut[: sentence + 1].rstrip()
    words = cut[:limit].rsplit(None, 1)[0] if " " in cut[:limit] else cut[:limit]
    return words.rstrip()
