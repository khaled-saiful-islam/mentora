"""The kinds of news the bell carries. The frontend draws each one."""

from __future__ import annotations

from enum import StrEnum


class Kind(StrEnum):
    # For teachers.
    JOIN_REQUEST = "join_request"
    COMPLETION = "completion"
    # For students.
    JOIN_APPROVED = "join_approved"
    ASSIGNMENT_SHARED = "assignment_shared"
    BADGE_AWARDED = "badge_awarded"
