"""Playing a game (§26) over HTTP: islands in order with their rounds,
reported by the round and counted here, the pieces put in the wrong place
kept for the teacher, replays to beat your best, and a best-points
leaderboard."""

from __future__ import annotations

from tests.play_helpers import shared


async def play(c, attempt: dict, *, missed: int = 0, hinted: int = 0, tries: int = 1) -> dict:
    """Report every island as its round does — the first `missed` not cleared,
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


# --- playing ---------------------------------------------------------------------


async def test_islands_come_in_order_with_their_rounds_but_not_their_lessons(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=4, shuffle_questions=True)
    async with client(student) as c:
        attempt = await start(c, assignment)
    assert [i["id"] for i in attempt["items"]] == ["g1", "g2", "g3", "g4"]
    first, second = attempt["items"][:2]
    assert not {"explanation", "hint"} & set(first)
    assert first["task"] == "Do task 1!" and first["play"] == "sort"
    # The round, with what each move needs: it is answered on the device.
    assert first["sort"]["cards"][0]["basket"] == "b2"
    assert second["play"] == "order" and "order" in second and "sort" not in second
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


async def test_an_island_cleared_with_slips_earns_no_first_go_bonus(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        done = await play(c, await start(c, assignment), tries=3)
    assert done["attempt"]["points"] == 100 + 125 + 125


async def test_an_island_cleared_after_show_me_still_scores_a_little(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        attempt = await start(c, assignment)
        base = f"/api/me/attempts/{attempt['id']}/answers"
        for item in attempt["items"]:
            shown = item["id"] == "g3"
            report = {
                "item_id": item["id"],
                "done": True,
                "tries": 3 if shown else 1,
                "shown": shown,
            }
            assert (await c.post(base, json=report)).status_code == 200
        done = (await c.post(f"/api/me/attempts/{attempt['id']}/complete")).json()
    # easy and medium on the first go, then the buddy showed the last one.
    assert done["attempt"]["points"] == 125 + 150 + 50


async def test_an_island_not_cleared_scores_nothing_and_still_teaches(
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


async def test_teachers_see_each_island_by_its_task_and_what_was_most_often_wrong(
    session, client, account, teacher, student
) -> None:
    other = await account("student", "Mei")
    assignment = await shared(session, teacher, [student, other], kind="game", n=3)
    for who, slips in ((student, ["c1", "c2"]), (other, ["c2", "nonsense"])):
        async with client(who) as c:
            attempt = await start(c, assignment)
            base = f"/api/me/attempts/{attempt['id']}"
            report = {"item_id": "g1", "done": True, "tries": 3, "slips": slips}
            assert (await c.post(f"{base}/answers", json=report)).is_success
            assert (await c.post(f"{base}/complete")).is_success
    async with client(teacher) as c:
        results = (await c.get(f"/api/assignments/{assignment.id}/results")).json()
    first = next(q for q in results["questions"] if q["item_id"] == "g1")
    assert first["prompt"] == "Do task 1!"
    assert (first["answered"], first["correct"]) == (2, 2)
    assert first["slips"] == [
        {"piece": "Card 1.2 (belongs in Living)", "students": 2},
        {"piece": "Card 1.1 (belongs in Not)", "students": 1},
    ]


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
