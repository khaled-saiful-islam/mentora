"""Who reacts to what. Adding a reaction is one line here.

A fresh bus per unit of work keeps tests independent; building one is a
handful of list appends.
"""

from __future__ import annotations

from app.events.bus import EventBus
from app.events.catalog import (
    AssignmentShared,
    AttemptCompleted,
    BadgeAwarded,
    MembershipApproved,
    MembershipEnded,
    MembershipRejected,
    MembershipRequested,
    StudentNeedsSupport,
)
from app.events.subscribers import notifications, realtime


def build_bus() -> EventBus:
    bus = EventBus()
    bus.subscribe(MembershipRequested, notifications.join_requested)
    bus.subscribe(MembershipApproved, notifications.join_approved)
    bus.subscribe(MembershipRejected, notifications.join_rejected)
    bus.subscribe(MembershipEnded, notifications.membership_ended)
    bus.subscribe(AssignmentShared, notifications.assignment_shared)
    bus.subscribe(AttemptCompleted, notifications.attempt_completed)
    bus.subscribe(AttemptCompleted, realtime.leaderboard_changed)
    bus.subscribe(BadgeAwarded, notifications.badge_awarded)
    bus.subscribe(StudentNeedsSupport, notifications.student_needs_support)
    return bus
