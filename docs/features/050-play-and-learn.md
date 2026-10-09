# 050 — Play and Learn: games from Mentora's own templates

Teachers and parents make a **game** on any topic. It is a treasure map of
3–6 islands, one idea each, set in a Malaysian world and told as a short
story. On each island the child plays one round in one of **eight templates
Mentora owns**, from sorting cards to escaping locked doors, and a game ends
with a Boss Battle.
The AI writes only the content (checked against sources, like a quiz) and
picks the template that fits each idea. It never writes code. **A game is
always built**, in one to two minutes.
Plans: `PLAN.md` §26 and §26.8. The AI-coded games of §24/§25 came before it
and were retired: about one build in three passed.

## What it does

### For the child

- **The story opens one of five ways**, picked at random for each game (the
  maker can change it), all read aloud:
  - a comic;
  - a **video call** from the character that rings until answered;
  - a **letter in a bottle** that washes up;
  - a **news flash** with a ticker;
  - a **postcard** that flips over.

  The character's name is chosen from many Malaysian names.
- **The map**: the stops on a winding trail, drawn for the world:
  - sand islands on the reef;
  - tree camps in the rainforest;
  - stilt houses in the kampung;
  - stations in KL;
  - planets in space.

  The next stop glows with the buddy on it; the rest wait under fog until
  their turn.
- **On each island**:
  - **Learn it**: the story beat before the island, then the one idea, big,
    with a picture, and what to do. All of it can be read aloud.
  - **How to play**: an animated demo of the template, in which a little hand
    plays one move in a miniature of it, beside three short steps that light
    up in turn. It is open the first time a template comes up in a game and
    folded after; the **?** in the game bar brings it back mid-round.
    English or Malay, as the game; read aloud in the browser's voice; still
    when calm.
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

| Template | The child… | Fits | Years |
|---|---|---|---|
| **Sort It Out** | puts one card at a time into its basket, by tapping or dragging | groups: living or not, acids and bases, nouns and verbs | all |
| **Line Up** | taps steps into place one after another; right ones lock | processes, cycles, timelines, sentences | all |
| **Match Up** | drags each answer from a tray into the slot beside its partner (or taps one, then the slot); a right one snaps in green with its why | word and meaning, cause and effect, BM and English | all |
| **The Lab** | moves 1–3 sliders; a meter (and for Forms a graph) shows the output; brings it into each goal's green zone | how one thing changes another: light and growth, Ohm's law, a launch angle | Year 3 up |
| **Spot the Mistake** | taps the wrong line of a worked answer, then picks its fix | methods often got wrong: a sum's working, grammar | Year 4 up |
| **Detective Case** | opens clue cards (some with tables), names who or what did it, then the clue that proves it | reasoning from evidence: sources, data | Year 5 up |
| **Escape Room** | opens 2–4 doors with codes: a keypad number, a word from letter tiles, or a symbol | using an idea to work answers out | Year 4 up |
| **Boss Battle** | answers questions to drain the boss's health; a wrong one costs a heart and comes back later; hearts refill, never a game over | revising the whole game, as its last island | Year 3 up |

**Revision games**, from a game's finish screen and the teacher's Library,
use its pairs and boss questions and keep nothing:

- **Streak Ladder**: climb until the first slip.
- **Tug-of-War** (the teacher's class screen): two teams, Harimau and
  Kancil, on one screen. The first right answer pulls the rope, a wrong one
  freezes that team for the question, and five pulls wins.

**By year** (`bandOf`):

| | Years 1–3 | Years 4–6 | Forms 1–5 |
|---|---|---|---|
| Text | biggest | large | denser, so more fits |
| Read aloud | a speaker on every piece, and every *why* is read aloud | on request | on request |
| Show me | after one wrong move | after two | after two |
| Size the AI is asked for | 4–6 cards in 2 baskets, 3–4 steps or pairs | 6–9 cards, 4–6 steps or pairs | 8–12 cards, 5–8 steps or pairs |

### For the teacher or parent

- **Make a game** from the homes, the coverage nudges, Library → Make, or
  **the chat**: "Make an escape room game about fractions for my Year 5
  class" picks the template. "A game on food chains" is one of the chat's
  starters. The chat's card follows the build, then offers **Play it**,
  Share and Open, and names the templates inside. A game opened from the chat
  leads back to the chat (`learning/cameFrom.ts`, remembered for the session). Pick the topic, year, **level** and language, and how many
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
- **Revise with your class**: a card beside the game in the Library starts
  Tug-of-War on the class screen, or the Streak Ladder.
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
  - **Every template's rules** live in `game_rounds.py`; The Lab's in
    `game_lab.py`. A Lab's formula is read by `formula.py` (the same grammar
    as the app's `rounds/formula.ts`, never `eval`). Every goal is proven
    reachable by trying the sliders across their range; a goal met where the
    sliders start is dropped, and Show me slides to the setting found.
  - **What the server guarantees** (`game_finish.py`):
    - a game for Year 3 up ends with a Boss Battle, made from the islands'
      own pairs when the writer wrote none;
    - the opening is picked at random;
    - the writer is offered a few names from across Malaysia;
    - two islands saying nearly the same idea are one (70% of their words
      and at least three);
    - the same template never comes twice in a row where another can come
      between.
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

- **A new template** (as §26.8 added five):
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
- **The revision games keep nothing.** Streak Ladder and Tug-of-War are
  practice: no streaks reach the teacher's results yet.
- **The Lab's scenes are generic**: a meter, a growing emoji and, for Forms,
  a graph. There is no bespoke animation for each topic. Its formula is an
  honest simple model for young years and the real one for Forms.
- **Years are asked, not enforced**: the writer is told which templates suit
  which years, but nothing stops a Year 2 Detective Case.
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
