"""What the tutor says: text made sayable, cut into beats and checked for
sounding spoken."""

from __future__ import annotations

import pytest

from app.live.beats import PAUSES, beats_from, sentences, spoken_seconds
from app.live.sentences import SentenceStream
from app.live.speakability import problems
from app.live.speakable import speakable


@pytest.mark.parametrize(
    ("written", "said"),
    [
        ("Water is H₂O.", "Water is H two O."),
        ("Plants take in CO2 and give out O2.", "Plants take in C O two and give out O two."),
        ("Glucose is C6H12O6.", "Glucose is C six H twelve O six."),
        ("It was 25°C today.", "It was 25 degrees Celsius today."),
        ("A right angle is 90°.", "A right angle is 90 degrees."),
        ("3 × 4 = 12", "3 times 4 equals 12"),
        ("10 ÷ 2 = 5", "10 divided by 2 equals 5"),
        ("7 - 2 = 5", "7 minus 2 equals 5"),
        ("Children aged 5-6 years", "Children aged 5 to 6 years"),
        ("About 70% of Earth is water.", "About 70 per cent of Earth is water."),
        ("Half is 1/2 and a quarter is 1/4.", "Half is a half and a quarter is a quarter."),
        ("Then 3/8 of the pizza", "Then 3 over 8 of the pizza"),
        ("The area is 5 m² and x² grows.", "The area is 5 square metres and x squared grows."),
        ("It moves at 60 km/h.", "It moves at 60 kilometres per hour."),
        ("Fruits, e.g. durian, are sweet.", "Fruits, for example, durian, are sweet."),
        ("Ice → water → steam", "Ice becomes water becomes steam"),
        ("Salt & pepper", "Salt and pepper"),
        ("This is **really** important.", "This is really important."),
        ("A *tiny* seed", "A tiny seed"),
        ("- first point\n- second point", "first point second point"),
        ("## Photosynthesis\nLeaves make food.", "Photosynthesis Leaves make food."),
        ("Read [this page](https://example.com) later.", "Read this page later."),
        ("Great job! 🎉", "Great job!"),
    ],
)
def test_written_text_is_turned_into_what_a_teacher_would_say(written: str, said: str) -> None:
    assert speakable(written) == said


def test_ordinary_speech_is_left_alone() -> None:
    line = "Okay, everyone. Have you ever wondered why leaves are green?"
    assert speakable(line) == line


def test_sentences_split_at_real_ends_only() -> None:
    text = "Mr. Tan grew 3.5 kilos of chillies. Amazing! Did you know that? Yes."
    assert sentences(text) == [
        "Mr. Tan grew 3.5 kilos of chillies.",
        "Amazing!",
        "Did you know that?",
        "Yes.",
    ]


def test_a_paragraph_is_cut_into_beats_of_at_most_four_sentences() -> None:
    say = " ".join(f"This is sentence number {n}." for n in range(1, 10))
    beats = beats_from([{"say": say, "show": "Key idea", "pause": "breath"}])
    assert [len(sentences(b.say)) for b in beats] == [4, 4, 1]
    # A beat cut from a longer one carries straight on; the last one keeps the
    # pause the script chose.
    assert [b.pause for b in beats] == ["short", "short", "breath"]
    assert all(b.show == "Key idea" for b in beats)
    assert [b.id for b in beats] == ["b1", "b2", "b3"]


def test_a_beat_ending_on_a_question_to_the_room_waits_for_the_room() -> None:
    beats = beats_from([{"say": "So what do you think happens next?"}, {"say": "Right."}])
    assert beats[0].pause == "think"
    assert beats[1].pause == "breath"


def test_empty_and_malformed_beats_are_dropped_and_symbols_spoken() -> None:
    beats = beats_from([{"say": ""}, "nonsense", {"say": "Water is H₂O.", "pause": "loud"}])
    assert [b.say for b in beats] == ["Water is H two O."]
    assert beats[0].pause == "breath"


def test_spoken_time_counts_words_at_a_teachers_pace_and_the_pauses() -> None:
    sentence = "Word " + " ".join(["word"] * 49) + "."
    beats = beats_from([{"say": " ".join([sentence] * 3), "pause": "think"}])
    # 150 words at 150 a minute is a minute, plus the pauses between beats.
    assert spoken_seconds(beats) == pytest.approx(60 + PAUSES["think"] + 2 * PAUSES["short"])


def test_a_script_that_sounds_written_is_caught() -> None:
    long = "This is a sentence that simply goes on and on " * 4 + "forever."
    beats = beats_from(
        [
            {"say": long},
            {"say": "Furthermore, it is important to note that plants need light."},
        ]
    )
    found = problems(beats)
    assert any("one breath" in p for p in found)
    assert any("furthermore" in p for p in found)
    assert any("it is important to note" in p for p in found)


def test_a_script_far_from_its_time_is_caught() -> None:
    beats = beats_from([{"say": "Plants make food from light. That's it."}])
    assert any("say more" in p for p in problems(beats, target_seconds=90))


def test_a_spoken_script_passes() -> None:
    beats = beats_from(
        [
            {"say": "Okay, everyone. Have you ever wondered why leaves are green?"},
            {"say": "Here's the thing. That green is a clue. The leaf is busy making food."},
        ]
    )
    assert problems(beats) == []


def test_a_stream_is_cut_into_whole_sentences_as_they_finish() -> None:
    stream = SentenceStream()
    assert stream.feed("Chlorophyll is the green stuff in") == []
    assert stream.feed(" leaves. It catches the light, a bit like") == [
        "Chlorophyll is the green stuff in leaves."
    ]
    assert stream.feed(" a solar panel. Okay") == [
        "It catches the light, a bit like a solar panel."
    ]
    assert stream.flush() == ["Okay"]


def test_a_short_opening_is_said_with_the_next_sentence() -> None:
    stream = SentenceStream()
    assert stream.feed("Right. So the leaf needs three things. ") == [
        "Right. So the leaf needs three things."
    ]


def test_numbers_and_titles_do_not_end_a_sentence_in_a_stream() -> None:
    stream = SentenceStream()
    assert stream.feed("Mr. Lim measured 3.5 metres of vine today. ") == [
        "Mr. Lim measured 3.5 metres of vine today."
    ]


def test_a_script_must_not_hear_answers_nobody_could_give() -> None:
    beats = beats_from(
        [
            {"say": "Hafiz, where do you think a plant gets its water?", "pause": "think"},
            {"say": "Exactly, from the roots! Clever."},
        ]
    )
    found = problems(beats, students=["Hafiz"])
    assert any("by name" in p for p in found)
    assert any("Nobody answered out loud" in p for p in found)


def test_asking_the_room_and_saying_if_you_said_passes() -> None:
    beats = beats_from(
        [
            {"say": "So where do you think a plant gets its water?", "pause": "think"},
            {"say": "If you said the roots, you're spot on. Hafiz, you'll like this bit."},
        ]
    )
    assert problems(beats, students=["Hafiz"]) == []


def test_the_room_gets_its_think_between_the_question_and_if_you_said() -> None:
    beats = beats_from(
        [{"say": "Where does the water come from? If you said the roots, you're spot on!"}]
    )
    assert [(b.say, b.pause) for b in beats] == [
        ("Where does the water come from?", "think"),
        ("If you said the roots, you're spot on!", "breath"),
    ]
