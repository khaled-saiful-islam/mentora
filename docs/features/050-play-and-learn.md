# 050 — Play and Learn: story games

Teachers and parents make a **game** on any topic. Students play it,
learning the topic as they go, earn points and stars, and play again to beat
their best. The AI writes the game: its story, its world and its challenges,
pitched to the year and level and checked like every quiz. Mentora's own
engine plays it. No model-written code runs on a student's device, and
points are counted on the server. Plan: `PLAN.md` §23.

## What it does

### Making a game

- **Where:** *Make a game* on the teacher home, the parent home and the
  coverage nudges; *Game* in Library → Make; or ask in the chat
  (*"Make a game on the parts of a plant for Year 2 beginners, set on the
  coral reef, played as Bubble Catch"*). Students can't make games. They
  play the games they're given.
- **The usual choices**, as for any set: topic, subject, year, language and
  how many (9 challenges by default; 3 to 15), and optionally the maker's own
  materials.
- **Level:** *Beginner*, *Intermediate* or *Advanced*. Every kind accepts a
  level; for a game it also sets the timer: none for Beginner, and the
  year's quick-check time otherwise (30 s for Years 1–3, 20 s for Years 4–6,
  15 s for the Forms).
- **How it plays (style):** *Quest Map*, *Lane Runner*, *Bubble Catch*,
  *Match & Build*, or *Let Mentora decide*.
- **Where it happens (world):** the Taman Negara rainforest, the Sipadan
  coral reef, a kampung festival, Kuala Lumpur, a space mission, or *Let
  Mentora decide*. Pick these first, so a drafted story is set there.
- **The story:**
  - *Surprise me*: written during the build.
  - *Draft with AI*: a story in a few seconds, written for the chosen world,
    to read and edit before building. *Draft another* for a new one.
  - *Write my own*: up to 2,000 characters. It is safety-checked with the
    topic, and the game is built around it. `{buddy}` marks where the
    player's own buddy appears.
- **Watching it build:** the usual five stages, the last being *Writing the
  story and building the world*. The build carries on in the background, and
  the bell says when it is ready: *"Play it through before you share it."*
- **Play it first:** *Play it* in the editor (or *Preview* on the chat card)
  plays the real game, and nothing is recorded. The editor changes the
  title, the story lines, the style and the world (no rebuild), and every
  challenge.
- **Share:** with a class or groups, or send it home. A game is for playing
  again, so retakes are on by default. The **best-points leaderboard is
  opt-in** (off by default).

### Playing a game

- **Cover → story → three chapters → finale.** The story is read aloud as
  each part appears (after the first tap), with the student's own buddy as
  the sidekick, named in the story. Challenges come easiest first and the
  last one is the **boss**, with its own music.
- **The four styles** all play the same challenge in their own way. Every
  style works with tapping, number keys 1–4 and (where it fits) the arrow
  keys:
  - *Quest Map*: travel a winding path, one stop per challenge.
  - *Lane Runner*: run down the lane with the right answer before the
    gates arrive. Untimed, press *Go!*.
  - *Bubble Catch*: catch the right answer as it floats down.
  - *Match & Build*: drag or tap the right piece into the glowing gap. Each
    world builds its own thing (a rope bridge, a glass-bottom boat, a wau
    kite, a light-rail track, a rocket), and it is finished by the finale.
- **Hints** are asked of the buddy, cost 40 points, and are never sent
  before they are asked for.
- **After every answer:** right or not, the right answer if it was missed,
  and why, read aloud on a tap. A wrong answer never ends the game.
- **Stars for each chapter** (none to three, by the share right), points
  in the HUD as they will be counted, sound and music with a mute button,
  and full screen.
- **The finish:** the points counted up, *Your best yet!* or *Your best: N*,
  stars, badges, how each skill went, *Check my answers*, *Play again*, and
  **Tricky ones**: a calm round of just the challenges missed, with no timer,
  no points and nothing recorded.
- **Badges:** *Game Hero* (finish a game), *Three-Star Star* (three stars in
  every chapter), *Never Give Up* (win after a hard try). *Hot Streak*
  counts game answers too.

### Points

Worked out on the server from the answers, and never sent by the game:

| | |
|---|---|
| A right answer | 100, plus 25 for a medium one and 50 for a hard one |
| Combo | +10 for each right answer in a row after the first, up to +50 |
| Speed (timed games only) | up to +50, less the longer it took |
| A hint | −40 (an answer never scores below 0) |
| A wrong answer | 0, and the combo ends |

The game shows the same count as it goes (`features/game/points.ts`, halves
rounded up on both sides).

### Teachers and parents see

Results per challenge and per skill, as for a quiz. The game's points sit
beside the score in a parent's look back at an attempt, and the leaderboard
ranks **best points** (*Best points · ties share a place*). A shared game
counts on the coverage map like any other set.

## How it works

- **A learning kind, `game`** (`backend/app/learning/game.py`, one line in
  `learning/registry.py`). Its items are **challenges**: a prompt, 2–4 short
  options, the answer, a hint, an explanation, a skill and a difficulty. It
  is checked like a quiz question. The story and world are set-level
  `extras`, written by the kind's **finish stage** (`Enriching`), which keeps
  what the maker chose over what the model picks. If the story model fails,
  the maker's own story is kept as written and the game is still made.
- **Optional kind hooks**, read with `getattr`, so other kinds don't change:
  `arrange` (easiest first), `keeps_order` (no shuffling), `min_count`,
  `choices`, `rules_for` (the world and the maker's story go into the
  challenge prompt), `finish_label` / `finish_detail`, `leaderboard`
  (`BEST_POINTS`; quizzes are `FIRST_TRY`), `points`, `seconds`.
- **Level** is `learning_sets.level`. It goes into the prompts that write,
  check, rewrite and add items (`learning/pitch.py`). **Choices** (style,
  world, story) are kept on the set (`learning_sets.choices`), so a retry
  builds what was asked. **Points** are `attempts.points`. Migration
  `e2a7c5d9f041`.
- **Prompts** (`learning/game_prompts.py`): the challenges and the story are
  set in the world, with Malaysian things in it. The buddy is written as
  `{buddy}` and is never given a species, a he or a she. No other animal
  friend is invented. A teacher's story goes in as data, between tags.
- **Story drafts:** `POST /api/learning-sets/story-draft`
  (`learning/story_draft.py`). It is screened like a topic, rate-limited
  with generation, and nothing is saved.
- **Playing:**
  - `POST /api/me/attempts/{id}/items/{item}/open` notes when a challenge
    first appears.
  - `…/hint` returns the hint and notes that it was asked for.
  - The answer carries the game's `time_ms` and `timed_out`. The speed bonus
    uses the longer of the game's time and the time the server saw since
    *open*. A challenge never opened earns no speed bonus.
  - `AttemptResponse` carries `level`, `timer_seconds`, `points` and
    `best_points` (the best finished try, this one included).
  - The leaderboard says how it ranks (`ranking`: `first_try` or
    `best_points`), and a game's entries carry their best `points`.
- **The engine** (`frontend/src/features/game/`):
  - A pure state machine (`run.ts`) behind `useGameRun`, and a
    `PlayBackend`: the server for a student, `PreviewGrader` (the same rules,
    in the browser) for a maker's preview.
  - `styles/`: one component per style over shared `StyleProps`. On a narrow
    screen a style lays its answers out another way rather than shrink them
    (`useNarrow`). Lane Runner shows numbered gates with the words listed
    above the road, and Bubble Catch drops its bubbles two abreast.
  - `worlds/`: SVG worlds drawn from `--world-*` tokens in `theme.css`, with
    SMIL animation that stops in calm motion.
  - `audio/`: Web Audio music for each world, a boss theme, and effects. No
    audio files.
  - `ui/`: the challenge card, timer ring, reveal panel and HUD.
  - `TrickyRound.tsx`: the missed challenges again, marked from the answers
    the finished attempt has already revealed.
- **Making:** `learning/GameOptions.tsx` in the create sheet,
  `learning/editors/game.tsx` in the editor. The chat tool
  (`tools/learning_set.py`) takes `level`, `style`, `world` and `story`.

## Configuration

No new settings.

- `LEARNING_MODEL` (or `LLM_MODEL`) writes the challenges, the story and the
  drafts.
- `PARENT_SETS_PER_DAY` counts a parent's games with their other sets.
- The timers are the live lessons' quick-check sizes (`live/settings.py`
  `check_size`).

## Extending it

- **A new style:**
  - A component in `features/game/styles/` taking `StyleProps`.
  - One line in `styles/index.ts`.
  - Its name in `worlds/info.ts` `STYLES` and in the backend's `STYLE_LABELS`
    and `STYLE_NOTES`. The notes tell the model when it suits a topic.
- **A new world:**
  - Eight `--world-<name>-*` tokens in `theme.css`.
  - Its art in `worlds/art.tsx`, and what Match & Build builds there in
    `styles/structures.tsx`.
  - An entry in `worlds/info.ts` `WORLDS`, plus `WORLD_LABELS` and
    `WORLD_NOTES` in the backend.

  A world is more than one file because it is drawn.
- **A different points rule:** `GameKind.points` on the server and
  `features/game/points.ts` in the game. Change both, along with both
  tests (`test_game_kind.py` and `points.test.ts`), which use the same
  numbers.

## Known limits

- **The challenges are sent at the start.** As with a quiz, the student's
  browser has every prompt and option from the start (never the answers or
  hints). Someone determined could read ahead and answer quickly. The
  server's clock stops anyone claiming to be faster than the server saw, so
  this is worth at most the speed bonus, 50 a challenge.
- **Story drafts aren't counted toward a day's set quota.** They are only
  rate-limited with generation. A draft is one short model call.
- **The story can still drift.** The prompts keep it to the world, the
  maker's story and one friend, the buddy, and challenges are checked for
  accuracy. The narrative itself isn't checked; read it in *Play it* before
  sharing.
- **Five worlds and four styles,** all drawn in SVG, not illustrated.
- **Read-aloud** uses the voice quizzes use, so its language limits apply.
  Story narration starts after the first tap, as browsers require.
- **The build runs in the API process,** like every set (one API worker;
  see `029-learning-sets.md`).
- **Tricky ones** is offered only on the finish screen, right after a game.
  It isn't recorded, and it isn't in the student's results.
- **Students don't make games,** and the practice made for a student from
  their mistakes is a quiz, not a game.
- **The older studio games are separate.** Those were AI-coded HTML
  artifacts, switched off with the studio (`024-artifacts.md`). Play and
  Learn games are a learning kind and are always on.
