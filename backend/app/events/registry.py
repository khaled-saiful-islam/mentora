"""Who reacts to what. Adding a reaction is one line here.

A fresh bus per unit of work keeps tests independent; building one is a
handful of list appends.
"""

from __future__ import annotations

from app.events.bus import EventBus
from app.events.catalog import (
    MembershipApproved,
    MembershipEnded,
    MembershipRejected,
    MembershipRequested,
)
from app.events.subscribers import notifications


def build_bus() -> EventBus:
    bus = EventBus()
    bus.subscribe(MembershipRequested, notifications.join_requested)
    bus.subscribe(MembershipApproved, notifications.join_approved)
    bus.subscribe(MembershipRejected, notifications.join_rejected)
    bus.subscribe(MembershipEnded, notifications.membership_ended)
    return bus
