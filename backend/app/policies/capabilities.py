"""What each role may do, decided in one place.

Every gate in the API — a route dependency, a filtered tool list, the
capabilities the browser is told about — reads from here. Hiding a button is
never the control; this is.

Unknown roles get nothing. A row whose role this build does not recognise is
more likely a mistake than a new kind of superuser, and failing closed is the
only safe reading of a mistake.
"""

from __future__ import annotations

from dataclasses import dataclass, fields

from app.core.roles import Role, parse_role


@dataclass(frozen=True, slots=True)
class Capabilities:
    # Posters, slides, games, websites and apps — the studio artifacts.
    studio_artifacts: bool = False
    # Quizzes and flashcards made to be assigned to a class.
    share_learning_sets: bool = False
    # A student's own private quizzes and flashcards, never assigned.
    make_practice_sets: bool = False
    manage_classes: bool = False
    join_classes: bool = False
    take_assignments: bool = False
    # The guardrail log and its review queue.
    moderate: bool = False
    manage_users: bool = False
    # Public, read-only links to a conversation.
    share_conversations: bool = False
    # Token and cost figures, which mean nothing to a child.
    see_usage: bool = False

    def as_dict(self) -> dict[str, bool]:
        return {field.name: getattr(self, field.name) for field in fields(self)}


_TEACHING = {
    "studio_artifacts": True,
    "share_learning_sets": True,
    "manage_classes": True,
    "share_conversations": True,
    "see_usage": True,
}

_BY_ROLE: dict[Role, Capabilities] = {
    Role.ADMIN: Capabilities(**_TEACHING, moderate=True, manage_users=True),
    Role.TEACHER: Capabilities(**_TEACHING),
    Role.STUDENT: Capabilities(
        make_practice_sets=True, join_classes=True, take_assignments=True
    ),
}

_NOTHING = Capabilities()


def capabilities_for(role: Role | str) -> Capabilities:
    parsed = role if isinstance(role, Role) else parse_role(role)
    return _BY_ROLE.get(parsed, _NOTHING) if parsed else _NOTHING
