"""Fixing a game by its lines (§24): edits that must each match exactly once,
or none are made; and the document found in a reply, whole or not."""

from __future__ import annotations

from app.learning.sim.edits import apply, document_of, is_whole, joined, parse

GAME = "<!DOCTYPE html><html><body>\nlet sun = 10;\nlet water = 5;\n</body></html>"


def edit(search: str, replace: str) -> str:
    return f"<<<<<<< SEARCH\n{search}\n=======\n{replace}\n>>>>>>> REPLACE"


def test_edits_are_read_from_a_reply_and_made_in_order() -> None:
    reply = (
        "Here you go:\n"
        + edit("let sun = 10;", "let sun = 80;")
        + "\n"
        + edit("let water = 5;", "let water = 50;")
    )
    found = parse(reply)
    assert found == [("let sun = 10;", "let sun = 80;"), ("let water = 5;", "let water = 50;")]
    assert apply(GAME, found) == GAME.replace("10", "80").replace("= 5;", "= 50;")


def test_an_edit_that_does_not_match_exactly_once_means_none_are_made() -> None:
    assert apply(GAME, [("let sun = 10;", "x"), ("let moon = 1;", "y")]) is None
    twice = GAME.replace("let water = 5;", "let sun = 10;")
    assert apply(twice, [("let sun = 10;", "x")]) is None
    assert apply(GAME, []) is None
    assert apply(GAME, [("   ", "x")]) is None


def test_the_document_is_found_in_a_reply_and_its_wholeness_judged() -> None:
    said = f"Sure! Here is the game:\n{GAME}\nHope it helps."
    assert document_of(said) == GAME
    assert is_whole(GAME)
    assert not is_whole("<!DOCTYPE html><html><body>let sun = ")
    assert not is_whole("<html></html>")


def test_a_cut_off_game_and_its_continuation_join_without_the_repeated_line() -> None:
    start = "<!DOCTYPE html><html><body>\nlet sun = 10;\n"
    assert joined(start, "let water = 5;\n</body></html>") == GAME
    # The writer said its last line again before carrying on: kept once.
    assert joined(start, "let sun = 10;\nlet water = 5;\n</body></html>") == GAME
    # A short "repeat" is real code, never trimmed.
    assert joined("a {\n}", "}\n") == "a {\n}}\n"
