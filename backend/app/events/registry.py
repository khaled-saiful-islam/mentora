"""Who reacts to what. Adding a reaction is one line here.

A fresh bus per unit of work keeps tests independent; building one is a
handful of list appends.
"""

from __future__ import annotations

from app.events.bus import EventBus
from app.events.catalog import (
    AssignmentChanged,
    AssignmentShared,
    AttemptCompleted,
    AttemptProgressed,
    BadgeAwarded,
    LiveSessionCancelled,
    LiveSessionReminder,
    LiveSessionScheduled,
    MembershipApproved,
    MembershipEnded,
    MembershipRejected,
    MembershipRequested,
    PracticeMade,
    StudentNeedsSupport,
    WorkFinished,
)
from app.events.subscribers import notifications, practice, realtime


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
    bus.subscribe(LiveSessionScheduled, notifications.live_scheduled)
    bus.subscribe(LiveSessionCancelled, notifications.live_cancelled)
    bus.subscribe(LiveSessionReminder, notifications.live_reminder)
    bus.subscribe(LiveSessionScheduled, realtime.live_changed)
    bus.subscribe(LiveSessionCancelled, realtime.live_changed)
    # Live pages: something you have open just changed.
    bus.subscribe(MembershipRequested, realtime.join_requested)
    bus.subscribe(MembershipApproved, realtime.membership_decided)
    bus.subscribe(MembershipRejected, realtime.membership_decided)
    bus.subscribe(MembershipEnded, realtime.membership_decided)
    bus.subscribe(AssignmentShared, realtime.assignment_shared)
    bus.subscribe(AssignmentChanged, realtime.assignment_changed)
    bus.subscribe(AttemptProgressed, realtime.attempt_progressed)
    bus.subscribe(AttemptCompleted, realtime.attempt_finished)
    bus.subscribe(StudentNeedsSupport, notifications.student_needs_support)
    bus.subscribe(WorkFinished, notifications.work_finished)
    # A shared set found hard: practice made for the student, after commit.
    bus.subscribe(AttemptCompleted, practice.weak_spots)
    bus.subscribe(PracticeMade, notifications.practice_ready)
    return bus
