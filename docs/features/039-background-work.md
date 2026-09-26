# 039 — Background work

## What it does

Making a quiz, flashcards or a study guide, or writing or recording a live
lesson, takes from half a minute to a few minutes. None of it needs anyone
watching:

- **Keep working.** The build panel and the live lesson's writing and
  recording panels have a *Keep working* button. The work carries on wherever
  you go in the app.
- **The tray beside the bell** shows what is being made:
  - A ring fills as the work goes, with a wand while it runs and a tick when it
    is done.
  - Open it for each piece's title, a live progress bar and what is happening
    now ("Mapping the skills", "Wrote part 2 of 4", "Recording Astra's voice ·
    30 of 60").
  - Finished pieces get their button (*Open it*, *Review it*, *Schedule it*) or
    say plainly why they failed.
  - The tray hides when there is nothing to show.
- **The bell rings** when each piece finishes, as `work_done` / `work_failed`:
  - The note says what is ready and what to do next ("Read it through, then
    approve it so Astra can record her voice").
  - It carries a button to the finished thing.
  - If you were watching it finish (its panel or page was open), the note is
    marked read and nothing pops up.

## How it works

- `services/jobs.py` already ran each build in its own task, outliving the
  request. `JobRunner.start` now takes an optional **watcher** (`JobWatcher`),
  which sees every event and is told when the job ends. A watcher that fails is
  logged and never touches the job.
- `services/work.py` holds the **work board**, in memory and per owner:
  - `WorkBoard.watch(id, owner, ticket)` puts a piece on the board and returns
    its watcher.
  - `advance()` turns job events into progress. Stage keys that finish, parts
    written and recording counts each move the bar. It never shows 100% before
    `done`.
  - Each change is pushed to the owner on the realtime topic `work`, with the
    item itself, so the tray updates without a fetch.
  - When a job ends, the board publishes `WorkFinished`. The notification
    subscriber writes the bell note. A job that ends without saying how is
    announced as failed, so nobody is left waiting.
- `services/work_tickets.py` names each kind of work, one function per kind:
  its title, where it opens and how many steps it has.
- `GET /api/me/work` returns the tray: running work, plus work finished in the
  last 15 minutes.
- **The frontend** (`features/work`):
  - `WorkProvider` fetches the board, merges pushes, and checks every 20 s
    while something runs.
  - `WorkTray` draws it.
  - `useShowing(id)` marks what is on screen, so `NewsPop` stays quiet about it.

## Extending it

A new kind of background work is:

1. A ticket function in `work_tickets.py`.
2. `watcher=work.watch(...)` where its job starts.
3. A look in `frontend/src/features/work/looks.tsx`: label, icon, the ready
   line, the next step and the button words.

Its events count towards progress when they use the existing shapes (`stage`
with `key`/`state`, `part`, `recording` with `done`/`total`, `done`, `failed`).

## Known limits

- **In-process, one API worker**, like the job runner and the realtime hub. A
  restart forgets the board. Anything that was running is abandoned, and its
  set or lesson is left in its "making" state, as before this feature.
- **Shutdown is not announced.** A job cancelled because the server stopped
  gets no bell note, since it did not fail on its own.
- **Progress is by steps, not by time.** A study guide's finishing touches can
  sit at 95% for a while.
- **Clearing a finished piece from the tray is per tab.** Its bell note stays
  until it is read.
