# 050 — Play and Learn: games from Mentora's own templates

Teachers and parents make a **game** on any topic. It is a treasure map of
3–6 islands, one idea each, set in a Malaysian world and told as a short
story. On each island the child plays one round in a **template Mentora
owns**: they sort cards into baskets, put steps in order, or match pairs.
The AI writes only the content (checked against sources, like a quiz) and
picks the template that fits each idea. It never writes code. **A game is
always built**, in one to two minutes.
Plans: `PLAN.md` §26. The AI-coded games of §24/§25 came before it and were
retired: about one build in three passed.

## What it does

### For the child

- **The story**: a short comic, read aloud. A character with a problem and
  the child's own buddy.
- **The map**: the islands on a winding path across the world. The next
  island glows with the buddy on it; the rest wait under fog until their
  turn.
- **On each island**:
  - **Learn it**: the story beat before the island, then the one idea, big,
    with a picture, and what to do. All of it can be read aloud.
  - **Play it**: one round in a template, described below. Every move is
    answered at once. A right move locks in; a wrong one wobbles and the
    buddy says **why**: *"Vinegar is an acid: it tastes sour."*
  - **What you discovered**: the explanation, the stars, and the story
    moving on. The fog lifts from the next island.
- **Show me**: once the child is stuck, the buddy plays one right move.
  That is after one wrong move for Year 1–3, after two otherwise. The island
  still counts, with one star.
- **Hints** cost a few points. **Stars**: three with no slip and no help,
  two otherwise, one after Show me.
- **The ending**: the character thanks the child. *Islands to clear again*
  replays only the islands missed, and keeps nothing.

### The templates (`frontend/src/features/game/rounds/`)

| Template | The child… | Fits |
|---|---|---|
| **Sort It Out** | puts one card at a time into its basket, by tapping or dragging | groups: living or not, acids and bases, nouns and verbs |
| **Line Up** | taps steps into place one after another; right ones lock | processes, cycles, timelines, sentences |
| **Match Up** | taps a piece on each side to join a pair | word and meaning, cause and effect, BM and English |

**By year** (`bandOf`):

| | Years 1–3 | Years 4–6 | Forms 1–5 |
|---|---|---|---|
| Text | biggest | large | denser, so more fits |
| Read aloud | a speaker on every piece, and every *why* is read aloud | on request | on request |
| Show me | after one wrong move | after two | after two |
| Size the AI is asked for | 4–6 cards in 2 baskets, 3–4 steps or pairs | 6–9 cards, 4–6 steps or pairs | 8–12 cards, 5–8 steps or pairs |

### For the teacher or parent

- **Make a game** from the homes, the coverage nudges, Library → Make, or
  the chat. Pick the topic, year, **level** and language, and how many
  islands (4 by default, 3 to 6). Then three choices, each with *Let Mentora
  decide* as the default:
  - **how it plays**: any of the templates, or the ones picked;
  - **the world**;
  - **the story**: *Surprise me*, *Draft with AI* or *Write my own*.
- **Watch it build**, one to two minutes: check the topic → research → skills →
  write and check the islands → write the story.
- **Play it first** in the real game screen, with nothing recorded.
- **Edit** each island: the idea and picture, what to do, its round (cards
  and baskets, steps in order, pairs, and each piece's *why*), what it
  teaches and the hint. Also the story plan and the world. An island can be
  switched to any template it already has a round for. *Rewrite with AI*
  ("make this a Line Up") writes it a new one. Islands are not added,
  removed or moved, because the story has a beat for each.
- **Share** with a class (retakes on by default, a best-points leaderboard
  if wanted) or send it home.
- **Results** show each island by its task, how many cleared it, and the
  pieces **most often wrong first**: *"Whale (belongs in Mammals): 12
  students"*.

## How it works

- **The kind** (`backend/app/learning/game.py`, `game_prompts.py`):
  - **An island** is `{learn, icon, play, task, sort?, order?, match?,
    explanation, hint, skill, difficulty, source_ids}`. Islands are written
    in one go (`batch = 6`), simplest first, and checked by the same
    pipeline as quiz items, with an island-specific focus (`CHECK_FOCUS`).
  - **Each template's rules are kept on the server** (`_sort`, `_order`,
    `_match`):
    - every card is in exactly one basket and every basket gets cards;
    - no two cards, steps or pairs say the same thing;
    - too many steps is refused, not cut;
    - pairs are one to one.
  - **The Match Up fallback:** every island also carries 3–4 pairs. A round
    that breaks its rules is played as a Match Up of those pairs instead,
    and an island with no valid round at all is written again. This is what
    makes a game always build.
  - **The story plan** lives in the set's extras: title, world, character,
    opening and ending lines, and `beats` keyed by island id.
  - The maker's choices are `world`, `story` and `plays` (`"sort,match"`;
    empty means any).
- **Answers** (`attempt_service`): an island is reported cleared or not,
  with `tries` (one, plus one per slip), `shown` and `slips` (the ids of
  pieces put in the wrong place). Points are counted on the server.
  `results_service` names the most frequent slips (`piece_names`).
- **Read aloud** (`services/read_aloud.py`): adds the parts `task`, `piece`
  and `why`. A round's pieces are numbered the same way on both sides
  (`pieces_of` on the server, `rounds/pieces.ts` in the app), and the voice
  is asked for a piece by its number, never by its words.
- **The screen** (`frontend/src/features/game/`):
  - `GameHost` steps through the story, the map, Learn it, the round, What
    you discovered, and the ending.
  - It also holds the island being played, Show me, slips and sound.
  - `Map.tsx` draws the map, `cards.tsx` and `overlay.tsx` the cards.
  - `useIslands` keeps the outcomes, points and stars.
  - `rounds/` holds the templates.
- **Points** (server, mirrored in `features/game/points.ts`):
  - An island cleared earns 100, plus 25 for medium or 50 for hard, plus 25
    with no slip, minus 40 for a hint.
  - Cleared after Show me: 50. Not cleared: 0.

## Configuration

- `GAMES_ENABLED` (default on) turns games on or off. When off, no one is
  offered a game and making one is refused (`switched_on` in
  `learning/registry.py`).
- `LEARNING_MODEL` writes the islands and the story; no other model is used.
- `PARENT_SETS_PER_DAY` counts a parent's games.

## Extending it

- **A new template**:
  1. Write its round in `frontend/src/features/game/rounds/` (it gets
     `RoundProps`, and must answer every move, call `onMove` and `onDone`,
     and play one move on Show me).
  2. Add it to `Round` and `PLAY_LABELS`.
  3. On the server, add a validator next to `_sort` in `game.py`, a line in
     `_PLAY_RULES` in `game_prompts.py`, and its pieces in `pieces_of` /
     `piecesOf` and `piece_names`.
  4. Write an editor in `learning/editors/rounds.tsx`.
- **A new world**: add it to `WORLD_NOTES`, `WORLD_LABELS` and
  `features/game/worlds.ts`, plus eight `--world-<name>-*` tokens.

## Known limits

- **Less surprise than a hand-made game.** Every Sort It Out plays like a
  Sort It Out. The variety comes from the templates, the five worlds and the
  story.
- **Three templates so far.** The Lab (sliders), Spot the Mistake, Detective
  Case, Escape Room and the revision games (Boss Battle, Tug-of-War, Streak
  Ladder) are later phases of §26.
- **Answered on the device.** A round needs each move's answer at once, so
  the student's copy carries the answers. A determined student could read
  them, or fake a report. Points and the leaderboard should be read in that
  light.
- **Islands can't be added, removed or moved after the build.** Each one's
  words and round can be edited, but a new island means a new game.
- **Games made before §26 were archived** by the migration that dropped
  their code (`b9e4c1a7d203`): they had no rounds to play.
- **English design.** The pieces follow the set's language, but the prompts
  are English, so English games are the best.
- **Repeats are caught by their words.** Two islands that teach the same
  idea in different words both stay; the prompt asks for different ideas,
  but nothing checks.
- Story drafts are rate-limited but not counted toward a day's set quota.
