"""Domain events: services announce what happened; subscribers react.

A service that approves a student does not know notifications exist. It
publishes `MembershipApproved`, and whatever cares — the bell today, an email
or an analytics feed tomorrow — subscribes in `registry.py`. Adding a reaction
is one function and one line; the service never changes.
"""
