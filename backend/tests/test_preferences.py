"""Display preferences: defaults come from the role, the user overrides.

Only overrides are stored, so a better default reaches everyone who never
changed theirs — which is most people.
"""

from __future__ import annotations

import pytest

from app.core.errors import ValidationError
from app.core.roles import Role
from app.services.preferences import (
    TEXT_SCALES,
    effective_preferences,
    merge_preferences,
)


def test_students_start_bigger_and_more_playful_than_teachers() -> None:
    student = effective_preferences(Role.STUDENT, {})
    teacher = effective_preferences(Role.TEACHER, {})
    assert student.text_scale > teacher.text_scale
    assert student.font_style == "playful"
    assert teacher.font_style == "classic"
    assert teacher.text_scale == 100


def test_sound_is_off_until_someone_turns_it_on() -> None:
    assert effective_preferences(Role.STUDENT, {}).sound is False


def test_motion_follows_the_system_by_default() -> None:
    assert effective_preferences(Role.TEACHER, {}).motion == "system"


def test_a_stored_override_wins_over_the_role_default() -> None:
    prefs = effective_preferences(Role.STUDENT, {"text_scale": 150, "font_style": "easy"})
    assert prefs.text_scale == 150
    assert prefs.font_style == "easy"


def test_a_stored_value_this_build_does_not_accept_falls_back_to_the_default() -> None:
    """Old or hand-edited rows must never break the page that reads them."""
    prefs = effective_preferences(Role.STUDENT, {"text_scale": 999, "font_style": "gothic"})
    assert prefs == effective_preferences(Role.STUDENT, {})


def test_merging_keeps_what_was_not_mentioned() -> None:
    stored = merge_preferences({"text_scale": 130}, {"sound": True})
    assert stored == {"text_scale": 130, "sound": True}


def test_merging_is_not_in_place() -> None:
    original = {"text_scale": 130}
    merge_preferences(original, {"sound": True})
    assert original == {"text_scale": 130}


def test_setting_none_resets_to_the_default() -> None:
    assert merge_preferences({"text_scale": 130, "sound": True}, {"text_scale": None}) == {
        "sound": True
    }


@pytest.mark.parametrize(
    "patch",
    [
        {"text_scale": 101},
        {"font_style": "comic-sans"},
        {"motion": "wild"},
        {"sound": "yes"},
        {"favourite_colour": "blue"},
    ],
)
def test_invalid_updates_are_refused_by_name(patch: dict) -> None:
    with pytest.raises(ValidationError):
        merge_preferences({}, patch)


def test_the_scale_steps_are_ordered() -> None:
    assert list(TEXT_SCALES) == sorted(TEXT_SCALES)
    assert 100 in TEXT_SCALES


def test_as_dict_is_what_the_browser_reads() -> None:
    prefs = effective_preferences(Role.TEACHER, {})
    assert set(prefs.as_dict()) == {"text_scale", "font_style", "motion", "sound"}
