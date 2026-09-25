"""Taking a quiz or a deck: the engine, end to end."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.errors import NotFoundError, ValidationError
from app.db.models.attempt import StudentBadge
from app.db.models.notification import Notification
from app.events.registry import build_bus
from app.services.attempt_service import AttemptService
from app.services.leaderboard_service import LeaderboardService
from app.services.play_service import PlayService
from app.services.results_service import ResultsService
from tests.play_helpers import ready_set, right_choice, shared


async def _play(session, student, assignment, *, right: int, ms: int = 1000):
    service = AttemptService(session)
    view = await service.start(student, assignment.id)
    for n, item in enumerate(view.items):
        choice = (
            right_choice(view, item["id"])
            if n < right
            else (right_choice(view, item["id"]) + 1) % 4
        )
        await service.answer(student.id, view.attempt.id, item["id"], {"choice": choice}, ms)
    return await PlayService(session, build_bus()).finish(student, view.attempt.id)


async def test_a_student_never_receives_the_answer_key(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    view = await AttemptService(session).start(student, assignment.id)
    for item in view.items:
        assert "answer" not in item and "explanation" not in item
        assert len(item["options"]) == 4


async def test_instant_feedback_says_right_or_wrong_and_why(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    service = AttemptService(session)
    view = await service.start(student, assignment.id)
    first = view.items[0]["id"]
    right = right_choice(view, first)
    result = await service.answer(
        student.id, view.attempt.id, first, {"choice": (right + 1) % 4}, 900
    )
    assert result.played.correct is False
    assert result.played.reveal == {"answer": right, "explanation": "Because 1."}


async def test_end_of_quiz_mode_keeps_it_secret_until_the_end(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student], feedback_mode="end")
    service = AttemptService(session)
    view = await service.start(student, assignment.id)
    item = view.items[0]["id"]
    result = await service.answer(
        student.id, view.attempt.id, item, {"choice": right_choice(view, item)}, 900
    )
    assert result.played.correct is None
    assert result.played.reveal is None
    assert result.streak == 0
    finished = await PlayService(session, build_bus()).finish(student, view.attempt.id)
    assert finished.view.answered[0].correct is True


async def test_answers_are_stored_in_the_items_own_terms_whatever_the_shuffle(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    finished = await _play(session, student, assignment, right=5)
    assert float(finished.view.attempt.percent) == 100
    results = await ResultsService(session, build_bus()).for_assignment(teacher.id, assignment.id)
    assert all(q.choices[0] == 1 for q in results.questions)  # everyone chose the real option 0


async def test_answering_twice_is_the_first_answer(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    service = AttemptService(session)
    view = await service.start(student, assignment.id)
    item = view.items[0]["id"]
    right = right_choice(view, item)
    first = await service.answer(student.id, view.attempt.id, item, {"choice": right}, 900)
    again = await service.answer(
        student.id, view.attempt.id, item, {"choice": (right + 1) % 4}, 900
    )
    assert first.played.correct is True and again.played.correct is True
    assert again.answered == 1


async def test_a_reload_resumes_the_same_attempt_in_the_same_order(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], shuffle_questions=True)
    service = AttemptService(session)
    first = await service.start(student, assignment.id)
    await service.answer(student.id, first.attempt.id, first.items[0]["id"], {"choice": 0}, 500)
    again = await service.start(student, assignment.id)
    assert again.attempt.id == first.attempt.id
    assert [i["options"] for i in again.items] == [i["options"] for i in first.items]
    assert len(again.answered) == 1


async def test_without_retakes_starting_again_shows_the_finished_one(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student])
    done = await _play(session, student, assignment, right=3)
    again = await AttemptService(session).start(student, assignment.id)
    assert again.attempt.id == done.view.attempt.id
    assert again.can_retake is False


async def test_with_retakes_a_new_attempt_is_numbered_and_a_comeback_earns_a_badge(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], allow_retakes=True)
    await _play(session, student, assignment, right=1)
    second = await _play(session, student, assignment, right=5)
    assert second.view.attempt.number == 2
    assert {b.badge for b in second.badges} >= {"comeback", "perfect_score"}


async def test_finishing_tells_the_teacher_once_and_collapses(session, teacher, account) -> None:
    kids = [await account("student") for _ in range(3)]
    assignment = await shared(session, teacher, kids)
    for kid in kids:
        await _play(session, kid, assignment, right=2)
    notes = (
        (
            await session.execute(
                select(Notification).where(
                    Notification.user_id == teacher.id, Notification.type == "completion"
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(notes) == 1
    assert notes[0].count == 3
    # 2 of 5 right: the latest finisher's score rides along for the pop-up.
    assert (notes[0].payload["percent"], notes[0].payload["kind"]) == (40, "quiz")


async def test_the_leaderboard_ranks_first_tries_and_ties_share_a_place(
    session, teacher, account
) -> None:
    kids = [await account("student", f"Kid {n}") for n in range(4)]
    assignment = await shared(session, teacher, kids)
    for kid, right in zip(kids, [5, 4, 4, 2], strict=True):
        await _play(session, kid, assignment, right=right)
    board = await LeaderboardService(session, build_bus()).for_viewer(teacher, assignment.id)
    assert [e.rank for e in board.entries] == [1, 2, 2, 4]
    assert board.final is False


async def test_a_student_sees_the_top_ten_and_their_own_row(session, teacher, account) -> None:
    kids = [await account("student") for _ in range(12)]
    assignment = await shared(session, teacher, kids)
    for n, kid in enumerate(kids):
        await _play(session, kid, assignment, right=5 - min(n // 3, 4))
    last = kids[-1]
    board = await LeaderboardService(session, build_bus()).for_viewer(last, assignment.id)
    assert len(board.entries) == 10
    assert board.you is not None and board.you.student_id == last.id


async def test_a_student_outside_the_class_cannot_see_the_board(
    session, teacher, student, account
) -> None:
    assignment = await shared(session, teacher, [student])
    stranger = await account("student")
    with pytest.raises(NotFoundError):
        await LeaderboardService(session, build_bus()).for_viewer(stranger, assignment.id)
    with pytest.raises(NotFoundError):
        await AttemptService(session).start(stranger, assignment.id)


async def test_closing_awards_the_podium_exactly_once(session, teacher, account) -> None:
    kids = [await account("student") for _ in range(3)]
    assignment = await shared(session, teacher, kids)
    for kid, right in zip(kids, [5, 4, 3], strict=True):
        await _play(session, kid, assignment, right=right)
    assignment.closed_at = datetime.now(UTC)
    board = LeaderboardService(session, build_bus())
    await board.for_viewer(teacher, assignment.id)
    await board.for_viewer(teacher, assignment.id)
    medals = (
        (
            await session.execute(
                select(StudentBadge.badge).where(
                    StudentBadge.badge.in_(("gold", "silver", "bronze"))
                )
            )
        )
        .scalars()
        .all()
    )
    assert sorted(medals) == ["bronze", "gold", "silver"]


async def test_a_closed_assignment_cannot_be_started(session, teacher, student) -> None:
    assignment = await shared(session, teacher, [student])
    assignment.closed_at = datetime.now(UTC)
    with pytest.raises(ValidationError, match="closed"):
        await AttemptService(session).start(student, assignment.id)


async def test_finishing_late_is_marked(session, teacher, student) -> None:
    assignment = await shared(
        session, teacher, [student], due_at=datetime.now(UTC) + timedelta(hours=1)
    )
    assignment.due_at = datetime.now(UTC) - timedelta(minutes=1)
    finished = await _play(session, student, assignment, right=3)
    assert finished.view.attempt.is_late is True


async def test_flashcards_are_self_marked_and_all_known_is_a_card_shark(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], kind="flashcard", n=4)
    service = AttemptService(session)
    view = await service.start(student, assignment.id)
    for item in view.items:
        result = await service.answer(student.id, view.attempt.id, item["id"], {"knew": True}, 700)
        assert result.played.correct is True
    finished = await PlayService(session, build_bus()).finish(student, view.attempt.id)
    assert "card_shark" in {b.badge for b in finished.badges}
    assert finished.rank is None  # flashcards have no leaderboard


async def test_practice_is_private_and_earns_the_self_starter(session, student, teacher) -> None:
    practice = await ready_set(session, student, purpose="practice", n=3)
    service = AttemptService(session)
    view = await service.start_practice(student, practice.id)
    for item in view.items:
        await service.answer(
            student.id, view.attempt.id, item["id"], {"choice": right_choice(view, item["id"])}, 500
        )
    finished = await PlayService(session, build_bus()).finish(student, view.attempt.id)
    assert "self_starter" in {b.badge for b in finished.badges}
    teacher_notes = (
        (await session.execute(select(Notification).where(Notification.user_id == teacher.id)))
        .scalars()
        .all()
    )
    assert teacher_notes == []
    with pytest.raises(NotFoundError):
        await service.start_practice(teacher, practice.id)


async def test_results_by_question_skill_and_student(session, teacher, account) -> None:
    kids = [await account("student") for _ in range(2)]
    assignment = await shared(session, teacher, kids)
    await _play(session, kids[0], assignment, right=5)
    await _play(session, kids[1], assignment, right=1)
    found = await ResultsService(session, build_bus()).for_assignment(teacher.id, assignment.id)
    assert [s.first for s in found.students] == [100.0, 20.0]
    assert found.average == 60.0
    assert sum(found.distribution) == 2
    assert len(found.heat) == 2


async def test_insights_find_a_strength_and_something_to_practise(
    session, teacher, student
) -> None:
    assignment = await shared(session, teacher, [student], n=6, allow_retakes=True)
    service = AttemptService(session)
    view = await service.start(student, assignment.id)
    for item in view.items:
        right = right_choice(view, item["id"])
        skill = next(i for i in view.items if i["id"] == item["id"])["skill"]
        choice = right if skill == "light" else (right + 1) % 4
        await service.answer(student.id, view.attempt.id, item["id"], {"choice": choice}, 500)
    await PlayService(session, build_bus()).finish(student, view.attempt.id)
    insights = await ResultsService(session, build_bus()).insights(student.id)
    assert [s["slug"] for s in insights["strengths"]] == ["light"]
    assert [s["slug"] for s in insights["practise"]] == ["water"]
