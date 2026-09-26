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
    # Live lessons: on the schedule, moved, cancelled, and reminders to join.
    LIVE_SCHEDULED = "live_scheduled"
    LIVE_CANCELLED = "live_cancelled"
    LIVE_REMINDER = "live_reminder"
    # Something made in the background is ready, or could not be made.
    WORK_DONE = "work_done"
    WORK_FAILED = "work_failed"
    # For admins: a student may be at risk, and a person should look.
    SAFETY_ALERT = "safety_alert"
