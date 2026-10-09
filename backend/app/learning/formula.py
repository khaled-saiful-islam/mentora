"""The Lab's formulas (§26.8): read and worked out here, never by `eval`.

A model writes how a Lab's output follows from its sliders — `v * v *
sin(2 * a) / 9.8`, `sun * water / 10` — and the server proves every goal can
be reached before anybody plays it. The app works the same formula out as the
sliders move (`frontend/src/features/game/rounds/formula.ts`); the two read
the same small grammar:

    sum     := product (('+' | '-') product)*
    product := unary (('*' | '/') unary)*
    unary   := ('-' | '+') unary | power
    power   := atom ('^' unary)?          (right-associative; -2^2 is -4)
    atom    := number | name | name '(' sum (',' sum)* ')' | '(' sum ')'

Names are the sliders' ids and `pi`; the functions are sin, cos and tan (in
degrees), sqrt, abs, min and max. Anything else — an unknown name, a division
by zero, the root of a negative — is not a number: `math.nan`.
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable, Mapping

_TOKEN = re.compile(r"\s*(?:(\d+(?:\.\d+)?|\.\d+)|([a-z_][a-z0-9_]*)|(\*\*|[-+*/^(),]))")
_FUNCTIONS: dict[str, Callable[..., float]] = {
    "sin": lambda x: math.sin(math.radians(x)),
    "cos": lambda x: math.cos(math.radians(x)),
    "tan": lambda x: math.tan(math.radians(x)),
    "sqrt": math.sqrt,
    "abs": abs,
    "min": min,
    "max": max,
}
_ONE_ARGUMENT = {"sin", "cos", "tan", "sqrt", "abs"}
MAX_LENGTH = 200
PI = "pi"
OPEN = "("


class FormulaError(ValueError):
    """A formula that cannot be read."""


def tokens(formula: str) -> list[str]:
    # Names are lower case, as the app reads them: `Sun` is not `sun`.
    text = formula.strip()
    found, at = [], 0
    while at < len(text):
        match = _TOKEN.match(text, at)
        if match is None or match.end() == at:
            raise FormulaError(f"cannot read {text[at : at + 10]!r}")
        found.append(next(group for group in match.groups() if group is not None))
        at = match.end()
    return ["^" if part == "**" else part for part in found]


def names_in(formula: str) -> set[str]:
    """The names a formula uses, functions and `pi` aside."""
    words = (part for part in tokens(formula) if re.fullmatch(r"[a-z_][a-z0-9_]*", part))
    return {word for word in words if word not in _FUNCTIONS and word != PI}


def evaluate(formula: str, values: Mapping[str, float]) -> float:
    """The formula's value with the sliders at `values`, or nan."""
    if len(formula) > MAX_LENGTH:
        return math.nan
    try:
        reader = _Reader(tokens(formula), values)
        result = reader.sum()
        if reader.left():
            return math.nan
        return result if math.isfinite(result) else math.nan
    except (FormulaError, ArithmeticError, ValueError, TypeError, IndexError):
        return math.nan


class _Reader:
    """Recursive descent over the tokens, working the value out as it goes."""

    def __init__(self, items: list[str], values: Mapping[str, float]) -> None:
        self._items, self._at, self._values = items, 0, values

    def left(self) -> bool:
        return self._at < len(self._items)

    def _peek(self) -> str | None:
        return self._items[self._at] if self.left() else None

    def _take(self, expected: str | None = None) -> str:
        token = self._peek()
        if token is None or (expected is not None and token != expected):
            raise FormulaError(f"expected {expected or 'more'}")
        self._at += 1
        return token

    def sum(self) -> float:
        value = self._product()
        while self._peek() in ("+", "-"):
            value = value + self._product() if self._take() == "+" else value - self._product()
        return value

    def _product(self) -> float:
        value = self._unary()
        while self._peek() in ("*", "/"):
            if self._take() == "*":
                value *= self._unary()
            else:
                value /= self._unary()  # ZeroDivisionError is an ArithmeticError: nan
        return value

    def _unary(self) -> float:
        if self._peek() in ("-", "+"):
            return -self._unary() if self._take() == "-" else self._unary()
        return self._power()

    def _power(self) -> float:
        base = self._atom()
        if self._peek() == "^":
            self._take()
            return float(base ** self._unary())
        return base

    def _atom(self) -> float:
        part = self._take()
        if part == OPEN:
            value = self.sum()
            self._take(")")
            return value
        if re.fullmatch(r"\d+(?:\.\d+)?|\.\d+", part):
            return float(part)
        if part in _FUNCTIONS:
            return self._call(part)
        if part == PI:
            return math.pi
        if part in self._values:
            return float(self._values[part])
        raise FormulaError(f"unknown name {part!r}")

    def _call(self, name: str) -> float:
        self._take("(")
        arguments = [self.sum()]
        while self._peek() == ",":
            self._take()
            arguments.append(self.sum())
        self._take(")")
        if (name in _ONE_ARGUMENT) != (len(arguments) == 1):
            raise FormulaError(f"{name} takes {'one' if name in _ONE_ARGUMENT else 'two or more'}")
        if name == "sqrt" and arguments[0] < 0:
            raise ValueError("the root of a negative")
        return float(_FUNCTIONS[name](*arguments))
