"""The templates of §26.8 kept only when they can be played: a Lab whose goals
can all be reached, a Mistake with its fix, one answer to a Detective Case,
doors with codes a child can enter, a Boss with one right answer a question —
and what a teacher and the voice read of each."""

from __future__ import annotations

from app.learning.game_rounds import piece_names, pieces_of, rounds_of

WHY = "Because."

LAB = {
    "controls": [
        {"id": "v", "label": "Voltage", "icon": "🔋", "unit": "V", "min": 0, "max": 12,
         "step": 1, "start": 0},
        {"id": "r", "label": "Resistance", "icon": "🧱", "unit": "Ω", "min": 1, "max": 6,
         "step": 1, "start": 6},
    ],
    "output": {"label": "Current", "icon": "⚡", "unit": "A"},
    "formula": "v / r",
    "goals": [
        {"text": "Light the bulb: 2 to 3 amps", "low": 2, "high": 3, "why": "More voltage."},
        {"text": "Make it blaze: 10 amps", "low": 9.5, "high": 12, "why": "Less resistance."},
        {"text": "Impossible: 50 amps", "low": 50, "high": 60, "why": "Never."},
    ],
}  # fmt: skip


def test_a_lab_keeps_the_goals_it_can_reach_with_the_answer_show_me_plays() -> None:
    lab = rounds_of({"lab": LAB}, WHY)["lab"]
    assert [g["text"] for g in lab["goals"]] == [
        "Light the bulb: 2 to 3 amps",
        "Make it blaze: 10 amps",
    ]
    first, second = lab["goals"]
    assert 2 <= first["solution"]["v"] / first["solution"]["r"] <= 3
    assert 9.5 <= second["solution"]["v"] / second["solution"]["r"] <= 12
    # The meter shows the goals with room around them: 0 to 12 A here.
    assert (lab["output"]["min"], lab["output"]["max"]) == (0, 12)


def test_a_labs_meter_zooms_to_its_goals_and_its_names_lose_their_units() -> None:
    small = {
        **LAB,
        "controls": [{**LAB["controls"][0], "label": "Voltage (V)"}, LAB["controls"][1]],
        "output": {"label": "Current (A)", "icon": "⚡", "unit": "A"},
        "goals": [{"text": "Half an amp", "low": 0.4, "high": 0.6, "why": "Less."}],
    }
    lab = rounds_of({"lab": small}, WHY)["lab"]
    assert (lab["output"]["min"], lab["output"]["max"]) == (0, 0.9)
    assert lab["output"]["label"] == "Current" and lab["controls"][0]["label"] == "Voltage"


def test_a_lab_with_names_its_sliders_do_not_have_or_a_goal_met_at_the_start_is_refused() -> None:
    assert "lab" not in rounds_of({"lab": {**LAB, "formula": "v / ohms"}}, WHY)
    assert "lab" not in rounds_of({"lab": {**LAB, "formula": "eval('1')"}}, WHY)
    started = {**LAB, "goals": [{"text": "Zero", "low": -1, "high": 0.5, "why": "x"}]}
    assert "lab" not in rounds_of({"lab": started}, WHY)
    reserved = {**LAB, "controls": [{**LAB["controls"][0], "id": "sin"}, LAB["controls"][1]]}
    assert "lab" not in rounds_of({"lab": reserved}, WHY)


MISTAKE = {
    "title": "Ali's working",
    "lines": [
        {"text": "1/2 + 1/4", "wrong": False, "why": "The sum."},
        {"text": "= 1/6", "wrong": True, "fix": "= 3/4", "decoys": ["= 2/6", "= 1/6"],
         "why": "Make the bottoms the same first."},
        {"text": "So Ali has three quarters", "wrong": False, "why": "3/4 is three quarters."},
    ],
}  # fmt: skip


def test_a_mistake_keeps_its_fix_and_only_decoys_that_are_neither() -> None:
    mistake = rounds_of({"mistake": MISTAKE}, WHY)["mistake"]
    wrong = mistake["lines"][1]
    assert wrong["fix"] == "= 3/4" and wrong["decoys"] == ["= 2/6"]
    assert [line["id"] for line in mistake["lines"]] == ["l1", "l2", "l3"]


def test_a_mistake_with_no_wrong_line_or_no_fix_is_refused() -> None:
    right = {**MISTAKE, "lines": [{**line, "wrong": False} for line in MISTAKE["lines"]]}
    assert "mistake" not in rounds_of({"mistake": right}, WHY)
    nofix = {**MISTAKE, "lines": [*MISTAKE["lines"][:1], {**MISTAKE["lines"][1], "fix": ""},
                                  *MISTAKE["lines"][2:]]}  # fmt: skip
    assert "mistake" not in rounds_of({"mistake": nofix}, WHY)


CASE = {
    "question": "Who left the gate open?",
    "clues": [
        {"title": "Muddy boots", "icon": "🥾", "text": "Size 5 boots by the gate.",
         "why": "Small feet."},
        {"title": "Shoe sizes", "icon": "📏", "text": "", "rows": [["Name", "Size"], ["Ali", "5"],
         ["Mei", "7"]], "why": "Only Ali wears size 5."},
        {"title": "Weather", "icon": "🌧️", "text": "It rained at noon.",
         "why": "Everyone got muddy."},
    ],
    "suspects": [
        {"name": "Ali", "icon": "👦", "claim": "I was at home.", "why": "His boots are size 5."},
        {"name": "Mei", "icon": "👧", "claim": "I was at the shop.", "why": "Her size is 7."},
    ],
    "answer": "ali",
    "key": "Shoe sizes",
}  # fmt: skip


def test_a_case_names_its_answer_and_its_proving_clue_by_id() -> None:
    case = rounds_of({"case": CASE}, WHY)["case"]
    assert case["answer"] == "x1" and case["key"] == "k2"
    assert case["clues"][1]["rows"] == [["Name", "Size"], ["Ali", "5"], ["Mei", "7"]]


def test_a_case_whose_answer_or_key_is_not_there_is_refused() -> None:
    assert "case" not in rounds_of({"case": {**CASE, "answer": "Zara"}}, WHY)
    assert "case" not in rounds_of({"case": {**CASE, "key": "Fingerprints"}}, WHY)


ESCAPE = {
    "doors": [
        {"puzzle": "3 x 4 = ?", "icon": "🔢", "kind": "number", "answer": "12",
         "why": "Three fours."},
        {"puzzle": "Water as a gas?", "icon": "💨", "kind": "word", "answer": "vapour",
         "why": "Gas."},
        {"puzzle": "Which is a half?", "icon": "🍰", "kind": "choice", "answer": "1/2",
         "options": ["1/4", "1/2", "3/4"], "why": "One of two."},
        {"puzzle": "Bad word", "icon": "", "kind": "word", "answer": "two words", "why": "x"},
    ],
}  # fmt: skip


def test_an_escape_room_keeps_doors_whose_codes_a_child_can_enter() -> None:
    doors = rounds_of({"escape": ESCAPE}, WHY)["escape"]["doors"]
    assert [d["kind"] for d in doors] == ["number", "word", "choice"]
    assert doors[2]["answer"] == "1/2"


BOSS = {
    "name": "Captain Muddle",
    "icon": "🏴‍☠️",
    "questions": [
        {"ask": f"Question {n}?", "options": ["A", "B", "C"], "answer": n % 3, "why": "So."}
        for n in range(5)
    ]
    + [{"ask": "Bad?", "options": ["A", "A", "B"], "answer": 0, "why": "x"}],
}


def test_a_boss_keeps_questions_with_one_right_answer_among_different_options() -> None:
    boss = rounds_of({"boss": BOSS}, WHY)["boss"]
    assert boss["name"] == "Captain Muddle" and len(boss["questions"]) == 5
    named = {**BOSS, "questions": [{**q, "answer": "B"} for q in BOSS["questions"][:5]]}
    assert {q["answer"] for q in rounds_of({"boss": named}, WHY)["boss"]["questions"]} == {1}


def test_a_teacher_and_the_voice_read_each_round_piece_by_piece() -> None:
    rounds = rounds_of({"lab": LAB, "case": CASE, "boss": BOSS}, WHY)
    assert piece_names({"play": "case", "case": rounds["case"]})["x2"] == "Picked Mei"
    assert piece_names({"play": "lab", "lab": rounds["lab"]})["g1"].startswith("Light the bulb")
    spoken = pieces_of({"play": "case", "case": rounds["case"]})
    assert [p["text"] for p in spoken[:2]] == ["I was at home.", "I was at the shop."]
    assert pieces_of({"play": "boss", "boss": rounds["boss"]})[0]["why"] == "So."
