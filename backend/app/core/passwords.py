"""Temporary passwords a child can read aloud and type on a tablet:
two friendly words and two digits, like `mango-tiger-47`.

Given once, when an admin or a teacher resets an account. About 2^20 of
them — plenty for a password that is changed on first use and sits behind
the sign-in rate limit, and much kinder than `x7#Kq!2p` to a seven-year-old.
"""

from __future__ import annotations

import secrets

WORDS = (
    "apple", "banana", "bubble", "cloud", "comet", "coral", "daisy", "dolphin",
    "dragon", "falcon", "forest", "galaxy", "honey", "island", "jelly", "kancil",
    "lemon", "lotus", "mango", "maple", "meadow", "melon", "moon", "ocean",
    "orchid", "otter", "panda", "papaya", "pebble", "pepper", "planet", "rainbow",
    "river", "rocket", "sunny", "tiger", "tulip", "turtle", "violet", "willow",
)  # fmt: skip


def temporary_password() -> str:
    first, second = secrets.choice(WORDS), secrets.choice(WORDS)
    return f"{first}-{second}-{secrets.randbelow(90) + 10}"
