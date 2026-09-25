"""The patterns, in English and Malay. Every one is written to miss the school
question that mentions the same word: "how to kill my teacher" and not "how
did the dinosaurs die"; "buy weed" and not "why are drugs harmful".

Tests: `tests/test_moderation_rules.py`. Add an attack and a benign case for
every pattern you change.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.moderation.base import Category, Decision


@dataclass(frozen=True, slots=True)
class Rule:
    name: str
    category: Category
    decision: Decision
    pattern: re.Pattern[str]


def _rule(name: str, category: Category, decision: Decision, *patterns: str) -> Rule:
    return Rule(name, category, decision, re.compile("|".join(patterns), re.IGNORECASE))


S, B, R = Decision.SUPPORT, Decision.BLOCK, Decision.REVIEW
_WHO = r"(?:someone|somebody|a\s+person|people|him|her|them|my\s+\w+)"
_HOW = r"how\s+(?:do\s+i\s+|to\s+|can\s+i\s+|would\s+i\s+|could\s+i\s+)?"

# Checked first: a child at risk is answered with care before anything else.
SUPPORT: tuple[Rule, ...] = (
    _rule(
        "self_harm",
        Category.SELF_HARM,
        S,
        r"\b(?:kill(?:ing)?|hurt(?:ing)?|harm(?:ing)?|cut(?:ting)?|burn(?:ing)?)\s+myself\b",
        r"\b(?:want|wanna|wish\s+i\s+could)\s+(?:to\s+)?die\b",
        r"\b(?:don'?t|do\s+not|dont)\s+want\s+to\s+(?:live|be\s+alive|exist)\b",
        r"\bsuicid(?:e|al)\b",
        r"\bend(?:ing)?\s+my\s+life\b",
        r"\bbetter\s+off\s+dead\b",
        r"\bno\s+reason\s+to\s+live\b",
        r"\bself[-\s]?harm\w*\b",
        r"\bbunuh\s+diri\b",
        r"\b(?:nak|ingin|mahu|mau|hendak)\s+mati\b",
        r"\b(?:tak|tidak|x)\s+(?:nak|mahu|ingin)\s+hidup\b",
        r"\b(?:cederakan|sakiti|lukakan)\s+diri\b",
    ),
    _rule(
        "abuse",
        Category.ABUSE,
        S,
        r"\b(?:he|she|they|someone|somebody|my\s+\w+)\s+(?:always\s+|keeps\s+|often\s+|still\s+)?"
        r"(?:touch(?:es|ed)?|hit(?:s)?|beat(?:s)?|hurt(?:s)?|kick(?:s)?)\s+me\b",
        r"\b(?:selalu\s+|suka\s+)?(?:pukul|sentuh|dera|tendang)\s+(?:saya|aku)\b",
        r"\bdidera\b",
    ),
    _rule(
        "bullying",
        Category.BULLYING,
        S,
        r"\b(?:being|getting|get|am|was|been)\s+bullied\b",
        r"\bbull(?:y|ies)\s+me\b",
        r"\b(?:kena\s+buli|dibuli)\b",
    ),
)

BLOCK: tuple[Rule, ...] = (
    _rule(
        "sexual",
        Category.SEXUAL,
        B,
        r"\bporn\w*\b",
        r"\bnudes?\b",
        r"\bhentai\b",
        r"\bxxx\b",
        r"\bonlyfans\b",
        r"\bsex\s*(?:video|tape|chat|pics?|photos?)\b",
        r"\bhave\s+sex\b",
        r"\bhorny\b",
        r"\bnaked\s+(?:pics?|photos?|girls?|boys?|women|men)\b",
        r"\blucah\b",
        r"\bbogel\b",
        r"\bvideo\s+seks\b",
    ),
    _rule(
        "weapons",
        Category.WEAPONS,
        B,
        rf"\b{_HOW}(?:make|build|create)\s+(?:a\s+|an\s+|my\s+own\s+)?"
        r"(?:bomb|gun|explosive|weapon|molotov|grenade|poison)s?\b",
        r"\bcara\s+(?:buat|membuat|hasilkan)\s+(?:bom|senjata|pistol|racun|bahan\s+letupan)\b",
    ),
    _rule(
        "violence",
        Category.VIOLENCE,
        B,
        rf"\b{_HOW}(?:kill|hurt|poison|stab|shoot|murder)\s+{_WHO}",
        r"\bcara\s+(?:bunuh|cederakan|racun|tikam)\s+(?:orang|dia|cikgu|kawan|mak|ayah)\b",
    ),
    _rule(
        "drugs",
        Category.DRUGS,
        B,
        r"\b(?:buy|get|make|smoke|grow|sell)\s+(?:some\s+)?"
        r"(?:weed|marijuana|cannabis|meth|cocaine|heroin|ecstasy|ganja|drugs)\b",
        r"\bget\s+high\b",
        r"\b(?:beli|jual|hisap|dapatkan)\s+(?:dadah|ganja|syabu|pil\s+khayal)\b",
    ),
    _rule(
        "gambling",
        Category.GAMBLING,
        B,
        r"\bonline\s+casinos?\b",
        r"\bjudi\s+online\b",
        r"\bbetting\s+(?:tips|sites?|apps?)\b",
        rf"\b{_HOW}(?:gamble|bet\s+on)\b",
    ),
    _rule(
        "profanity",
        Category.PROFANITY,
        B,
        r"\b(?:fuck\w*|motherfuck\w*|cunt|pukimak|puki|kimak|lancau|pantat)\b",
    ),
)

# A school question that happens to use a word from REVIEW.
SCHOOLWORK = re.compile(
    "|".join(
        (
            r"\b(?:a)?sexual\s+reproduction\b",
            r"\bpembiakan\s+(?:seks|aseks)\w*",
            r"\bseks\s+dan\s+aseks\w*",
            r"\bsex\s+(?:of\s+(?:a|the)|chromosomes?|cells?|organs?)\b",
            r"\bdrugs?\s+like\b",
            r"\b(?:paracetamol|medicines?|ubat|antibiotics?|vaccines?)\b",
        )
    ),
    re.IGNORECASE,
)

REVIEW: tuple[Rule, ...] = (
    _rule(
        "sensitive",
        Category.SENSITIVE,
        R,
        r"\bsex\b",
        r"\bseks\b",
        r"\bsexual\w*\b",
        r"\bmasturbat\w*\b",
        r"\bcondoms?\b",
        r"\bdrugs?\b",
        r"\bdadah\b",
        r"\bvap(?:e|es|ing)\b",
    ),
)

# Taken out, not refused: a child should not have to be told off for sharing
# a phone number, and nothing downstream should ever see it.
PERSONAL = (
    re.compile(r"(?<!\d)(?:\+?60[\s-]?|0)1\d[\s-]?\d{3,4}[\s-]?\d{3,4}(?!\d)"),
    re.compile(r"(?<!\d)\d{6}-\d{2}-\d{4}(?!\d)"),
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
)

# The model's answer. Narrower than the input rules on purpose: an answer
# about the Second World War will say "guns", and withdrawing it helps nobody.
OUTPUT: tuple[Rule, ...] = (
    _rule(
        "self_harm_method",
        Category.SELF_HARM,
        B,
        r"\bways?\s+to\s+(?:kill|hurt|harm|cut)\s+yourself\b",
        r"\bhow\s+to\s+(?:kill|hurt|harm|cut)\s+yourself\b",
        r"\bcara\s+(?:untuk\s+)?bunuh\s+diri\b",
    ),
    _rule(
        "weapon_recipe",
        Category.WEAPONS,
        B,
        r"\b(?:make|build|assemble)\s+(?:an?\s+)?(?:explosive|bomb|pipe\s+bomb|firearm)s?\b",
    ),
    _rule("sexual", Category.SEXUAL, B, r"\bporn\w*\b", r"\bhentai\b", r"\bnudes\b", r"\blucah\b"),
    BLOCK[-1],
)
