"""Playing a simulation game (§24) over HTTP: the game served locked down to
whoever may play it, missions reported by the game and counted here, replays
to beat your best, a best-points leaderboard, and *Change it*."""

from __future__ import annotations

import json
import re
from contextlib import asynccontextmanager

from app.learning.registry import build_learning_kinds
from app.learning.sim.builder import Progress, SimBuilt
from app.learning.sim.runtime import HEADER_POLICY
from app.services.game_service import GameService, change_job
from app.services.jobs import jobs
from tests.play_helpers import GAME_HTML, ready_set, shared, with_game


async def play(c, attempt: dict, *, missed: int = 0, hinted: int = 0, tries: int = 1) -> dict:
    """Report every mission as the game does — the first `missed` not reached,
    a hint asked for the first `hinted`. Returns the finish."""
    base = f"/api/me/attempts/{attempt['id']}"
    for n, item in enumerate(attempt["items"]):
        if n < hinted:
            assert (await c.post(f"{base}/items/{item['id']}/hint")).status_code == 200
        report = {"item_id": item["id"], "done": n >= missed, "tries": tries, "time_ms": 30_000}
        answered = await c.post(f"{base}/answers", json=report)
        assert answered.status_code == 200, answered.text
    return (await c.post(f"{base}/complete")).json()


async def start(c, assignment) -> dict:
    return (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()


def setup_of(html: str) -> dict:
    return json.loads(re.search(r"window\.MENTORA_SETUP=(\{.*?\});</script>", html).group(1))


# --- playing ---------------------------------------------------------------------


async def test_missions_come_in_order_without_their_checks_or_lessons(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=4, shuffle_questions=True)
    async with client(student) as c:
        attempt = await start(c, assignment)
    assert [i["id"] for i in attempt["items"]] == ["g1", "g2", "g3", "g4"]
    assert not {"win", "explanation", "hint"} & set(attempt["items"][0])
    assert attempt["items"][0]["goal"] == "Reach goal 1."
    assert attempt["extras"]["story"]["hook"].startswith("The river has flooded!")


async def test_points_are_counted_here_from_what_the_game_reported(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=4, level="beginner")
    async with client(student) as c:
        attempt = await start(c, assignment)
        assert attempt["level"] == "beginner"
        done = await play(c, attempt, hinted=1)
    # easy, medium, medium, hard, each on the first go: 125 + 150 + 150 + 175;
    # the first hint costs 40.
    assert done["attempt"]["points"] == 600 - 40
    assert done["attempt"]["best_points"] == 560
    assert done["stars"] == 3


async def test_a_mission_reached_after_several_goes_earns_no_first_go_bonus(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        done = await play(c, await start(c, assignment), tries=3)
    assert done["attempt"]["points"] == 100 + 125 + 125


async def test_a_mission_not_reached_scores_nothing_and_still_teaches(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        attempt = await start(c, assignment)
        missed = await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": "g1", "done": False},
        )
    played = missed.json()["played"]
    assert played["correct"] is False
    assert played["reveal"]["explanation"] == "Because 1."


async def test_an_answer_says_exactly_one_thing_and_a_sensible_number_of_goes(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        attempt = await start(c, assignment)
        base = f"/api/me/attempts/{attempt['id']}/answers"
        both = await c.post(base, json={"item_id": "g1", "done": True, "choice": 0})
        neither = await c.post(base, json={"item_id": "g1"})
        silly = await c.post(base, json={"item_id": "g1", "done": True, "tries": 0})
    assert both.status_code == neither.status_code == silly.status_code == 422


async def test_replaying_keeps_your_best_points(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3, allow_retakes=True)
    async with client(student) as c:
        good = await play(c, await start(c, assignment))
        assert good["attempt"]["can_retake"] is True
        worse = await play(c, await start(c, assignment), missed=2)
    assert worse["attempt"]["points"] < good["attempt"]["points"]
    assert worse["attempt"]["best_points"] == good["attempt"]["points"]


async def test_a_game_leaderboard_ranks_each_players_best_points(
    session, client, account, teacher, student
) -> None:
    other = await account("student", "Mei")
    assignment = await shared(
        session, teacher, [student, other], kind="game", n=3, allow_retakes=True
    )
    async with client(student) as c:
        await play(c, await start(c, assignment), missed=2)
        await play(c, await start(c, assignment))
    async with client(other) as c:
        done = await play(c, await start(c, assignment), missed=1)
    async with client(teacher) as c:
        board = (await c.get(f"/api/assignments/{assignment.id}/leaderboard")).json()
    assert board["ranking"] == "best_points"
    assert [e["student_id"] for e in board["entries"]] == [str(student.id), str(other.id)]
    assert board["entries"][0]["points"] > board["entries"][1]["points"]
    assert done["rank"]["rank"] == 2


async def test_finishing_a_game_earns_the_game_badges(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=5)
    async with client(student) as c:
        done = await play(c, await start(c, assignment))
    assert {"game_hero", "three_star_star", "hot_streak"} <= {b["badge"] for b in done["badges"]}


async def test_teachers_see_how_each_mission_went_by_its_goal(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        await play(c, await start(c, assignment), missed=1)
    async with client(teacher) as c:
        results = (await c.get(f"/api/assignments/{assignment.id}/results")).json()
    first = next(q for q in results["questions"] if q["item_id"] == "g1")
    assert first["prompt"] == "Reach goal 1."
    assert (first["answered"], first["correct"]) == (1, 0)


async def test_a_hint_is_given_when_asked_for_and_costs_points_once(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        attempt = await start(c, assignment)
        base = f"/api/me/attempts/{attempt['id']}/items"
        hint = await c.post(f"{base}/g1/hint")
        again = await c.post(f"{base}/g1/hint")
        done = await play(c, attempt)
        late = await c.post(f"{base}/g1/hint")
    assert hint.json() == {"hint": "Think about 1."} == again.json()
    assert done["attempt"]["points"] == (125 - 40) + 150 + 150
    assert late.status_code == 422


# --- serving the game -----------------------------------------------------------------


async def test_a_student_gets_their_own_games_code_locked_down(
    session, client, account, teacher, student
) -> None:
    student.buddy = "momo"
    assignment = await shared(session, teacher, [student], kind="game", n=3, level="advanced")
    await with_game(session, await _set_of(session, assignment))
    async with client(student) as c:
        attempt = await start(c, assignment)
        served = await c.get(f"/api/me/attempts/{attempt['id']}/game")
        replay = await c.get(f"/api/me/attempts/{attempt['id']}/game?only=g2")
    assert served.status_code == 200
    assert served.headers["content-security-policy"] == HEADER_POLICY
    assert served.headers["cache-control"] == "no-store"
    assert served.headers["content-type"].startswith("text/html")
    told = setup_of(served.text)
    assert [m["id"] for m in told["missions"]] == ["g1", "g2", "g3"]
    assert told["buddy"] == "Momo" and told["level"] == "advanced"
    assert "Mentora.demo = function" in served.text
    assert setup_of(replay.text)["missions"] == [{"id": "g2", "goal": "Reach goal 2.", "number": 2}]

    stranger = await account("student", "Not Them")
    async with client(stranger) as c:
        theirs = await c.get(f"/api/me/attempts/{attempt['id']}/game")
    assert theirs.status_code == 404


async def test_a_game_with_no_code_says_so(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        attempt = await start(c, assignment)
        missing = await c.get(f"/api/me/attempts/{attempt['id']}/game")
    assert missing.status_code == 404


async def test_the_maker_plays_their_own_game_and_nobody_else_can(
    session, client, account, teacher, student
) -> None:
    learning_set = await ready_set(session, teacher, kind="game", n=3)
    await with_game(session, learning_set)
    async with client(teacher) as c:
        mine = await c.get(f"/api/learning-sets/{learning_set.id}/game/play")
        status = (await c.get(f"/api/learning-sets/{learning_set.id}/game")).json()
    assert mine.status_code == 200
    assert mine.headers["content-security-policy"] == HEADER_POLICY
    assert len(setup_of(mine.text)["missions"]) == 3
    assert status["revision"] == 1 and status["changing"] is False

    other = await account("teacher", "Other Teacher")
    async with client(other) as c:
        assert (await c.get(f"/api/learning-sets/{learning_set.id}/game/play")).status_code == 404
    async with client(student) as c:
        assert (await c.get(f"/api/learning-sets/{learning_set.id}/game/play")).status_code == 403


async def test_a_quiz_has_no_game_to_play(session, client, teacher) -> None:
    quiz = await ready_set(session, teacher, kind="quiz", n=3)
    async with client(teacher) as c:
        assert (await c.get(f"/api/learning-sets/{quiz.id}/game/play")).status_code == 404


# --- changing it -----------------------------------------------------------------------


async def test_a_change_must_be_said_kindly_and_needs_a_game_writer(
    session, client, teacher, monkeypatch
) -> None:
    # As if no model were set up to write games.
    monkeypatch.setattr("app.api.deps.build_sim_builder", lambda settings: None)
    learning_set = await ready_set(session, teacher, kind="game", n=3)
    await with_game(session, learning_set)
    url = f"/api/learning-sets/{learning_set.id}/game/changes"
    async with client(teacher) as c:
        short = await c.post(url, json={"instruction": "x"})
        unkind = await c.post(url, json={"instruction": "make the buddy say I want to kill myself"})
        fine = await c.post(url, json={"instruction": "make the sun slider bigger"})
    assert short.status_code == 422
    assert unkind.status_code in (403, 422)
    assert fine.status_code == 403


class ChangingBuilder:
    def __init__(self) -> None:
        self.asked: list[str] = []

    async def change(self, html, instruction, spec):
        self.asked.append(instruction)
        yield Progress("Making the change")
        yield SimBuilt(html=html.replace("Game", "Bigger Game"), model="fake",
                       prompt_tokens=50, completion_tokens=20, build_ms=3)  # fmt: skip


async def test_a_change_is_kept_as_a_new_revision_once_it_passes(session, teacher) -> None:
    learning_set = await ready_set(session, teacher, kind="game", n=3)
    await with_game(session, learning_set)

    @asynccontextmanager
    async def same():
        yield session

    builder = ChangingBuilder()
    games = GameService(
        session,
        build_learning_kinds(),
        builder=builder,
        session_maker=same,  # type: ignore[arg-type]
    )
    await games.change(teacher, learning_set.id, "  make the sun   slider bigger ")
    job = jobs.find(change_job(learning_set.id), teacher.id)
    assert job is not None
    await job.task

    latest = await games.latest(learning_set.id)
    assert builder.asked == ["make the sun slider bigger"]
    assert latest.revision == 2 and "Bigger Game" in latest.html
    assert latest.instruction == "make the sun slider bigger"
    assert job.latest == {"type": "done", "set_id": str(learning_set.id), "revision": 2}
    assert GAME_HTML in (await _revision(session, learning_set.id, 1)).html


async def test_a_games_code_counts_against_its_makers_daily_tokens(session, teacher) -> None:
    from app.services.quota import TokenQuota

    before = (await TokenQuota(session).usage(teacher.id, 100_000)).tokens
    learning_set = await ready_set(session, teacher, kind="game", n=3)
    await with_game(session, learning_set)
    after = (await TokenQuota(session).usage(teacher.id, 100_000)).tokens
    batch = (await TokenQuota(session).usage_many({teacher.id: 100_000}))[teacher.id].tokens
    assert after - before == 1000 == batch - before


async def _set_of(session, assignment):
    from app.db.models.learning import LearningSet

    return await session.get(LearningSet, assignment.set_id)


async def _revision(session, set_id, revision):
    from sqlalchemy import select

    from app.db.models.game_document import GameDocument

    return (
        await session.execute(
            select(GameDocument).where(
                GameDocument.set_id == set_id, GameDocument.revision == revision
            )
        )
    ).scalar_one()
