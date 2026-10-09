# 050 — Play and Learn: simulation games that teach

Teachers and parents make a **game** on any topic. It is a small simulation
where the child learns by changing things and watching what happens, never
by answering questions. The game teaches one idea at a time, inside a story
that moves forward as they learn. The AI writes the lesson (checked against
sources), the story and the game's code. A robot plays every game on a phone
and a laptop before anyone else sees it. Plans: `PLAN.md` §24 (AI-coded
simulations) and §25 (Learn it → Try it → Do it).

## What it does

### For the child

- **The opening**: a short comic, read aloud. The story's main character
  (*Aina, the reef keeper*) has a problem; the child's own buddy says
  they will help.
- **Each mission is a little lesson in three beats.**
  1. **Learn it**: before the mission, a story panel that makes the idea
     matter, then the idea itself, big, with a picture: *☀️ "The sun heats
     the sea and turns water into invisible vapour."* Read aloud.
  2. **Try it**: in the game, the one control this idea is about glows and
     an arrow points at it. Only that control works, the scene reacts
     big, and it cannot be got wrong.
  3. **Do it**: a small problem that uses the idea (*"Make lots of
     vapour float up"*), with the target shown at beginner level and
     warmer/colder words. A miss is a "Try again", never a game over.
- **Controls arrive one per mission**, so the first mission has just one;
  the last mission is a big finish that uses them together.
- **What you discovered**: when a mission is done, its stars, the checked
  explanation, and the story moving on (*"…but the sky is getting dark!"*).
- **Show me**: after two misses at a mission, the buddy plays it while the
  child watches; the mission still counts, with one star.
- **Hints** from the buddy cost a few points. **Stars**: three on the first
  go without help, two with help or after some goes, one after Show me.
- **The ending**: the character thanks the child; stars, points, and
  *Missions you missed* to replay just those (nothing is kept).
- Sound, full screen, read-aloud of every story line, idea and explanation;
  the buddy beside the game on a wide screen, in a line under the bar on a
  phone.

### For the teacher or parent

- **Make a game** from the teacher and parent homes, the coverage nudges,
  Library → Make, or the chat. Pick the topic, subject, year, **level**,
  language, how many missions (4 by default, 3 to 6), the setting (or *Let
  Mentora decide*) and the story (*Surprise me*, *Draft with AI* or *Write
  my own*).
- **Watch it build**, about 3–6 minutes: check the topic → research →
  skills → write and check the missions → write the story → design the
  simulation → code it → test it on a phone and a laptop → screen its words.
  The bell rings when it is ready.
- **Play it first** in the real game screen, with nothing recorded.
- **Edit** each mission's words (the idea, its picture, the control, what
  to try, the problem, what it teaches, the hint), the story plan (the
  character, the opening and ending panels, the beat before and after each
  mission) and the setting. Missions are not added or removed here, because
  they live in the game's code.
- **Change it**: type a change (*"make the sun slider bigger"*); the game is
  revised and tested again, and a change that breaks it is not kept.
- **Share** with a class (retakes on by default, a best-points leaderboard
  if you want one) or send it home. Results show each mission by its goal.

## How it works

- **The kind** (`backend/app/learning/game.py`, `game_prompts.py`): a
  mission is `{learn, icon, control, guide, goal, win, explanation, hint,
  skill, difficulty, source_ids}`, checked by the same pipeline as quiz
  items with a mission-specific focus (`CHECK_FOCUS`). Missions are
  written in one go (`batch = 6`), simplest first, and two that add the
  same control are one mission (`distinct`: the thing controlled, so "the
  sun" and "the sun slider" are the same). The story plan lives in the
  set's extras: title, setting, character, opening and ending lines, and
  `beats` keyed by mission id. `coded = True` tells the generator to build
  the game's code after the story.
- **The builder** (`backend/app/learning/sim/`):
  - `prompts.py`: design, then write, with the three beats, one control
    per mission, and a `Mentora.demo(id)` (Show me) for every mission.
  - `checks.py`: refuses network, `eval`, blocking loops, web storage,
    dialogs and outside resources, and any reply that isn't one whole
    document. It also refuses a game that tells missions apart by their
    words (`m.control === "Knife"`): the words are the maker's to edit, so
    such a game stops working once they change. Missions go by `id`.
  - `playtest.py`: runs the game, served as a student gets it (from an
    address of its own, with the content policy as a header), at 390×700
    by touch and 1280×760 by keys. It presses Show me for every mission in
    turn (up to three presses each) and fails errors, freezes, blank
    pages, horizontal scrolling and any reach for the network. Each error
    is reported with the line of the game it came from, so a syntax error
    can be fixed. When Show me falls short, the complaint says what the
    game did meanwhile (failed tries, what the buddy was told to say).
  - `builder.py`: the build. A cut-off write is continued. Problems are
    fixed by line edits (`edits.py`), with a whole rewrite as fallback, at
    most twice, and a game that still fails is not kept. Each call to the
    writer is retried once if the connection drops. The game's words go
    through the student safety rules.
- **The runtime** (`sim/runtime.py`) is injected when a game is served. It
  is the game's only way out: `ready`, `tried`, `done`, `say`, `play`, and
  Show me coming in. It also carries the viewer's missions (with their
  beats), the buddy's name, the level, the language, calm motion and sound.
  The content policy is sent both as a header and as a `<meta>` tag.
- **Storage and routes**: `game_documents` holds each game's code, one
  revision per change. The routes are:
  - `GET /api/learning-sets/{id}/game/play` for the maker, and
    `GET /api/me/attempts/{id}/game` for the student whose attempt it is,
    both with `?only=` for a replay.
  - `GET /api/learning-sets/{id}/game` for the status.
  - `POST …/game/changes` for Change it.
  - A mission is reported as an answer with `done`, `tries` and `shown`.
- **Points** (server, mirrored in `features/game/points.ts`): a mission
  reached earns 100, plus 25 or 50 for medium or hard, plus 25 on the first
  go, minus 40 for a hint. A mission reached after Show me earns 50. A
  mission not reached earns 0.
- **The screen** (`frontend/src/features/game/`):
  - `GameHost` frames the game (`sandbox="allow-scripts"`, its own
    address), with `GameBar`, the cards (`cards.tsx`, chosen by
    `overlay.tsx`), the buddy, and Show me.
  - `bridge.ts` listens only to that frame, and only for the runtime's
    shapes.
  - `useMissions` keeps the outcomes, stars and points.

## Configuration

- `GAMES_ENABLED` (default on) turns games on or off. They also need
  `ARTIFACT_MODEL`, the model that writes games, which is independent of
  the switched-off studio. With either missing, games are not offered.
- `ARTIFACT_MAX_TOKENS` and `ARTIFACT_TIMEOUT_SECONDS` apply to each
  writing call.
- `LEARNING_MODEL` writes the missions and the story.
- Every call that writes a game counts toward the maker's daily tokens
  (`services/quota.py` sums `game_documents` too). `PARENT_SETS_PER_DAY`
  counts a parent's games.

## Extending it

- **A new runtime call**: add it in `sim/runtime.py` (the injected JS)
  and `features/game/bridge.ts` (the listener), tell the writer in
  `sim/prompts.py`, and test it with the robot in `sim/playtest.py`.
- **Stricter or looser tests** live in `sim/checks.py` (reading) and
  `sim/playtest.py` (playing). Each complaint is a sentence the writer can
  act on.
- **A new setting**: add it to `WORLD_NOTES` and `WORLD_LABELS` in
  `game_prompts.py` / `game.py`, `features/game/worlds.ts`, and eight
  `--world-<name>-*` tokens for its swatch.

## Known limits

- **Builds fail sometimes**, and that is by design. A game that doesn't
  pass its robot playtest (most often because Show me can't reach a
  mission) is not kept. The maker is told to try again, and each build is
  different. Expect most builds to pass, not all.
- **Build time and cost**: 3–6 minutes, with about 4–8 calls to the game
  writer (up to 16k tokens each). Each fix and each Change it adds more.
- **Quality varies.** The robot proves a game runs, fits a phone and can be
  finished; it cannot judge whether it is fun or beautiful. Labels drawn
  inside the game can overlap; play it first and use Change it.
- **Scores come from the game**, which runs on the child's device. A
  determined student could fake a mission report. Points and the
  leaderboard should be read in that light.
- **Repeats are caught by their control only.** Two missions that teach the
  same idea with different things (halves of a kuih, then halves of a
  lantern) both stay; the prompt asks for new ideas, but nothing checks.
- **Missions can't be added or removed after the build.** Their words can
  be edited, and Change it can rework the game, but a new mission means a
  new game.
- **English design.** The game's words follow the set's language, but the
  prompts are English, so English games are the best.
- **The robot plays by its demos.** It proves each mission can be reached
  by the game's own Show me, not that a child will find the way. The Learn
  it and Try it beats are what make that likely.
- Story drafts are not counted toward a day's set quota, only rate-limited.
  Builds run in the API process, like every set.
