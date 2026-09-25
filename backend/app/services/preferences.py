"""How a person likes Mentora to look: text size, font style, motion, sound.

Defaults depend on the role — students read at a larger size in a playful
face — and only what someone changes is stored. Reading is forgiving (a value
this build does not accept falls back to the default, so a stale row never
breaks a page); writing is strict (a bad value is refused by name).
"""

from __future__ import annotations

from dataclasses import dataclass, fields
from typing import Any

from app.core.errors import ValidationError
from app.core.roles import Role, parse_role

# Percent of the base size. Five steps: A−, A, A+, A++, A+++.
TEXT_SCALES: tuple[int, ...] = (90, 100, 115, 130, 150)
FONT_STYLES: tuple[str, ...] = ("playful", "classic", "easy")
MOTIONS: tuple[str, ...] = ("system", "reduced", "full")


@dataclass(frozen=True, slots=True)
class Preferences:
    text_scale: int
    font_style: str
    motion: str
    sound: bool

    def as_dict(self) -> dict[str, Any]:
        return {field.name: getattr(self, field.name) for field in fields(self)}


_STAFF_DEFAULT = Preferences(text_scale=100, font_style="classic", motion="system", sound=False)
_DEFAULTS: dict[Role, Preferences] = {
    Role.ADMIN: _STAFF_DEFAULT,
    Role.TEACHER: _STAFF_DEFAULT,
    Role.STUDENT: Preferences(text_scale=115, font_style="playful", motion="system", sound=False),
}

_ALLOWED: dict[str, tuple[Any, ...]] = {
    "text_scale": TEXT_SCALES,
    "font_style": FONT_STYLES,
    "motion": MOTIONS,
    "sound": (True, False),
}


def _valid(name: str, value: Any) -> bool:
    allowed = _ALLOWED[name]
    # `True in (0, 1)` is true in Python; a bool is only a valid bool.
    if name == "sound":
        return isinstance(value, bool)
    return not isinstance(value, bool) and value in allowed


def _defaults_for(role: Role | str) -> Preferences:
    parsed = role if isinstance(role, Role) else parse_role(role)
    return _DEFAULTS.get(parsed, _STAFF_DEFAULT) if parsed else _STAFF_DEFAULT


def effective_preferences(role: Role | str, stored: dict[str, Any] | None) -> Preferences:
    base = _defaults_for(role)
    chosen = {
        name: value
        for name, value in (stored or {}).items()
        if name in _ALLOWED and _valid(name, value)
    }
    return Preferences(**{**base.as_dict(), **chosen})


def merge_preferences(stored: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """The stored overrides after applying `patch`. `None` resets one."""
    merged = dict(stored)
    for name, value in patch.items():
        if name not in _ALLOWED:
            raise ValidationError(f"There is no preference called {name!r}.")
        if value is None:
            merged.pop(name, None)
            continue
        if not _valid(name, value):
            options = ", ".join(str(option) for option in _ALLOWED[name])
            raise ValidationError(f"{name} must be one of: {options}.")
        merged[name] = value
    return merged
