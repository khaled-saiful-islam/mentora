"""A game island's round (§26, §26.8), in each of Mentora's own templates:
what a model or an editor wrote for it, kept only if it keeps that template's
rules — a card in exactly one basket, every goal in The Lab reachable, one
answer to a Detective Case — so whatever reaches a student can be played.

Also the names a teacher reads a round's pieces by in results, and the
pieces the voice reads aloud by number (`pieces_of`, mirrored in the app's
`rounds/pieces.ts`).
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from typing import Any

from app.learning.base import clean_text
from app.learning.game_lab import lab

# What a maker and a child see each template called.
PLAY_LABELS = {
    "sort": "Sort It Out",
    "order": "Line Up",
    "match": "Match Up",
    "lab": "The Lab",
    "mistake": "Spot the Mistake",
    "case": "Detective Case",
    "escape": "Escape Room",
    "say": "Say It",
    "boss": "Boss Battle",
}
PLAYS = tuple(PLAY_LABELS)

PIECE_LIMITS = {
    "label": 40,
    "piece": 120,
    "line": 200,
    "why": 220,
    "icon": 16,
    "id": 40,
    "title": 80,
    "text": 300,
    "cell": 40,
    "answer": 40,
    "say": 80,
}
# How many of each a round may have, whatever the year: the prompt asks for
# the year's size (§26.3); these are what a round can lay out at all.
SORT_BASKETS = (2, 4)
SORT_CARDS = (3, 14)
ORDER_STEPS = (3, 9)
MATCH_PAIRS = (3, 8)
MISTAKE_LINES = (3, 8)
MISTAKE_WRONG = (1, 3)
CASE_CLUES = (3, 6)
CASE_SUSPECTS = (2, 4)
CASE_ROWS = (6, 4)
ESCAPE_DOORS = (2, 4)
CHOICES = (3, 4)
BOSS_QUESTIONS = (4, 8)
# Say It (§28.3.5): lines to read aloud, each a word or a short sentence.
SAY_LINES = (2, 5)
SAY_WORDS = 8


def rounds_of(raw: Mapping[str, Any], why: str) -> dict[str, dict[str, Any]]:
    """Every round written for an island that keeps its template's rules, by
    template. A model writes the pairs on their own; an editor sends them back
    as a Match Up."""
    match = raw.get("match") if isinstance(raw.get("match"), dict) else {"pairs": raw.get("pairs")}
    readers: dict[str, Callable[[Any, str], dict[str, Any] | None]] = {
        "sort": _sort, "order": _order, "match": _match, "lab": lab,
        "mistake": _mistake, "case": _case, "escape": _escape, "boss": _boss, "say": _say,
    }  # fmt: skip
    found = {
        play: read(match if play == "match" else raw.get(play), why)
        for play, read in readers.items()
    }
    return {play: content for play, content in found.items() if content is not None}


# --- the first three ------------------------------------------------------------------


def _sort(value: Any, why: str) -> dict[str, Any] | None:
    """Cards in baskets: each card in exactly one basket, every basket used."""
    if not isinstance(value, dict):
        return None
    baskets: list[dict[str, str]] = []
    for n, raw in enumerate(dicts(value.get("baskets")), start=1):
        label = clean_text(raw.get("label"), PIECE_LIMITS["label"])
        if label and label.lower() not in {b["label"].lower() for b in baskets}:
            own = ident(raw.get("id")) or f"b{n}"
            baskets.append({"id": own, "label": label, "icon": icon(raw)})
    if not SORT_BASKETS[0] <= len(baskets) <= SORT_BASKETS[1] or not _unique(baskets):
        return None
    named = {b["id"]: b["id"] for b in baskets} | {b["label"].lower(): b["id"] for b in baskets}
    cards = []
    for raw in dicts(value.get("cards")):
        basket = str(raw.get("basket") or "").strip()
        cards.append({**_piece(raw, why), "basket": named.get(basket) or named.get(basket.lower())})
    cards = distinct([c for c in cards if c["text"] and c["basket"]], "text")[: SORT_CARDS[1]]
    used = {c["basket"] for c in cards}
    if len(cards) < SORT_CARDS[0] or any(b["id"] not in used for b in baskets):
        return None
    return {"baskets": baskets, "cards": numbered(cards, "c")}


def _order(value: Any, why: str) -> dict[str, Any] | None:
    """Steps in their right order, none the same."""
    if not isinstance(value, dict):
        return None
    steps = [_piece(raw, why) for raw in dicts(value.get("steps"))]
    steps = distinct([s for s in steps if s["text"]], "text")
    # Too many is refused, not cut: the steps left would not be the whole process.
    if len(steps) < ORDER_STEPS[0] or len(steps) > ORDER_STEPS[1]:
        return None
    return {"steps": numbered(steps, "s")}


def _match(value: Any, why: str) -> dict[str, Any] | None:
    """Pairs, one to one: no side said twice."""
    if not isinstance(value, dict):
        return None
    pairs = []
    for raw in dicts(value.get("pairs")):
        left = clean_text(raw.get("left"), PIECE_LIMITS["piece"])
        right = clean_text(raw.get("right"), PIECE_LIMITS["piece"])
        if left and right:
            own = ident(raw.get("id"))
            pairs.append({"id": own, "left": left, "right": right, "why": _why(raw, why)})
    pairs = distinct(distinct(pairs, "left"), "right")[: MATCH_PAIRS[1]]
    if len(pairs) < MATCH_PAIRS[0]:
        return None
    return {"pairs": numbered(pairs, "p")}


def _say(value: Any, why: str) -> dict[str, Any] | None:
    """Lines to read aloud: a word or a short sentence each, in words only —
    a digit is read many ways, so it could never be heard right."""
    if not isinstance(value, dict):
        return None
    lines = []
    for raw in dicts(value.get("lines")):
        text = clean_text(raw.get("text"), PIECE_LIMITS["say"])
        if not text or len(text.split()) > SAY_WORDS or any(c.isdigit() for c in text):
            continue
        lines.append(
            {"id": ident(raw.get("id")), "text": text, "icon": icon(raw), "why": _why(raw, why)}
        )
    lines = distinct(lines, "text")[: SAY_LINES[1]]
    if len(lines) < SAY_LINES[0]:
        return None
    return {"lines": numbered(lines, "l")}


def say_words(item: Mapping[str, Any]) -> list[str]:
    """A Say It's words in order, line after line, as the player counts them
    to ask the voice for one: letters only, so "padi," is "padi"."""
    content = item.get("say") if isinstance(item.get("say"), dict) else {}
    words = (w for line in dicts(content.get("lines")) for w in str(line.get("text", "")).split())
    return [cleaned for w in words if (cleaned := _WORD_EDGES.sub("", w))]


_WORD_EDGES = re.compile(r"^[^\w]+|[^\w]+$")


# --- Spot the Mistake ---------------------------------------------------------------


def _mistake(value: Any, why: str) -> dict[str, Any] | None:
    """A worked answer line by line, one to three of them wrong — each with its
    fix, and wrong fixes beside it that are neither the line nor the fix."""
    if not isinstance(value, dict):
        return None
    lines = [_line(raw, why) for raw in dicts(value.get("lines"))]
    sized = MISTAKE_LINES[0] <= len(lines) <= MISTAKE_LINES[1]
    if any(line is None for line in lines) or not sized:
        return None
    wrong = sum(1 for line in lines if line and line["wrong"])
    if not MISTAKE_WRONG[0] <= wrong <= MISTAKE_WRONG[1]:
        return None
    title = clean_text(value.get("title"), PIECE_LIMITS["title"]) or "Spot the mistake"
    return {"title": title, "lines": numbered([line for line in lines if line], "l")}


def _line(raw: dict[str, Any], why: str) -> dict[str, Any] | None:
    text = clean_text(raw.get("text"), PIECE_LIMITS["line"])
    if not text:
        return None
    line = {"id": ident(raw.get("id")), "text": text, "wrong": raw.get("wrong") is True,
            "fix": "", "decoys": [], "why": _why(raw, why)}  # fmt: skip
    if not line["wrong"]:
        return line
    fix = clean_text(raw.get("fix"), PIECE_LIMITS["line"])
    taken = {text.lower(), (fix or "").lower()}
    offered = _texts(raw.get("decoys"), PIECE_LIMITS["line"])
    decoys = [d for d in offered if d.lower() not in taken]
    if not fix or fix.lower() == text.lower() or not decoys:
        return None
    return {**line, "fix": fix, "decoys": distinct_texts(decoys)[:2]}


# --- Detective Case ------------------------------------------------------------------


def _case(value: Any, why: str) -> dict[str, Any] | None:
    """Clue cards and suspects, one of them the answer, and the clue that
    proves it — both named by an id or by what they are called."""
    if not isinstance(value, dict):
        return None
    question = clean_text(value.get("question"), PIECE_LIMITS["line"])
    clues = numbered([c for c in (_clue(r, why) for r in dicts(value.get("clues"))) if c], "k")
    found = [s for s in (_suspect(r, why) for r in dicts(value.get("suspects"))) if s]
    suspects = numbered(distinct(found, "name"), "x")
    answer = _named(value.get("answer"), suspects, "name")
    key = _named(value.get("key"), clues, "title")
    fits = CASE_CLUES[0] <= len(clues) <= CASE_CLUES[1]
    fits = fits and CASE_SUSPECTS[0] <= len(suspects) <= CASE_SUSPECTS[1]
    if not question or not fits or not answer or not key:
        return None
    return {"question": question, "clues": clues, "suspects": suspects, "answer": answer,
            "key": key}  # fmt: skip


def _clue(raw: dict[str, Any], why: str) -> dict[str, Any] | None:
    title = clean_text(raw.get("title"), PIECE_LIMITS["title"])
    text = clean_text(raw.get("text"), PIECE_LIMITS["text"]) or ""
    rows = _rows(raw.get("rows"))
    if not title or not (text or rows):
        return None
    return {"id": ident(raw.get("id")), "title": title, "icon": icon(raw), "text": text,
            "rows": rows, "why": _why(raw, why)}  # fmt: skip


def _rows(value: Any) -> list[list[str]]:
    """A small table: at most six rows of four cells, every row as wide."""
    rows = [
        [clean_text(str(cell), PIECE_LIMITS["cell"]) or "" for cell in row[: CASE_ROWS[1]]]
        for row in (value if isinstance(value, list) else [])[: CASE_ROWS[0]]
        if isinstance(row, list) and row
    ]
    width = max((len(row) for row in rows), default=0)
    return [row + [""] * (width - len(row)) for row in rows] if width > 1 and len(rows) > 1 else []


def _suspect(raw: dict[str, Any], why: str) -> dict[str, Any] | None:
    name = clean_text(raw.get("name"), PIECE_LIMITS["label"])
    claim = clean_text(raw.get("claim"), PIECE_LIMITS["line"]) or ""
    if not name:
        return None
    return {"id": ident(raw.get("id")), "name": name, "icon": icon(raw), "claim": claim,
            "why": _why(raw, why)}  # fmt: skip


def _named(value: Any, pieces: list[dict[str, Any]], key: str) -> str:
    """The id of the piece `value` names, by its id or by what it is called."""
    wanted = str(value or "").strip().lower()
    found = next((p for p in pieces if wanted in (p["id"].lower(), str(p[key]).lower())), None)
    return found["id"] if found else ""


# --- Escape Room ---------------------------------------------------------------------

_NUMBER = re.compile(r"^-?\d+(\.\d+)?(/\d+(\.\d+)?)?$")
_WORD = re.compile(r"^[A-Za-z]{2,12}$")


def _escape(value: Any, why: str) -> dict[str, Any] | None:
    """Two to four doors, each opened by a code a child can enter: a number on
    a keypad, one word from letter tiles, or one of three or four symbols."""
    if not isinstance(value, dict):
        return None
    doors = [d for d in (_door(r, why) for r in dicts(value.get("doors"))) if d]
    doors = doors[: ESCAPE_DOORS[1]]
    return {"doors": numbered(doors, "d")} if len(doors) >= ESCAPE_DOORS[0] else None


def _door(raw: dict[str, Any], why: str) -> dict[str, Any] | None:
    puzzle = clean_text(raw.get("puzzle"), PIECE_LIMITS["text"])
    answer = clean_text(str(raw.get("answer") or ""), PIECE_LIMITS["answer"])
    kind = raw.get("kind")
    if not puzzle or not answer or kind not in ("number", "word", "choice"):
        return None
    options: list[str] = []
    if kind == "number" and not _NUMBER.match(answer.replace(" ", "")):
        return None
    if kind == "word" and not _WORD.match(answer):
        return None
    if kind == "choice":
        options = distinct_texts(_texts(raw.get("options"), PIECE_LIMITS["piece"]))[: CHOICES[1]]
        picked = next((o for o in options if o.lower() == answer.lower()), None)
        if picked is None or len(options) < CHOICES[0]:
            return None
        answer = picked
    return {"id": ident(raw.get("id")), "puzzle": puzzle, "icon": icon(raw), "kind": kind,
            "answer": answer.replace(" ", "") if kind == "number" else answer,
            "options": options, "why": _why(raw, why)}  # fmt: skip


# --- Boss Battle ---------------------------------------------------------------------


def _boss(value: Any, why: str) -> dict[str, Any] | None:
    """Four to eight questions that revise the game, each with three or four
    options and one right one."""
    if not isinstance(value, dict):
        return None
    questions = [q for q in (_question(r, why) for r in dicts(value.get("questions"))) if q]
    questions = distinct(questions, "ask")[: BOSS_QUESTIONS[1]]
    if len(questions) < BOSS_QUESTIONS[0]:
        return None
    name = clean_text(value.get("name"), PIECE_LIMITS["label"]) or "The Muddle Monster"
    return {"name": name, "icon": icon(value) or "👾", "questions": numbered(questions, "q")}


def _question(raw: dict[str, Any], why: str) -> dict[str, Any] | None:
    ask = clean_text(raw.get("ask"), PIECE_LIMITS["line"])
    options = _texts(raw.get("options"), PIECE_LIMITS["piece"])
    answer = raw.get("answer")
    if isinstance(answer, str):  # named by its words rather than its place
        wanted = answer.strip().lower()
        answer = next((n for n, o in enumerate(options) if o.lower() == wanted), None)
    unique = len(distinct_texts(options)) == len(options)
    if not ask or not unique or not CHOICES[0] <= len(options) <= CHOICES[1]:
        return None
    if isinstance(answer, bool) or not isinstance(answer, int) or not 0 <= answer < len(options):
        return None
    return {"id": ident(raw.get("id")), "ask": ask, "options": options, "answer": answer,
            "why": _why(raw, why)}  # fmt: skip


# --- what a teacher and the voice read -------------------------------------------------


def piece_names(item: Mapping[str, Any]) -> dict[str, str]:
    """An island's pieces by id, as a teacher reads them in results — a card
    and where it belongs, a step and its place, a pair, a goal, a line, a
    suspect or a clue, a door, a question. Empty for anything else."""
    play = item.get("play")
    content = item.get(play) if isinstance(play, str) and isinstance(item.get(play), dict) else {}
    if play == "sort":
        baskets = {b["id"]: b["label"] for b in dicts(content.get("baskets"))}
        cards = dicts(content.get("cards"))
        return {c["id"]: f"{c['text']} (belongs in {baskets.get(c['basket'], '?')})" for c in cards}
    if play == "order":
        steps = dicts(content.get("steps"))
        return {s["id"]: f"{s['text']} (step {n})" for n, s in enumerate(steps, start=1)}
    if play == "match":
        return {p["id"]: f"{p['left']} — {p['right']}" for p in dicts(content.get("pairs"))}
    if play == "case":
        suspects = {s["id"]: f"Picked {s['name']}" for s in dicts(content.get("suspects"))}
        return suspects | {c["id"]: f"Clue: {c['title']}" for c in dicts(content.get("clues"))}
    named = {"lab": ("goals", "text"), "mistake": ("lines", "text"), "escape": ("doors", "puzzle"),
             "boss": ("questions", "ask"), "say": ("lines", "text")}  # fmt: skip
    if play in named:
        key, field = named[play]
        return {p["id"]: str(p[field]) for p in dicts(content.get(key))}
    return {}


def pieces_of(item: Mapping[str, Any]) -> list[dict[str, Any]]:
    """An island's round, piece by piece, as "Read it to me" counts them: `piece`
    n says its words, `why` n why it goes where it does. A Sort It Out's cards
    then its baskets, a Line Up's steps, a Match Up's left sides then its right
    ones; a Lab's goals; a Mistake's lines; a Case's suspects then its clues;
    an Escape Room's doors; a Boss Battle's questions."""
    play = item.get("play")
    content = item.get(play) if isinstance(play, str) and isinstance(item.get(play), dict) else {}
    listed = {key: dicts(content.get(key)) for key in content}

    def said(rows: list[dict[str, Any]], text: str) -> list[dict[str, Any]]:
        return [{"text": r.get(text), "why": r.get("why", "")} for r in rows]

    pairs, clues = listed.get("pairs", []), listed.get("clues", [])

    by_play = {
        "sort": lambda: [*listed.get("cards", []), *said(listed.get("baskets", []), "label")],
        "order": lambda: listed.get("steps", []),
        "match": lambda: [*said(pairs, "left"), *said(pairs, "right")],
        "lab": lambda: said(listed.get("goals", []), "text"),
        "mistake": lambda: said(listed.get("lines", []), "text"),
        "case": lambda: [*said(listed.get("suspects", []), "claim"), *said(clues, "text")],
        "escape": lambda: said(listed.get("doors", []), "puzzle"),
        "boss": lambda: said(listed.get("questions", []), "ask"),
        "say": lambda: listed.get("lines", []),
    }
    return by_play[play]() if play in by_play else []


# --- cleaning ------------------------------------------------------------------------


def _piece(raw: dict[str, Any], why: str) -> dict[str, Any]:
    """A card or a step: its words, its picture, and why it goes where it does."""
    return {
        "id": ident(raw.get("id")),
        "text": clean_text(raw.get("text"), PIECE_LIMITS["piece"]) or "",
        "icon": icon(raw),
        "why": _why(raw, why),
    }


def _why(raw: Mapping[str, Any], why: str) -> str:
    return clean_text(raw.get("why"), PIECE_LIMITS["why"]) or why


def _texts(value: Any, limit: int) -> list[str]:
    given = value if isinstance(value, list) else []
    return [t for t in (clean_text(str(v), limit) for v in given if v is not None) if t]


def dicts(value: Any) -> list[dict[str, Any]]:
    return [v for v in value if isinstance(v, dict)] if isinstance(value, list) else []


def distinct(pieces: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    """The first of each, by what it says — two cards that say the same are one."""
    seen: set[str] = set()
    kept = []
    for piece in pieces:
        said = str(piece[key]).lower()
        if said not in seen:
            seen.add(said)
            kept.append(piece)
    return kept


def distinct_texts(texts: list[str]) -> list[str]:
    """The first of each, ignoring case."""
    seen: set[str] = set()
    kept = []
    for text in texts:
        if text.lower() not in seen:
            seen.add(text.lower())
            kept.append(text)
    return kept


def numbered(pieces: list[dict[str, Any]], prefix: str) -> list[dict[str, Any]]:
    """Every piece with an id of its own: kept from an editor, new where a model
    wrote none or two pieces share one."""
    seen: set[str] = set()
    out = []
    for n, piece in enumerate(pieces, start=1):
        given = piece.get("id") or ""
        own = given if given and given not in seen else f"{prefix}{n}"
        seen.add(own)
        out.append({**piece, "id": own})
    return out


def _unique(baskets: list[dict[str, str]]) -> bool:
    return len({b["id"] for b in baskets}) == len(baskets)


def icon(raw: Mapping[str, Any]) -> str:
    return clean_text(raw.get("icon"), PIECE_LIMITS["icon"]) or ""


def ident(value: Any) -> str:
    return value.strip()[: PIECE_LIMITS["id"]] if isinstance(value, str) and value.strip() else ""
