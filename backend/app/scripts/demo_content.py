"""What the demo class learns: real questions and cards, checked by hand.

Kept apart from `demo.py` so the seeding logic stays short enough to read.
"""

from __future__ import annotations

from typing import Any

WATER_SKILLS = [
    {"slug": "water-cycle", "label": "The water cycle"},
    {"slug": "weather", "label": "Weather"},
]
CARD_SKILLS = [{"slug": "animals", "label": "Animals"}, {"slug": "habitats", "label": "Habitats"}]
PLANET_SKILLS = [{"slug": "planets", "label": "Planets"}, {"slug": "space", "label": "Space"}]


def _quiz(n: int, prompt: str, options: list[str], answer: int, why: str, skill: str) -> dict:
    return {
        "id": f"q{n}",
        "prompt": prompt,
        "options": options,
        "answer": answer,
        "explanation": why,
        "skill": skill,
        "difficulty": "easy" if n < 3 else "medium",
        "source_ids": [],
    }


def _card(n: int, front: str, back: str, hint: str, skill: str) -> dict:
    return {"id": f"c{n}", "front": front, "back": back, "hint": hint, "skill": skill,
            "source_ids": []}  # fmt: skip


WATER_CYCLE: list[dict[str, Any]] = [
    _quiz(1, "What makes water in the sea turn into water vapour?",
          ["Heat from the Sun", "The wind", "Fish swimming", "The Moon"], 0,
          "The Sun warms the water until some of it evaporates into the air as vapour.",
          "water-cycle"),
    _quiz(2, "What is it called when water vapour cools and turns into tiny drops?",
          ["Evaporation", "Condensation", "Melting", "Freezing"], 1,
          "Condensation is vapour cooling into liquid drops — that is how clouds form.",
          "water-cycle"),
    _quiz(3, "Rain, snow and hail are all kinds of what?",
          ["Precipitation", "Evaporation", "Transpiration", "Erosion"], 0,
          "Any water that falls from clouds to the ground is called precipitation.",
          "weather"),
    _quiz(4, "Plants give off water vapour through their leaves. What is this called?",
          ["Condensation", "Photosynthesis", "Transpiration", "Germination"], 2,
          "Transpiration is plants releasing water vapour from tiny holes in their leaves.",
          "water-cycle"),
    _quiz(5, "Why do clouds look grey just before it rains?",
          ["They are dirty", "They are full of big water drops that block sunlight",
           "They are made of smoke", "The Sun has gone out"], 1,
          "Thick clouds full of big drops let less sunlight through, so they look darker.",
          "weather"),
    _quiz(6, "Where does most of the water on Earth collect after it rains?",
          ["In the clouds", "In the oceans", "In the soil only", "In the sky"], 1,
          "Rivers and streams carry rainwater back to the oceans, where the cycle begins again.",
          "water-cycle"),
]  # fmt: skip

CARDS: list[dict[str, Any]] = [
    _card(1, "Malayan tiger",
          "Malaysia's national animal. It lives in the rainforest and is endangered.",
          "It is on the national coat of arms.", "animals"),
    _card(2, "Kancil (mouse-deer)",
          "The smallest hoofed animal in the world, about the size of a rabbit.",
          "The clever hero of many Malay folk tales.", "animals"),
    _card(3, "Orang utan",
          "A great ape of Borneo and Sumatra whose name means 'person of the forest'.",
          "It has long orange-red hair.", "animals"),
    _card(4, "Rhinoceros hornbill",
          "Sarawak's state bird, with a big orange-red casque on its beak.",
          "Sarawak is called the Land of the ...", "animals"),
    _card(5, "Rainforest",
          "A thick, wet forest with tall trees, where most Malaysian wildlife lives.",
          "It rains here almost every day.", "habitats"),
    _card(6, "Mangrove",
          "Trees that grow in salty water along the coast, with roots above the mud.",
          "Found where rivers meet the sea.", "habitats"),
]  # fmt: skip

PLANETS: list[dict[str, Any]] = [
    _quiz(1, "Which planet is closest to the Sun?",
          ["Venus", "Earth", "Mercury", "Mars"], 2,
          "Mercury is the nearest planet to the Sun, and the smallest.", "planets"),
    _quiz(2, "Which planet is known as the Red Planet?",
          ["Mars", "Jupiter", "Saturn", "Neptune"], 0,
          "Mars looks red because its soil has lots of rusty iron in it.", "planets"),
    _quiz(3, "What is the biggest planet in our solar system?",
          ["Saturn", "Jupiter", "Earth", "Uranus"], 1,
          "Jupiter is so big that all the other planets could fit inside it.", "planets"),
    _quiz(4, "What does the Earth go around once every year?",
          ["The Moon", "Mars", "The Sun", "A comet"], 2,
          "Earth orbits the Sun, and one full trip takes about 365 days.", "space"),
    _quiz(5, "Why does the Moon seem to change shape during the month?",
          ["It shrinks and grows", "We see different amounts of its sunlit side",
           "Clouds cover it", "It spins very fast"], 1,
          "The Moon does not change; as it orbits Earth, we see more or less of its lit half.",
          "space"),
]  # fmt: skip


# --- sent home by the demo parent (§20.4) ------------------------------------------

FRACTION_SKILLS = [
    {"slug": "fractions", "label": "Fractions"},
    {"slug": "money", "label": "Money"},
]
FLOAT_SKILLS = [{"slug": "floating", "label": "Floating and sinking"}]

FRACTIONS: list[dict[str, Any]] = [
    _quiz(1, "Mak cuts a roti canai into 4 equal pieces. You eat 1. What fraction did you eat?",
          ["1/2", "1/4", "1/3", "4/1"], 1,
          "One piece out of four equal pieces is one quarter, 1/4.", "fractions"),
    _quiz(2, "Half of 10 durians is how many?",
          ["2", "5", "8", "10"], 1,
          "Half means sharing into 2 equal groups: 10 ÷ 2 = 5.", "fractions"),
    _quiz(3, "Which is bigger: 1/2 of a cake or 1/4 of the same cake?",
          ["1/4", "They are the same", "1/2", "You cannot tell"], 2,
          "Cutting into fewer pieces makes each piece bigger, so 1/2 is bigger than 1/4.",
          "fractions"),
    _quiz(4, "Satay costs RM1 a stick. You buy 6 and pay with RM10. How much change?",
          ["RM6", "RM3", "RM4", "RM16"], 2,
          "Six sticks cost RM6, and RM10 − RM6 = RM4.", "money"),
    _quiz(5, "A pizza has 8 slices. 2 are eaten. What fraction is left?",
          ["6/8", "2/8", "8/6", "1/8"], 0,
          "8 − 2 = 6 slices are left, out of 8: 6/8, which is the same as 3/4.", "fractions"),
]  # fmt: skip

FLOATING: list[dict[str, Any]] = [
    _card(1, "Why does a coconut float?", "It has lots of air inside and is light for its size.",
          "Think about what is inside the shell.", "floating"),
    _card(2, "Why does a coin sink?", "It is heavy for its size — denser than water.",
          "Small, but heavy.", "floating"),
    _card(3, "How can a big ship float?",
          "Its shape pushes a lot of water aside, and air fills it.",
          "Shape matters, not only weight.", "floating"),
    _card(4, "What happens to a ball of plasticine shaped into a boat?",
          "It can float, because the new shape pushes more water aside.",
          "Same plasticine, new shape.", "floating"),
]  # fmt: skip
