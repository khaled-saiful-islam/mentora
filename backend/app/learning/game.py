"""A simulation game (§24): missions a player reaches by experimenting.

The learning model writes what the game teaches — its missions, checked
against sources like quiz questions, and the story they are told in. Then
`learning/sim/` has a second model write the game itself, one HTML document,
and plays it at two sizes before anybody sees it. A kind that is built this
way says so with `coded = True`; the generator runs the build after the
story (`LearningGenerator._coding`).

A mission is marked from what the game reports through its runtime — reached
or not, and in how many goes. That report comes from code running on the
student's device, so it can be faked by someone determined; the points are
still counted here, from it.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.core.grades import Grade
from app.learning import game_prompts
from app.learning.base import Graded, Item, Skill, clean_text, new_id, pick_skill, pick_sources
from app.learning.enrich import Finishing, Pictures
from app.learning.model import GenerationUnavailable, JsonModel
from app.learning.prompts import audience
from app.learning.quiz import BEST_POINTS, DIFFICULTIES
from app.learning.sim.spec import SimSpec

logger = logging.getLogger(__name__)

# What a maker sees each called — the same names as the app's pickers.
WORLD_LABELS = {
    "rainforest": "Rainforest",
    "reef": "Coral reef",
    "kampung": "Kampung festival",
    "city": "Kuala Lumpur",
    "space": "Space mission",
}
WORLDS = tuple(WORLD_LABELS)
AUTO = "auto"
LEVELS = ("beginner", "intermediate", "advanced")
BUDDY = game_prompts.BUDDY

LIMITS = {
    # A mission's three beats (§25): the idea, its picture, the one control,
    # what Try it asks, the Do it problem.
    "learn": 160,
    "icon": 16,
    "control": 40,
    "guide": 120,
    "goal": 160,
    "win": 240,
    "explanation": 300,
    "hint": 160,
    "title": 80,
    "hook": 600,
    "story_goal": 200,
    "win_line": 320,
    "story": 2000,
    # The story plan (§25): a character, and speech-bubble lines.
    "name": 40,
    "about": 80,
    "who": 40,
    "says": 160,
}
# Lines in a panel, at most: the opening and a beat before a mission; a beat
# after one and the ending.
MOST_LINES = {"opening": 3, "before": 2, "after": 2, "ending": 2}
MOST_BEATS = 8
_EASIEST_FIRST = {"easy": 0, "medium": 1, "hard": 2}
_FILLER = {"the", "a", "an", "its", "your", "to", "of", "and", "big", "small", "little"}
_WIDGETS = {
    *("slider", "button", "switch", "tap", "lever", "knob", "dial", "control", "meter", "bar"),
    *("sliders", "buttons", "switches", "controls"),
}
# What the game's writer is told of each mission: its three beats and check.
_FOR_THE_WRITER = ("id", "learn", "icon", "control", "guide", "goal", "win", "explanation")

# Points (§24.3), counted here from what the game reported — never sent by
# it. A mission reached is worth more the harder it is, and more again on the
# first go; asking the buddy for its hint costs a little. A mission not
# reached scores nothing, never less.
POINTS_MISSION = 100
POINTS_HARDER = {"easy": 0, "medium": 25, "hard": 50}
POINTS_FIRST_GO = 25
POINTS_HINT = 40
# Reached after the buddy showed how (§25): never zero, never the full count.
POINTS_SHOWN = 50
MOST_TRIES = 99


@dataclass(frozen=True, slots=True)
class Answered:
    """One mission's outcome, as points need it."""

    correct: bool
    hinted: bool
    difficulty: str
    # Goes it took, the one that reached it included.
    tries: int = 1
    # Reached after "Show me": the buddy played it first.
    shown: bool = False


class GameKind:
    name = "game"
    label = "Game"
    item_noun = "mission"
    item_noun_plural = "missions"
    default_count = 4
    min_count = 3
    max_count = 6
    # Teachers and parents make games; a student's practice stays quizzes.
    for_students = False
    # Missions build on each other: played in order, never shuffled.
    keeps_order = True
    # A class leaderboard, when the teacher turns one on, ranks best points.
    leaderboard = BEST_POINTS
    finish_label = "Writing the story"
    # The game itself is written as code, after the story (`learning/sim`).
    coded = True
    # Missions are a progression, one idea after another: written in one go,
    # so the writer sees the whole lesson.
    batch = 6
    check_focus = game_prompts.CHECK_FOCUS

    # --- the mission ----------------------------------------------------------

    def normalise(
        self, raw: dict[str, Any], *, skills: tuple[Skill, ...], source_ids: set[str]
    ) -> Item | None:
        goal = clean_text(raw.get("goal"), LIMITS["goal"])
        win = clean_text(raw.get("win"), LIMITS["win"])
        explanation = clean_text(raw.get("explanation"), LIMITS["explanation"])
        learn = clean_text(raw.get("learn"), LIMITS["learn"])
        if goal is None or win is None or explanation is None or learn is None:
            return None
        difficulty = raw.get("difficulty")
        return {
            "id": raw.get("id") if isinstance(raw.get("id"), str) and raw["id"] else new_id(),
            "learn": learn,
            "icon": clean_text(raw.get("icon"), LIMITS["icon"]) or "",
            "control": clean_text(raw.get("control"), LIMITS["control"]) or "",
            "guide": clean_text(raw.get("guide"), LIMITS["guide"]) or "",
            "goal": goal,
            "win": win,
            "explanation": explanation,
            "hint": clean_text(raw.get("hint"), LIMITS["hint"]) or "",
            "skill": pick_skill(raw.get("skill"), skills),
            "difficulty": difficulty if difficulty in DIFFICULTIES else "medium",
            "source_ids": pick_sources(raw.get("source_ids"), source_ids),
        }

    def public(self, item: Item) -> dict[str, Any]:
        """The mission's beats as the child meets them — the idea, its picture,
        the control and what to try, the problem — and whether a hint is there
        to ask for. Not the hint (asking costs points), not the check, not
        what it showed (said once it is reached)."""
        return {
            "id": item["id"],
            "learn": item.get("learn", ""),
            "icon": item.get("icon", ""),
            "control": item.get("control", ""),
            "guide": item.get("guide", ""),
            "goal": item["goal"],
            "has_hint": bool(item.get("hint")),
            "skill": item["skill"],
            "difficulty": item.get("difficulty", "medium"),
        }

    def grade(self, item: Item, response: dict[str, Any]) -> Graded:
        """Reached or not, as the game reported it; what it teaches, either way."""
        return Graded(
            correct=response.get("done") is True,
            reveal={"explanation": item.get("explanation", ""), "goal": item["goal"]},
        )

    def writing_rules(self) -> str:
        return game_prompts.mission_rules(LIMITS)

    def rules_for(self, choices: Mapping[str, Any]) -> str:
        """The rules, set where the game happens and around the maker's story."""
        chosen = self.choices(choices)
        return game_prompts.mission_rules(LIMITS, world=chosen["world"], story=chosen["story"])

    def summary(self, item: Item) -> str:
        # What the next batch is told is already written: the idea and the
        # control as well as the problem, or it writes the idea again (§25).
        return f"{item['learn']} (adds {item['control']}): {item['goal']}"

    def distinct(self, item: Item) -> str:
        """What makes a mission its own (§25): the control it adds. Two
        missions that add the same control teach the same idea twice."""
        words = re.findall(r"[a-z0-9]+", str(item.get("control", "")).lower())
        # The thing controlled, not the widget, and the thing itself, not what
        # it is for: "the sun slider" is "the sun", and "the kuih cutter" is
        # "the cutter".
        core = [w for w in words if w not in _FILLER and w not in _WIDGETS]
        return core[-1] if core else " ".join(w for w in words if w not in _FILLER)

    def arrange(self, items: list[Item]) -> list[Item]:
        """Simplest first, so later missions build on earlier ones. Stable."""
        return sorted(items, key=lambda i: _EASIEST_FIRST.get(i.get("difficulty", ""), 1))

    def points(
        self, answered: Sequence[Answered], *, grade_level: str | None, level: str | None
    ) -> int:
        total = 0
        for answer in answered:
            if not answer.correct:
                continue
            if answer.shown:
                total += POINTS_SHOWN
                continue
            earned = POINTS_MISSION + POINTS_HARDER.get(answer.difficulty, 0)
            if answer.tries <= 1:
                earned += POINTS_FIRST_GO
            if answer.hinted:
                earned -= POINTS_HINT
            total += max(earned, 0)
        return total

    # --- what the maker chose ---------------------------------------------------

    def choices(self, raw: Mapping[str, Any]) -> dict[str, Any]:
        """Where it happens and the maker's own story, cleaned. "auto" lets
        Mentora decide; a long story is cut between words, never refused."""
        return {
            "world": _pick(raw.get("world"), WORLDS, AUTO),
            "story": fit_paragraphs(raw.get("story"), LIMITS["story"]),
        }

    # --- the finishing stage ----------------------------------------------------

    async def illustrate(self, items: list[Item], *, topic: str, pictures: Pictures) -> list[Item]:
        """No pictures: a game draws its own world."""
        return items

    async def wrap(self, model: JsonModel, finishing: Finishing) -> dict[str, Any]:
        """The story. What the maker chose stands over what the model picks; a
        model that cannot answer leaves the maker's story as written."""
        chosen = self.choices(finishing.choices)
        system, user = game_prompts.wrap_game(
            title=finishing.title,
            topic=finishing.topic,
            grade=finishing.grade,
            language=finishing.language,
            level=finishing.level,
            world=chosen["world"],
            story=chosen["story"],
            outline="\n".join(
                f"- id={item['id']}: {item.get('learn', '')} Then: {item['goal']}"
                for item in finishing.items
            ),
        )
        try:
            reply = await model.ask("wrap", system, user, temperature=0.8, max_tokens=900)
        except GenerationUnavailable:
            logger.warning("game story for %r could not be written", finishing.topic)
            reply = _told_as_written(finishing.title, chosen["story"])
        extras = self.normalise_extras({**reply, "authored": bool(chosen["story"])})
        if chosen["world"] != AUTO:
            extras["world"] = chosen["world"]
        return extras

    def normalise_extras(self, raw: Any) -> dict[str, Any]:
        """The story plan and setting from a model or an editor (§25): the
        character, the opening and ending panels, a beat before and after each
        mission. Never raises: what is missing is empty."""
        raw = raw if isinstance(raw, dict) else {}
        story = raw.get("story") if isinstance(raw.get("story"), dict) else {}
        character = raw.get("character") if isinstance(raw.get("character"), dict) else {}
        return {
            "title": fit_text(raw.get("title"), LIMITS["title"]),
            "world": _pick(raw.get("world"), WORLDS, WORLDS[0]),
            "character": {
                "name": fit_text(character.get("name"), LIMITS["name"]),
                "about": fit_text(character.get("about"), LIMITS["about"]),
            },
            "story": {
                "hook": fit_paragraphs(story.get("hook"), LIMITS["hook"]),
                "goal": fit_text(story.get("goal"), LIMITS["story_goal"]),
                "win": fit_text(story.get("win"), LIMITS["win_line"]),
                "opening": _lines(story.get("opening"), MOST_LINES["opening"]),
                "ending": _lines(story.get("ending"), MOST_LINES["ending"]),
            },
            "beats": _beats(raw.get("beats")),
            "authored": raw.get("authored") is True,
        }

    def finish_detail(self, items: list[Item], extras: dict[str, Any]) -> str:
        title = extras.get("title") or "Your game"
        return f"{title} · {WORLD_LABELS.get(str(extras.get('world')), WORLD_LABELS[WORLDS[0]])}"

    # --- the game's code ----------------------------------------------------------

    def sim_spec(
        self,
        *,
        title: str,
        topic: str,
        grade: Grade | None,
        language: str,
        level: str | None,
        items: Sequence[Item],
        extras: Mapping[str, Any],
    ) -> SimSpec:
        """What the game's writer is given: the checked missions, the story and
        the setting — never anything a student typed."""
        story = extras.get("story") if isinstance(extras.get("story"), dict) else {}
        character = extras.get("character") if isinstance(extras.get("character"), dict) else {}
        world = str(extras.get("world") or "")
        return SimSpec(
            title=str(extras.get("title") or title),
            topic=topic,
            audience=audience(grade, language),
            language=language,
            level=level if level in LEVELS else "beginner",
            setting=game_prompts.WORLD_NOTES.get(world, "a Malaysian setting"),
            hook=str(story.get("hook") or ""),
            goal=str(story.get("goal") or ""),
            win=str(story.get("win") or ""),
            character=", ".join(str(character.get(k) or "") for k in ("name", "about")).strip(", "),
            missions=tuple({k: item.get(k, "") for k in _FOR_THE_WRITER} for item in items),
        )


def _lines(value: Any, most: int) -> list[dict[str, str]]:
    """Speech-bubble lines — who says what — from a model or an editor."""
    given = value if isinstance(value, list) else []
    lines = []
    for raw in given:
        if not isinstance(raw, dict):
            continue
        says = fit_text(raw.get("says"), LIMITS["says"])
        if says:
            lines.append({"who": fit_text(raw.get("who"), LIMITS["who"]) or BUDDY, "says": says})
    return lines[:most]


def _beats(value: Any) -> dict[str, dict[str, list[dict[str, str]]]]:
    """A beat before and after each mission, by the mission's id. A model
    writes them as a list; an editor sends them back keyed by id."""
    if isinstance(value, dict):
        given = [{"mission": key, **beat} for key, beat in value.items() if isinstance(beat, dict)]
    else:
        given = (
            [beat for beat in value if isinstance(beat, dict)] if isinstance(value, list) else []
        )
    beats: dict[str, dict[str, list[dict[str, str]]]] = {}
    for beat in given[:MOST_BEATS]:
        mission = beat.get("mission")
        if isinstance(mission, str) and mission:
            beats[mission[:40]] = {
                "before": _lines(beat.get("before"), MOST_LINES["before"]),
                "after": _lines(beat.get("after"), MOST_LINES["after"]),
            }
    return beats


def _told_as_written(title: str, story: str) -> dict[str, Any]:
    """A maker's own story, for when the model that shapes it cannot answer:
    their first paragraph opens the game, their last ends it."""
    parts = [p for p in story.split("\n\n") if p.strip()]
    if not parts:
        return {"title": title}
    return {"title": title, "story": {"hook": parts[0], "win": parts[-1] if len(parts) > 1 else ""}}


# --- cleaning -------------------------------------------------------------------


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
