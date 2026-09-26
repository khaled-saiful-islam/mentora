# 038 — The live room: a lesson taught to a group, in step

## What it does

**For the group's students** (`/room/:id`, from the schedule or the Up next card):

- **Before the room opens:** a countdown and *Add to my calendar*.
- **Reminders:** a bell notification a day before (only if the lesson was scheduled further out than that), 15 minutes before, and at the start, the last only to those not yet in the room.
- **The lobby** (from 10 minutes before):
  - Astra on a night sky, and each classmate who comes in floats up as **their own buddy** with their first name.
  - Classmates are seen, never messaged: there is no chat, no reactions and no voice between students.
  - *Tap to hear Astra* unlocks sound.
- **The lesson:**
  - Everyone hears the same sentence at the same time, with the words lighting up as they are said, the key idea on screen and a star per part along the top.
  - A student who arrives late starts part-way through the sentence being said.
  - A dropped connection carries on from the last thing it heard.
- **Raise my hand:**
  - A waving hand and the student's place in line appear.
  - Astra finishes the sentence, then calls on them by name ("Go on, Aina. I'm listening."), and the question box opens.
  - Astra thanks them by name, answers for the whole room, and brings everyone back ("So, let's go back to our little tree…").
  - Each student has a set number of questions. With *questions at pauses*, hands are taken at the end of each part.
  - A question that must not be answered in the room is never read aloud. Astra redirects kindly, the question is logged for the safety queue, and a student who may be at risk is brought to a person's attention.
- **Quick checks:**
  - At the end of each part, a question pops up for 20 seconds, or until everyone here has answered.
  - Then the group's answers are shown as bars, and Astra says the right answer and why.
- **The end:** a celebration. Then *Take the quiz* appears, for a quiz made from the lesson, the teacher's files and the questions the group asked, and shared with the group. Afterwards the room shows **My notes**: the key points of each part and the whole lesson as it was said.

**For the teacher** (`/live/:id/room`, and *Open the room* on the lesson page):

- **Begin the lesson now:** a lesson also starts by itself at its time, once someone is in the room.
- **Controls:** Pause, Carry on, Skip this part and End the lesson.
- **Dashboard:**
  - who is here, with a way to take a student out (they are told, and kept out);
  - the hand queue, with *dismiss*;
  - the transcript as it is said.
- **Summary** on the lesson's page once it has ended:
  - attendance, with join times and minutes;
  - every question, who asked it and Astra's answer;
  - each quick check, with the right answer and the spread of answers;
  - the quiz average, with a link to its results.

## How it works

**`services/live_conductor.py`** runs one lesson as an asyncio task. It walks `live/timeline.py`'s steps: each sentence, with the quiet after it, plus a check step per part.
- For each sentence it gets the clip (recorded already, or recorded now) and its exact length (`live/mp3.py` counts MPEG frames, which matches the system's own audio tools).
- It gives each clip a start time on the server clock, the end of the one before plus its pause, and publishes it about a second ahead.
- It announces the next clip (`prefetch`) once that clip is recorded.
- Between sentences it takes a hand, a pause, a skip or an end.
- The position is saved after every step, so a restart resumes where it was.

**`services/live_room.py`** is one room per lesson:
- Events are numbered, and the last 400 are kept for reconnects. A fresh browser gets a snapshot instead.
- Presence is the number of open connections, and the roster is shown to the room.

**`services/live_scheduler.py`** is a loop in the app's lifespan, running every 10 s. It sends reminders once each (recorded in `reminders_sent`), opens the lobby, starts lessons, and resumes any that were running.

**`services/live_runtime.py`** holds the running conductors and fills each room's members: the group's students, and the teacher.

**Answers** go through `live/answering.py`, shared with the voice lab. The model is warmed when a hand goes up, and every sentence is screened before it is spoken.

**`services/live_quiz_service.py`** builds the quiz after the lesson:
- `GenerationRequest` can now carry **given sources** (the lesson transcript, the questions asked, the teacher's files) and **given skills** (the teacher's parts).
- The quiz's results therefore land in strengths and weaknesses under those names.
- It is shared to the group through `AssignmentService`, so the notification, results and leaderboard are the usual ones.

**In the browser** (`features/live/room/`):
- `clock.ts` takes three samples of the server's clock and keeps the one with the shortest round trip.
- `RoomPlayer` schedules each clip on the Web Audio clock at its server time. A latecomer starts part-way in; a clip in its last 150 ms is skipped rather than blurted.
- `useRoom` turns room events into what the page shows. Captions run on the server clock, so they are right with or without sound.

**Tables** (migration `301aae208835`): `live_participants`, `live_hands`, `live_transcript` (words only; student audio is never kept) and `live_checkin_answers`.

## API

**The room** (the teacher, or the group's students):

| Method | Path | Does |
|---|---|---|
| GET | `/live-rooms/time` | The server clock |
| POST | `/live-rooms/:id/join` | Snapshot, roster, recent transcript, questions left, the quiz if made |
| GET | `/live-rooms/:id/stream?since=` | The room's events (SSE) |
| GET | `/live-rooms/:id/clips/:key` | One recorded clip |
| POST, DELETE | `/live-rooms/:id/hand` | Raise or lower a hand |
| POST | `/live-rooms/:id/question` | Only while called on |
| POST | `/live-rooms/:id/checkin` | Answer a quick check |
| GET | `/live-rooms/:id/notes` | Once ended |

**The teacher:**

| Method | Path | Does |
|---|---|---|
| POST | `/live-sessions/:id/begin` | Start now |
| POST | `/live-sessions/:id/control` | `pause`, `resume`, `skip` or `end` |
| POST | `/live-sessions/:id/participants/:sid/remove` | Take a student out |
| POST | `/live-sessions/:id/hands/:sid/dismiss` | Dismiss a hand |
| GET | `/live-sessions/:id/summary` | The summary |

A test asserts the student routes are exactly `join`, `hand`, `question` and `checkin`: nothing a student sends can reach another student.

## Configuration

- `LIVE_SCHEDULER_ENABLED`: the clock. It is off in tests, which do not run the app's lifespan.
- The audio cache is the `mentora-live-audio` Docker volume, so a rebuild keeps every recorded lesson.

## Known limits

- **One worker.** The rooms and conductors live in the API process. A restart resumes a running lesson from its last sentence, but the room forgets live-only state (the hand queue, an open check) until it happens again.
- **Answers are recorded as they stream.** The first spoken word comes about 1–2 s after the thanks line, hidden by that line when the model is warm.
- **Questions are typed.** Push-to-talk is Phase 4.
- **Minutes present are approximate.** They are counted per connection, and never less than the span from first to last seen.
- **Audio needs a tap** (browser autoplay rules). The page offers *Tap to hear Astra* and shows captions meanwhile.
