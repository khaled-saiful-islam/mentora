"""A battle room (§28.3.6): who has joined and on which team, the question
being asked, and what each player answered.

Held in memory by one process, like a live lesson's room (`hub.py`). Every
change bumps `version`; each follower — the class screen, each student's
device — waits for the next one and renders its own view of the room.

- **Tug-of-War:** two teams. Every right answer pulls the rope toward its
  team by one step shared across the team (1 / players), so a bigger team
  does not win by being bigger. Five steps wins.
- **Class vs Boss:** one team, the class. Every right answer from anyone is
  a hit; a wrong one costs nothing, so nobody lets the team down alone.

A question ends when everyone has answered or its time is up; the answer
and why show, then the next comes. Nobody is ranked: the end shows each
team's spirit — right answers, comebacks, how much it improved.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID

from app.battles.questions import Question

Mode = Literal["tug", "boss"]
Phase = Literal["lobby", "question", "reveal", "done"]

TEAMS = {"harimau": ("Team Harimau", "🐯"), "kancil": ("Team Kancil", "🦌")}
CLASS = "class"
QUESTION_SECONDS = 20
REVEAL_SECONDS = 5
# Steps from the middle that win a Tug-of-War.
WIN = 5.0
# A boss has as many hits as this share of every player answering every
# question right: beatable together, not by one or two.
BOSS_SHARE = 0.6
LEAST_HP = 4
# Answers a player needs before "improved" means anything.
IMPROVE_AFTER = 4


@dataclass
class Player:
    id: UUID
    name: str
    buddy: str | None
    team: str
    # (question number, right) for each answer given.
    answers: list[tuple[int, bool]] = field(default_factory=list)

    @property
    def comebacks(self) -> int:
        """Right answers straight after a wrong one."""
        marks = [right for _, right in self.answers]
        return sum(1 for before, now in zip(marks, marks[1:], strict=False) if not before and now)

    @property
    def improved(self) -> float | None:
        if len(self.answers) < IMPROVE_AFTER:
            return None
        half = len(self.answers) // 2
        first, second = self.answers[:half], self.answers[half:]
        return _share(second) - _share(first)


def _share(answers: list[tuple[int, bool]]) -> float:
    return sum(1 for _, right in answers if right) / len(answers)


class BattleRoom:
    def __init__(
        self,
        *,
        id: UUID,
        class_id: UUID,
        teacher_id: UUID,
        title: str,
        mode: Mode,
        questions: list[Question],
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.id, self.class_id, self.teacher_id = id, class_id, teacher_id
        self.title, self.mode, self.questions = title, mode, questions
        self._clock = clock
        self.players: dict[UUID, Player] = {}
        self.phase: Phase = "lobby"
        self.at = -1
        self.deadline = 0.0
        self.choices: dict[UUID, int] = {}
        self.rope = 0.0
        self.hp = self.max_hp = 0
        self.outcome: str | None = None
        self.ended_at: float | None = None
        self.version = 0
        self._event = asyncio.Event()

    # --- changes ------------------------------------------------------------------

    def _bump(self) -> None:
        self.version += 1
        event, self._event = self._event, asyncio.Event()
        event.set()

    async def changed(self, version: int) -> None:
        """Returns once the room has moved on from `version`."""
        while self.version == version:
            await self._event.wait()

    # --- joining and starting --------------------------------------------------

    def join(self, user_id: UUID, name: str, buddy: str | None) -> Player:
        """A player, on a team: the smaller one, or the one they were on."""
        known = self.players.get(user_id)
        if known is not None:
            return known
        if self.mode == "boss":
            team = CLASS
        else:
            sizes = {t: self._size(t) for t in TEAMS}
            team = min(TEAMS, key=lambda t: sizes[t])
        player = Player(user_id, name, buddy, team)
        self.players[user_id] = player
        self._bump()
        return player

    def start(self) -> None:
        if self.phase != "lobby" or not self.players:
            raise ValueError("A battle starts in the lobby, with someone to play.")
        if self.mode == "boss":
            every = len(self.questions) * len(self.players)
            self.max_hp = self.hp = max(LEAST_HP, round(every * BOSS_SHARE))
        self._ask_next()

    def _ask_next(self) -> None:
        self.at += 1
        if self.at >= len(self.questions):
            self.finish()
            return
        self.phase = "question"
        self.choices = {}
        self.deadline = self._clock() + QUESTION_SECONDS
        self._bump()

    # --- answering ---------------------------------------------------------------

    def answer(self, user_id: UUID, choice: int) -> bool:
        """A player's answer to the question asked now, once. False when it
        can't be taken: not now, not a player, already answered, no such option."""
        player = self.players.get(user_id)
        question = self.current
        if self.phase != "question" or player is None or question is None:
            return False
        if user_id in self.choices or not 0 <= choice < len(question.options):
            return False
        right = choice == question.answer
        self.choices[user_id] = choice
        player.answers.append((self.at, right))
        if right:
            self._score(player.team)
        self._bump()
        return True

    def _score(self, team: str) -> None:
        if self.mode == "boss":
            self.hp = max(0, self.hp - 1)
            return
        pull = 1 / max(1, self._size(team))
        self.rope = max(-WIN, min(WIN, self.rope + (-pull if team == "harimau" else pull)))

    def _size(self, team: str) -> int:
        return sum(1 for p in self.players.values() if p.team == team)

    @property
    def current(self) -> Question | None:
        return self.questions[self.at] if 0 <= self.at < len(self.questions) else None

    @property
    def decided(self) -> bool:
        if self.mode == "boss":
            return self.max_hp > 0 and self.hp <= 0
        return abs(self.rope) >= WIN - 1e-9

    # --- time ------------------------------------------------------------------------

    def tick(self) -> None:
        """Moves the battle on when it is time: everyone answered or the time
        is up, then the answer shown for a moment, then the next question."""
        now = self._clock()
        everyone = len(self.choices) >= len(self.players)
        if self.phase == "question" and (now >= self.deadline or everyone):
            self._reveal(now)
        elif self.phase == "reveal" and now >= self.deadline:
            if self.decided:
                self.finish()
            else:
                self._ask_next()

    def _reveal(self, now: float) -> None:
        self.phase = "reveal"
        self.deadline = now + REVEAL_SECONDS
        self._bump()

    def skip(self) -> None:
        """The teacher moves on now."""
        if self.phase == "question":
            self._reveal(self._clock())
        elif self.phase == "reveal":
            self.deadline = self._clock()
            self.tick()

    def finish(self) -> None:
        if self.phase == "done":
            return
        self.phase = "done"
        self.ended_at = self._clock()
        if self.mode == "boss":
            self.outcome = "beaten" if self.decided else "escaped"
        else:
            self.outcome = (
                "harimau" if self.rope < -0.5 else "kancil" if self.rope > 0.5 else "draw"
            )
        self._bump()

    # --- what each sees -----------------------------------------------------------

    def view(self, viewer: UUID) -> dict[str, Any]:
        """The room as `viewer` sees it: the teacher everything shared; a
        player also their own team and answer."""
        question = self.current
        shown = self.phase in ("question", "reveal") and question is not None
        view: dict[str, Any] = {
            "id": str(self.id),
            "title": self.title,
            "mode": self.mode,
            "phase": self.phase,
            "version": self.version,
            "number": self.at + 1,
            "total": len(self.questions),
            "seconds_left": max(0, round(self.deadline - self._clock()))
            if self.phase in ("question", "reveal")
            else 0,
            "teams": self._teams(),
            "rope": round(self.rope, 3),
            "win": WIN,
            "hp": self.hp,
            "max_hp": self.max_hp,
            "answered": len(self.choices),
            "players": len(self.players),
            "question": {"ask": question.ask, "options": list(question.options)} if shown else None,
            "reveal": {"answer": question.answer, "why": question.why}
            if self.phase == "reveal" and question
            else None,
            "outcome": self.outcome,
            "spirit": self.spirit() if self.phase == "done" else None,
        }
        player = self.players.get(viewer)
        if player is not None:
            view["you"] = {"team": player.team, "choice": self.choices.get(viewer)}
        return view

    def _teams(self) -> list[dict[str, Any]]:
        names = {CLASS: ("Our class", "🏫")} if self.mode == "boss" else TEAMS
        return [
            {
                "key": key,
                "name": name,
                "icon": icon,
                "members": [
                    {"name": p.name, "buddy": p.buddy}
                    for p in sorted(self.players.values(), key=lambda p: p.name)
                    if p.team == key
                ],
            }
            for key, (name, icon) in names.items()
        ]

    def spirit(self) -> dict[str, Any]:
        """Each team's spirit, and who came back from a miss: alphabetical,
        never ranked."""
        teams = {}
        for team in {p.team for p in self.players.values()}:
            members = [p for p in self.players.values() if p.team == team]
            gains = [p.improved for p in members if p.improved is not None]
            teams[team] = {
                "right": sum(1 for p in members for _, right in p.answers if right),
                "comebacks": sum(p.comebacks for p in members),
                "improved": round(sum(gains) / len(gains), 3) if gains else None,
            }
        crew = sorted(p.name for p in self.players.values() if p.comebacks > 0)
        return {"teams": teams, "comeback_crew": crew}
