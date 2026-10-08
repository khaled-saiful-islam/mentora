"""Playing a game (§23) over HTTP: chapters in order, points worked out on the
server, replays to beat your best, a best-points leaderboard and game badges."""

from __future__ import annotations

from tests.play_helpers import shared


async def play(
    c, attempt: dict, *, wrong: int = 0, hinted: int = 0, time_ms: int = 5_000, opened: bool = True
) -> dict:
    """Answer every challenge as the game does — open it, ask for a hint for
    the first `hinted`, answer the first `wrong` wrongly. Returns the finish."""
    base = f"/api/me/attempts/{attempt['id']}"
    for n, item in enumerate(attempt["items"]):
        if opened:
            assert (await c.post(f"{base}/items/{item['id']}/open")).status_code == 204
        if n < hinted:
            assert (await c.post(f"{base}/items/{item['id']}/hint")).status_code == 200
        right = next(i for i, text in enumerate(item["options"]) if text.startswith("Right"))
        choice = (right + 1) % len(item["options"]) if n < wrong else right
        answered = await c.post(
            f"{base}/answers", json={"item_id": item["id"], "choice": choice, "time_ms": time_ms}
        )
        assert answered.status_code == 200, answered.text
    return (await c.post(f"{base}/complete")).json()


async def test_a_game_keeps_its_chapters_in_order_and_hides_the_answers(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=6, shuffle_questions=True)
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
    assert [i["id"] for i in attempt["items"]] == ["g1", "g2", "g3", "g4", "g5", "g6"]
    first = attempt["items"][0]
    # Not even the hint: it is asked for, and asking is what costs points.
    assert not {"answer", "explanation", "hint"} & set(first)
    assert attempt["extras"]["story"]["hook"].startswith("The river has flooded!")


async def test_points_are_worked_out_on_the_server_and_a_hint_costs_a_little(
    session, client, teacher, student
) -> None:
    assignment = await shared(
        session, teacher, [student], kind="game", n=6, grade_level="year_4", level="beginner"
    )
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        assert attempt["timer_seconds"] is None and attempt["level"] == "beginner"
        done = await play(c, attempt, hinted=1)
    # easy, easy, medium, medium, hard, hard: 100+100+125+125+150+150 = 750;
    # the combo adds 10+20+30+40+50 = 150; the first hint costs 40.
    assert done["attempt"]["points"] == 750 + 150 - 40
    assert done["attempt"]["best_points"] == 860
    assert done["stars"] == 3


async def test_a_timed_game_pays_a_speed_bonus(session, client, teacher, student) -> None:
    assignment = await shared(
        session, teacher, [student], kind="game", n=3, grade_level="year_2", level="advanced"
    )
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        assert attempt["timer_seconds"] == 30
        quick = await play(c, attempt, time_ms=3_000)
    # Year 2 has 30 s; three seconds in earns 50 × (1 − 3/30) = 45 on each.
    assert quick["attempt"]["points"] == (100 + 45) + (110 + 45) + (145 + 45)


async def test_replaying_keeps_your_best_points(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3, allow_retakes=True)
    async with client(student) as c:
        first = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        good = await play(c, first)
        assert good["attempt"]["can_retake"] is True
        second = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        worse = await play(c, second, wrong=2)
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
        await play(
            c, (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json(), wrong=2
        )
        await play(c, (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json())
    async with client(other) as c:
        done = await play(
            c, (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json(), wrong=1
        )
    async with client(teacher) as c:
        board = (await c.get(f"/api/assignments/{assignment.id}/leaderboard")).json()
    assert board["enabled"] is True
    assert board["ranking"] == "best_points"
    assert [e["student_id"] for e in board["entries"]] == [str(student.id), str(other.id)]
    assert board["entries"][0]["points"] > board["entries"][1]["points"]
    assert done["attempt"]["leaderboard"] is True
    assert done["rank"]["rank"] == 2


async def test_finishing_a_game_earns_the_game_badges(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=5)
    async with client(student) as c:
        done = await play(c, (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json())
    assert {"game_hero", "three_star_star", "hot_streak"} <= {b["badge"] for b in done["badges"]}
    assert "perfect_score" not in {b["badge"] for b in done["badges"]}


async def test_a_quizs_attempt_has_no_points(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        done = await play(c, (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json())
    assert done["attempt"]["points"] is None and done["attempt"]["timer_seconds"] is None


async def test_a_challenge_that_runs_out_of_time_is_wrong_but_still_explained(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3, grade_level="year_4")
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        item = attempt["items"][0]
        late = await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item["id"], "timed_out": True, "time_ms": 20_000},
        )
        both = await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": attempt["items"][1]["id"], "timed_out": True, "choice": 0},
        )
    assert late.status_code == 200, late.text
    played = late.json()["played"]
    assert played["correct"] is False and played["choice"] is None
    assert played["reveal"]["explanation"] == "Because 1."
    assert both.status_code == 422


async def test_a_hint_is_given_when_asked_for_and_only_then_costs_points(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3, level="beginner")
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        base = f"/api/me/attempts/{attempt['id']}/items"
        hint = await c.post(f"{base}/g1/hint")
        again = await c.post(f"{base}/g1/hint")
        missing = await c.post(f"{base}/nope/hint")
        done = await play(c, attempt)
    assert hint.json() == {"hint": "Think about 1."} == again.json()
    assert missing.status_code == 404
    # 100 − 40 for the hint, 110, 145: the hint is counted once.
    assert done["attempt"]["points"] == 60 + 110 + 145


async def test_a_claimed_answer_time_is_never_quicker_than_the_server_saw(
    session, client, teacher, student
) -> None:
    assignment = await shared(
        session, teacher, [student], kind="game", n=3, grade_level="year_4", level="advanced"
    )
    async with client(student) as c:
        unopened = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        done = await play(c, unopened, time_ms=1, opened=False)
    # Never opened, so there is no time the server saw: no speed bonus at all.
    assert done["attempt"]["points"] == 100 + 110 + 145


async def test_a_hint_cannot_be_had_for_a_finished_attempt(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="game", n=3)
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        await play(c, attempt)
        late = await c.post(f"/api/me/attempts/{attempt['id']}/items/g1/hint")
    assert late.status_code == 422
