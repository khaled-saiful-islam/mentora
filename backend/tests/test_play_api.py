"""The play and results routes, over HTTP."""

from __future__ import annotations

from tests.play_helpers import shared


async def test_a_student_plays_a_quiz_start_to_finish(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        todo = (await c.get("/api/me/assignments")).json()
        assert [t["status"] for t in todo] == ["todo"]
        assert todo[0]["class_id"] == str(assignment.class_id)
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        assert "answer" not in attempt["items"][0]
        for item in attempt["items"]:
            right = next(n for n, text in enumerate(item["options"]) if text.startswith("Right"))
            answered = await c.post(
                f"/api/me/attempts/{attempt['id']}/answers",
                json={"item_id": item["id"], "choice": right, "time_ms": 800},
            )
            assert answered.json()["played"]["correct"] is True
        done = (await c.post(f"/api/me/attempts/{attempt['id']}/complete")).json()
        home = (await c.get("/api/me/home")).json()
        badges = (await c.get("/api/me/badges")).json()
        results = (await c.get("/api/me/results")).json()
    assert (done["stars"], done["attempt"]["percent"]) == (3, 100.0)
    assert {b["badge"] for b in done["badges"]} >= {"perfect_score", "hot_streak"}
    assert done["rank"]["rank"] == 1
    assert home["todo"] == [] and home["streak"] == 1 and home["badges"] >= 2
    assert {"gold", "perfect_score"} <= {b["badge"] for b in badges["catalog"]}
    assert results["attempts"][0]["percent"] == 100.0


async def test_an_answer_needs_exactly_one_kind_of_response(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        item = attempt["items"][0]["id"]
        both = await c.post(
            f"/api/me/attempts/{attempt['id']}/answers",
            json={"item_id": item, "choice": 0, "knew": True},
        )
        neither = await c.post(f"/api/me/attempts/{attempt['id']}/answers", json={"item_id": item})
    assert both.status_code == neither.status_code == 422


async def test_the_teacher_sees_results_and_the_whole_board(
    session, client, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
        await c.post(f"/api/me/attempts/{attempt['id']}/complete")
    async with client(teacher) as c:
        results = (await c.get(f"/api/assignments/{assignment.id}/results")).json()
        drill = (
            await c.get(f"/api/assignments/{assignment.id}/results/students/{student.id}")
        ).json()
        board = (await c.get(f"/api/assignments/{assignment.id}/leaderboard")).json()
    assert results["summary"]["completed"] == 1
    assert results["assignment"]["class_id"] == str(assignment.class_id)
    assert results["students"][0]["first"] == 0.0
    assert len(drill["attempts"]) == 1
    assert board["enabled"] is True and board["total"] == 1


async def test_roles_are_kept_apart(session, client, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(teacher) as c:
        assert (await c.get("/api/me/assignments")).status_code == 403
        assert (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).status_code == 403
    async with client(student) as c:
        assert (await c.get(f"/api/assignments/{assignment.id}/results")).status_code == 403
        assert (await c.get(f"/api/assignments/{assignment.id}/leaderboard")).status_code == 200


async def test_someone_elses_attempt_is_not_found(
    session, client, teacher, student, account
) -> None:
    assignment = await shared(session, teacher, [student])
    async with client(student) as c:
        attempt = (await c.post(f"/api/me/assignments/{assignment.id}/attempts")).json()
    other = await account("student")
    async with client(other) as c:
        assert (await c.get(f"/api/me/attempts/{attempt['id']}")).status_code == 404
        assert (await c.post(f"/api/me/attempts/{attempt['id']}/complete")).status_code == 404
