"""Class Battle (§28.3.6): questions from a quiz or a game; teams kept even;
every right answer pulls the rope or hits the boss; questions move on by
themselves; a team's spirit at the end, nobody ranked; and who may open,
join, answer and watch."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.battles.hub import BattleHub, battle_hub
from app.battles.questions import Question, battle_questions
from app.battles.room import QUESTION_SECONDS, REVEAL_SECONDS, BattleRoom
from app.db.models.notification import Notification
from tests.play_helpers import shared

QUIZ = [
    {"id": f"q{n}", "prompt": f"Q{n}?", "options": ["a", "b", "c", "d"], "answer": 0,
     "explanation": f"Because {n}."}
    for n in range(1, 7)
]  # fmt: skip
GAME = [
    {"id": "g1", "match": {"pairs": [
        {"id": "p1", "left": "sun", "right": "light"},
        {"id": "p2", "left": "rain", "right": "water"},
        {"id": "p3", "left": "seed", "right": "plant"},
    ]}},
    {"id": "g2", "boss": {"questions": [
        {"id": "b1", "ask": "Boss?", "options": ["x", "y"], "answer": 1},
    ]}},
]  # fmt: skip


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def _room(mode: str = "tug", questions: int = 6, clock: Clock | None = None) -> BattleRoom:
    asked = [Question(f"q{n}", f"Q{n}?", ("a", "b", "c", "d"), 0, "why") for n in range(questions)]
    return BattleRoom(
        id=uuid4(), class_id=uuid4(), teacher_id=uuid4(), title="Plants",
        mode=mode, questions=asked, clock=clock or Clock(),  # type: ignore[arg-type]
    )  # fmt: skip


# --- questions -----------------------------------------------------------------------------


def test_questions_come_from_a_quiz_or_a_game_s_pairs_and_boss() -> None:
    from_quiz = battle_questions("quiz", QUIZ, seed="s")
    assert len(from_quiz) == 6 and {q.why for q in from_quiz} == {
        f"Because {n}." for n in range(1, 7)
    }
    from_game = battle_questions("game", GAME, seed="s")
    asks = {q.ask for q in from_game}
    assert asks == {"sun", "rain", "seed", "Boss?"}
    sun = next(q for q in from_game if q.ask == "sun")
    assert sun.options[sun.answer] == "light" and len(set(sun.options)) == len(sun.options)


# --- teams, the rope and the boss ---------------------------------------------------------


def test_teams_are_kept_even_and_a_player_keeps_theirs() -> None:
    room = _room()
    a, b, c = uuid4(), uuid4(), uuid4()
    teams = [room.join(p, n, None).team for p, n in ((a, "Aina"), (b, "Ben"), (c, "Chen"))]
    assert teams == ["harimau", "kancil", "harimau"]
    assert room.join(b, "Ben", None).team == "kancil"


def test_right_answers_pull_by_a_share_of_the_team_and_five_steps_win() -> None:
    clock = Clock()
    room = _room(questions=12, clock=clock)
    tigers = [uuid4(), uuid4()]
    deer = uuid4()
    room.join(tigers[0], "A", None)
    room.join(deer, "B", None)
    room.join(tigers[1], "C", None)
    room.start()
    room.answer(tigers[0], 0)
    room.answer(deer, 0)
    assert room.rope == pytest.approx(-0.5 + 1)
    assert not room.answer(deer, 0)  # once a question
    for _ in range(11):
        _next(room, clock)
        room.answer(deer, 0)
    _next(room, clock)
    assert room.phase == "done" and room.outcome == "kancil"


def _next(room: BattleRoom, clock: Clock) -> None:
    clock.now += QUESTION_SECONDS
    room.tick()
    clock.now += REVEAL_SECONDS
    room.tick()


def test_the_class_beats_the_boss_together_and_a_miss_costs_nothing() -> None:
    clock = Clock()
    room = _room("boss", questions=4, clock=clock)
    players = [uuid4(), uuid4()]
    for n, p in enumerate(players):
        room.join(p, f"P{n}", None)
    room.start()
    assert room.max_hp == 5  # 4 questions x 2 players x 0.6
    room.answer(players[0], 1)
    assert room.hp == 5
    for _ in range(3):
        for p in players:
            room.answer(p, 0)
        _next(room, clock)
    assert room.phase == "done" and room.outcome == "beaten"


def test_a_question_moves_on_when_everyone_has_answered_or_time_is_up() -> None:
    clock = Clock()
    room = _room(questions=2, clock=clock)
    only = uuid4()
    room.join(only, "Aina", None)
    room.start()
    view = room.view(only)
    assert view["question"]["ask"] == "Q0?" and view["reveal"] is None
    room.answer(only, 2)
    room.tick()
    assert room.phase == "reveal" and room.view(only)["reveal"]["answer"] == 0
    clock.now += REVEAL_SECONDS
    room.tick()
    assert room.phase == "question" and room.at == 1
    clock.now += QUESTION_SECONDS
    room.tick()
    clock.now += REVEAL_SECONDS
    room.tick()
    assert room.phase == "done"


def test_the_end_shows_each_team_s_spirit_and_never_ranks() -> None:
    clock = Clock()
    room = _room(questions=4, clock=clock)
    aina, ben = uuid4(), uuid4()
    room.join(aina, "Aina", None)
    room.join(ben, "Ben", None)
    room.start()
    for right in (False, True, False, True):
        room.answer(aina, 0 if right else 1)
        room.answer(ben, 0)
        _next(room, clock)
    spirit = room.view(aina)["spirit"]
    assert spirit["teams"]["harimau"]["comebacks"] == 2
    assert spirit["teams"]["kancil"]["right"] == 4
    assert spirit["comeback_crew"] == ["Aina"]


# --- over HTTP --------------------------------------------------------------------------------


@pytest.fixture
async def hub():
    fresh = BattleHub()
    yield fresh
    await fresh.close()


def _client(client, user, hub):
    c = client(user)
    c._transport.app.dependency_overrides[battle_hub] = lambda: hub  # noqa: SLF001
    return c


async def test_a_teacher_opens_a_battle_and_the_class_joins_and_answers(
    session, client, teacher, student, account, hub
) -> None:
    assignment = await shared(session, teacher, [student])
    stranger = await account("student")
    body = {"class_id": str(assignment.class_id), "set_id": str(assignment.set_id), "mode": "tug"}
    async with _client(client, teacher, hub) as c:
        opened = await c.post("/api/battles", json=body)
        again = await c.post("/api/battles", json=body)
    battle = opened.json()["id"]
    assert opened.status_code == 200 and again.status_code == 422
    told = await session.scalar(
        select(Notification).where(
            Notification.user_id == student.id, Notification.type == "battle"
        )
    )
    assert told is not None and told.payload["battle_id"] == battle
    async with _client(client, student, hub) as c:
        listed = (await c.get("/api/battles/mine")).json()["items"]
        joined = await c.post(f"/api/battles/{battle}/join")
    assert [b["id"] for b in listed] == [battle] and joined.json()["you"]["team"] == "harimau"
    async with _client(client, teacher, hub) as c:
        started = await c.post(f"/api/battles/{battle}/start")
    assert started.json()["phase"] == "question"
    async with _client(client, student, hub) as c:
        taken = await c.post(f"/api/battles/{battle}/answer", json={"choice": 0})
    assert taken.json() == {"taken": True}
    async with _client(client, stranger, hub) as c:
        refused = await c.post(f"/api/battles/{battle}/join")
    assert refused.status_code == 404


async def test_only_the_teacher_s_own_class_and_sets_make_a_battle(
    session, client, teacher, student, account, hub
) -> None:
    assignment = await shared(session, teacher, [student])
    other = await account("teacher")
    body = {"class_id": str(assignment.class_id), "set_id": str(assignment.set_id), "mode": "boss"}
    async with _client(client, other, hub) as c:
        refused = await c.post("/api/battles", json=body)
    async with _client(client, teacher, hub) as c:
        wrong_mode = await c.post("/api/battles", json={**body, "mode": "chess"})
    assert refused.status_code == 404 and wrong_mode.status_code == 422
