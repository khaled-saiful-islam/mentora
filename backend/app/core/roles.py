"""The three kinds of account.

A role is stored on the user as its string value, so this enum is the only
place the set of roles is spelled out. What each role may *do* is not here —
that is `app.policies.capabilities`, one decision per capability.
"""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"


# Teachers and admins share the teaching tools; admins add platform oversight.
STAFF: frozenset[Role] = frozenset({Role.ADMIN, Role.TEACHER})


def parse_role(value: str) -> Role | None:
    """A stored or submitted role, or None when this build does not know it."""
    try:
        return Role(value)
    except ValueError:
        return None
