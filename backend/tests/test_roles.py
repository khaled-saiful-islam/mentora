"""Roles, the grade scale and what each role may do.

The capability matrix is the single answer to "may this kind of account do
that?", so it is asserted cell by cell: a capability that drifts open for
students is exactly the bug nobody notices in the UI.
"""

from __future__ import annotations

import pytest

from app.core.grades import GRADES, grade_label, is_grade
from app.core.roles import STAFF, Role
from app.policies.capabilities import Capabilities, capabilities_for


def test_roles_are_the_three_the_product_has() -> None:
    assert {role.value for role in Role} == {"admin", "teacher", "student"}


def test_staff_is_admin_and_teacher() -> None:
    assert frozenset({Role.ADMIN, Role.TEACHER}) == STAFF


# --- grades -------------------------------------------------------------


def test_the_scale_is_malaysian_year_then_form_then_sixth_form() -> None:
    labels = [grade.label for grade in GRADES]
    assert labels == [
        "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
        "Form 1", "Form 2", "Form 3", "Form 4", "Form 5",
        "Lower Six", "Upper Six",
    ]  # fmt: skip


def test_grades_are_grouped_into_stages_in_order() -> None:
    stages = [grade.stage for grade in GRADES]
    assert stages.index("Secondary") > stages.index("Primary")
    assert stages[-1] == "Pre-university"


@pytest.mark.parametrize("code", ["year_1", "form_5", "upper_6"])
def test_known_codes_are_grades(code: str) -> None:
    assert is_grade(code)


@pytest.mark.parametrize("code", ["", "grade_7", "YEAR_1", "year_7", "form_6"])
def test_anything_else_is_not(code: str) -> None:
    assert not is_grade(code)


def test_a_code_has_a_readable_label() -> None:
    assert grade_label("form_3") == "Form 3"
    assert grade_label("nonsense") is None


# --- capabilities -------------------------------------------------------

EXPECTED: dict[str, dict[Role, bool]] = {
    # Closed to students for now; see app/policies/capabilities.py.
    "use_chat": {Role.ADMIN: True, Role.TEACHER: True, Role.STUDENT: False},
    "studio_artifacts": {Role.ADMIN: True, Role.TEACHER: True, Role.STUDENT: False},
    "share_learning_sets": {Role.ADMIN: True, Role.TEACHER: True, Role.STUDENT: False},
    "make_practice_sets": {Role.ADMIN: False, Role.TEACHER: False, Role.STUDENT: True},
    "manage_classes": {Role.ADMIN: True, Role.TEACHER: True, Role.STUDENT: False},
    "join_classes": {Role.ADMIN: False, Role.TEACHER: False, Role.STUDENT: True},
    "take_assignments": {Role.ADMIN: False, Role.TEACHER: False, Role.STUDENT: True},
    "moderate": {Role.ADMIN: True, Role.TEACHER: False, Role.STUDENT: False},
    "manage_users": {Role.ADMIN: True, Role.TEACHER: False, Role.STUDENT: False},
    "share_conversations": {Role.ADMIN: True, Role.TEACHER: True, Role.STUDENT: False},
    "see_usage": {Role.ADMIN: True, Role.TEACHER: True, Role.STUDENT: False},
}


@pytest.mark.parametrize("capability", sorted(EXPECTED))
@pytest.mark.parametrize("role", list(Role))
def test_the_capability_matrix(capability: str, role: Role) -> None:
    assert getattr(capabilities_for(role), capability) is EXPECTED[capability][role]


def test_every_capability_is_in_the_matrix() -> None:
    """A capability added without a row here would be granted untested."""
    declared = set(Capabilities.__dataclass_fields__)
    assert declared == set(EXPECTED)


def test_capabilities_are_frozen() -> None:
    caps = capabilities_for(Role.STUDENT)
    with pytest.raises(AttributeError):
        caps.studio_artifacts = True  # type: ignore[misc]


def test_an_unknown_role_gets_nothing() -> None:
    """Fail closed: a row with a role this build does not know is powerless."""
    caps = capabilities_for("superuser")
    assert not any(getattr(caps, name) for name in Capabilities.__dataclass_fields__)
