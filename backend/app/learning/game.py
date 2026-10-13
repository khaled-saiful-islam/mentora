"""A game (§26): a treasure map of islands, one idea each, played in Mentora's
own templates.

The learning model writes what each island teaches — its idea, and the round
that makes the child use it: cards to *sort* into baskets, steps to put in
*order*, or pairs to *match*. The rounds themselves are the app's own code
(`frontend/src/features/game/rounds/`), built once and tested like any
screen, so a game never fails to build: only its content is written, and that
is checked like quiz questions are.

Every island also carries a few pairs about its idea. When the round a model
wrote for an island breaks its rules — a card in two baskets, two steps the
same — the island is played as a Match Up of those pairs instead, which fits
any idea.

A round is checked on the student's device, move by move, so its public view
carries what each move needs: the basket each card belongs in, the order of
the steps, the pairs. The points are still counted here, from what the round
reported — which someone determined could fake.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.learning import game_prompts
from app.learning.base import Graded, Item, Skill, clean_text, new_id, pick_skill, pick_sources
from app.learning.enrich import Finishing, Pictures
from app.learning.game_finish import STARTS, names, opening, same_idea, with_boss
from app.learning.game_rounds import PLAY_LABELS, PLAYS, ident, rounds_of
from app.learning.model import GenerationUnavailable, JsonModel
from app.learning.quiz import BEST_POINTS, DIFFICULTIES
from app.observability.context import note

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

# What to do, when the round written for an island could not be kept and it
# is played as a Match Up of its pairs instead.
FALLBACK_TASK = "Join each one to the one it goes with!"

LIMITS = {
    "learn": 160,
    "icon": 16,
    "task": 160,
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
# Lines in a panel, at most: the opening and a beat before an island; a beat
# after one and the ending.
MOST_LINES = {"opening": 3, "before": 2, "after": 2, "ending": 2}
MOST_BEATS = 8
MOST_SLIPS = 40
_EASIEST_FIRST = {"easy": 0, "medium": 1, "hard": 2}

# Points (§24.3), counted here from what the round reported — never sent by
# it. An island cleared is worth more the harder it is, and more again with
# no slip; asking the buddy for its hint costs a little. One not cleared
# scores nothing, never less.
POINTS_MISSION = 100
POINTS_HARDER = {"easy": 0, "medium": 25, "hard": 50}
POINTS_FIRST_GO = 25
POINTS_HINT = 40
# Cleared after the buddy showed a move (§25): never zero, never the full count.
POINTS_SHOWN = 50
MOST_TRIES = 99
STORY_TOKENS = 1800


@dataclass(frozen=True, slots=True)
class Answered:
    """One island's outcome, as points need it."""

    correct: bool
    hinted: bool
    difficulty: str
    # Goes it took: one, and one more for every slip.
    tries: int = 1
    # Cleared after "Show me": the buddy played a move.
    shown: bool = False


class GameKind:
    name = "game"
    label = "Game"
    item_noun = "island"
    item_noun_plural = "islands"
    default_count = 4
    min_count = 3
    max_count = 6
    # Teachers and parents make games; a student's practice stays quizzes.
    for_students = False
    # Islands build on each other: played in order, never shuffled.
    keeps_order = True
    # A class leaderboard, when the teacher turns one on, ranks best points.
    leaderboard = BEST_POINTS
    # The setting that turns games off (`GAMES_ENABLED`).
    switch = "games_enabled"
    finish_label = "Writing the story"
    # Islands are a progression, one idea after another: written in one go,
    # so the writer sees the whole lesson. Each carries its round, so a batch
    # is long.
    batch = 6
    draft_tokens = 9000
    item_tokens = 2400
    check_focus = game_prompts.CHECK_FOCUS

    # --- the island -------------------------------------------------------------

    def normalise(
        self, raw: dict[str, Any], *, skills: tuple[Skill, ...], source_ids: set[str]
    ) -> Item | None:
        learn = clean_text(raw.get("learn"), LIMITS["learn"])
        explanation = clean_text(raw.get("explanation"), LIMITS["explanation"])
        if learn is None or explanation is None:
            return None
        rounds = rounds_of(raw, explanation)
        wanted = raw.get("play")
        play = wanted if wanted in rounds else "match" if "match" in rounds else None
        if play is None:
            return None
        task = clean_text(raw.get("task"), LIMITS["task"]) if play == wanted else None
        if play != wanted:
            logger.info("an island's %r round broke its rules; played as Match Up", wanted)
            note(
                "fell back to Match Up",
                metadata={"wanted": str(wanted)[:20]},
                words={"island": learn},
                warning=True,
            )
        difficulty = raw.get("difficulty")
        return {
            "id": ident(raw.get("id")) or new_id(),
            "learn": learn,
            "icon": clean_text(raw.get("icon"), LIMITS["icon"]) or "",
            "play": play,
            "task": task or FALLBACK_TASK,
            **rounds,
            "explanation": explanation,
            "hint": clean_text(raw.get("hint"), LIMITS["hint"]) or "",
            "skill": pick_skill(raw.get("skill"), skills),
            "difficulty": difficulty if difficulty in DIFFICULTIES else "medium",
            "source_ids": pick_sources(raw.get("source_ids"), source_ids),
        }

    def public(self, item: Item) -> dict[str, Any]:
        """The island as the child meets it: the idea, what to do, and the
        round — with what each move needs to be answered at once, because it
        is answered on the device. Not the hint (asking costs points), not
        the explanation (said once it is cleared). Its pairs come too, played
        or not: the questions of the revision games (§26.8)."""
        play = item.get("play", "match")
        return {
            "id": item["id"],
            "learn": item.get("learn", ""),
            "icon": item.get("icon", ""),
            "play": play,
            "task": item.get("task", ""),
            **({"match": item["match"]} if isinstance(item.get("match"), dict) else {}),
            play: item.get(play, {}),
            "has_hint": bool(item.get("hint")),
            "skill": item["skill"],
            "difficulty": item.get("difficulty", "medium"),
        }

    def grade(self, item: Item, response: dict[str, Any]) -> Graded:
        """Cleared or not, as the round reported it; what it teaches, either way."""
        return Graded(
            correct=response.get("done") is True,
            reveal={"explanation": item.get("explanation", ""), "task": item.get("task", "")},
        )

    def writing_rules(self) -> str:
        return game_prompts.island_rules(LIMITS)

    def rules_for(self, choices: Mapping[str, Any]) -> str:
        """The rules, set where the game happens, around the maker's story, in
        the templates the maker chose."""
        chosen = self.choices(choices)
        return game_prompts.island_rules(
            LIMITS, world=chosen["world"], story=chosen["story"], plays=chosen["plays"]
        )

    def summary(self, item: Item) -> str:
        # What the next batch is told is already written: the idea, so it is
        # not taught twice, and how it was played.
        return f"{item['learn']} ({PLAY_LABELS.get(item.get('play', ''), '')}: {item['task']})"

    def repeats(self, item: Item, other: Item) -> bool:
        """Two islands that teach one idea, in different words (§26.8)."""
        return same_idea(str(item.get("learn", "")), str(other.get("learn", "")))

    def arrange(self, items: list[Item]) -> list[Item]:
        """Simplest first, so later islands build on earlier ones, and a Boss
        Battle last of all: it revises the rest. Within the same difficulty,
        no template twice in a row where another can come between."""
        level = lambda i: (i.get("play") == "boss", _EASIEST_FIRST.get(i.get("difficulty", ""), 1))  # noqa: E731
        return _varied(sorted(items, key=level), level)

    def complete(
        self, items: list[Item], extras: dict[str, Any], finishing: Finishing
    ) -> list[Item]:
        """The game's islands, ending with a Boss Battle (§26.8) even when the
        writer wrote none — made from the islands' own pairs."""
        done = with_boss(
            items,
            world=str(extras.get("world") or ""),
            language=finishing.language,
            grade=finishing.grade.code if finishing.grade else None,
            plays=self.choices(finishing.choices)["plays"],
            most=self.max_count,
        )
        if len(done) > len(items):
            note("Boss Battle added from pairs")
        return done

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
        """Where it happens, the maker's own story, and the templates they
        want ("auto", or none named, lets Mentora decide). A long story is cut
        between words, never refused."""
        return {
            "world": _pick(raw.get("world"), WORLDS, AUTO),
            "story": fit_paragraphs(raw.get("story"), LIMITS["story"]),
            "plays": _plays(raw.get("plays")),
        }

    # --- the finishing stage ----------------------------------------------------

    async def illustrate(self, items: list[Item], *, topic: str, pictures: Pictures) -> list[Item]:
        """No pictures: a round's pieces carry their own emoji."""
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
            names=names(),
            outline="\n".join(
                f"- id={item['id']}: {item.get('learn', '')} "
                f"({PLAY_LABELS.get(item.get('play', ''), '')}: {item.get('task', '')})"
                for item in finishing.items
            ),
        )
        try:
            # A beat before and after each of up to six islands: room for all of it.
            reply = await model.ask("wrap", system, user, temperature=0.8, max_tokens=STORY_TOKENS)
        except GenerationUnavailable:
            reply = {}
        if not reply:
            # Not answered, or not in a shape to read: the maker's own story, if
            # any, and the game's own title — never a game with no name.
            logger.warning("game story for %r could not be written", finishing.topic)
            note("story written from the title", warning=True)
            reply = _told_as_written(finishing.title, chosen["story"])
        # The opening is picked here, not by the writer, which picks the comic
        # nearly every time: games should not all start alike.
        extras = self.normalise_extras(
            {**reply, "start": opening(), "authored": bool(chosen["story"])}
        )
        if chosen["world"] != AUTO:
            extras["world"] = chosen["world"]
        return extras

    def normalise_extras(self, raw: Any) -> dict[str, Any]:
        """The story plan and setting from a model or an editor (§25): the
        character, the opening and ending panels, a beat before and after each
        island. Never raises: what is missing is empty."""
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
            "start": _start(raw.get("start"), str(raw.get("title") or "")),
            "authored": raw.get("authored") is True,
        }

    def finish_detail(self, items: list[Item], extras: dict[str, Any]) -> str:
        title = extras.get("title") or "Your game"
        return f"{title} · {WORLD_LABELS.get(str(extras.get('world')), WORLD_LABELS[WORLDS[0]])}"


# --- the rounds -------------------------------------------------------------------


def _plays(value: Any) -> list[str]:
    """The templates a maker named, in the app's order; none means any."""
    given = value.split(",") if isinstance(value, str) else value if isinstance(value, list) else []
    wanted = {str(v).strip().lower() for v in given}
    return [play for play in PLAYS if play in wanted]


# --- the story ----------------------------------------------------------------------


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
    """A beat before and after each island, by the island's id. A model
    writes them as a list; an editor sends them back keyed by id."""
    if isinstance(value, dict):
        given = [{"mission": key, **beat} for key, beat in value.items() if isinstance(beat, dict)]
    else:
        given = (
            [beat for beat in value if isinstance(beat, dict)] if isinstance(value, list) else []
        )
    beats: dict[str, dict[str, list[dict[str, str]]]] = {}
    for beat in given[:MOST_BEATS]:
        island = beat.get("mission") or beat.get("island")
        if isinstance(island, str) and island:
            beats[island[:40]] = {
                "before": _lines(beat.get("before"), MOST_LINES["before"]),
                "after": _lines(beat.get("after"), MOST_LINES["after"]),
            }
    return beats


def _varied(items: list[Item], level: Any) -> list[Item]:
    """`items` with no template twice in a row, where an island of the same
    difficulty further on can take the second one's place."""
    out = list(items)
    for at in range(1, len(out)):
        if out[at].get("play") != out[at - 1].get("play"):
            continue
        swap = next(
            (n for n in range(at + 1, len(out))
             if level(out[n]) == level(out[at]) and out[n].get("play") != out[at - 1].get("play")),
            None,
        )  # fmt: skip
        if swap is not None:
            out[at], out[swap] = out[swap], out[at]
    return out


def _start(value: Any, title: str) -> str:
    """How the game opens (§26.8): as the writer or the maker chose, or else
    one picked from the title, so games do not all open the same way."""
    if value in STARTS:
        return str(value)
    return STARTS[sum(map(ord, title)) % len(STARTS)]


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
