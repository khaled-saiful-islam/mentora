# 044 — Three looks by year, and preview as a student

Quizzes and flashcards play differently for young children, older primary
pupils and secondary students. A teacher or parent can play any quiz or deck
before sharing it, in the look its year gets.

## What it does

**The looks** (`features/play/level.ts`):

| | Year 1–3 — *playground* | Year 4–6 — *quest* | Form 1–5 and up — *focused* |
|---|---|---|---|
| Behind the game | Shapes drifting slowly | A still, dotted map grid | Plain |
| Question | Big, playful lettering | In its own card, with a colour strip across the top | As before |
| Answer tiles | Bright, each in its shape's colour; the shapes bob; they tumble in | White with a bold edge in the shape's colour; they slide in like dealt cards | The usual white tiles |
| Progress | A path of stars: gold when right, grey when not, the current one twinkling (up to 15 items) | The bar, with a rocket riding it to the current question | The bar |
| A right answer | Confetti every time, and *"Yay! You got it!"* | Stars burst from the tile, *"+10"* rises, a points counter ticks | *"Correct!"* |
| Read it to me | Astra's voice reads the question and each answer by its shape (*"Triangle: …"*), or the card | — | — |
| Pictures | A photo of what the question or card is about, where one fits and gives nothing away (`045-question-pictures.md`) | — | — |
| Flashcards | Bright cards, big words, a bouncier flip, smiley buttons, confetti for *I knew it!* | A bold band across the top of each card; points for each one known | As before |
| Finish | A bigger party, with confetti from one star | *"You won 80 points!"* and a rank: Rookie, Explorer, Adventurer or Champion | As before |

- The Form look is exactly what students had before this change.
- **Calm motion always wins.** A child who asked for less movement keeps the
  colours, words, star path and read-aloud, but nothing bobs or drifts, and
  there is no per-answer confetti.

**Which look.** The student's own year picks it. When their year isn't known,
the set's year (`grade_level` on the attempt) decides. Anything else — a
Form, Lower or Upper Six, or no year at all — gets the focused look.

**Preview** (`/library/:id/try`, the *Preview* button in the editor):
- A banner says *"Preview — this is how a Year 4 student sees it. Nothing is
  saved."*, naming the set's year.
- The look is the one the set's year gets (`levelForGrade`), exactly as a
  student in that year would see it. There is no switch between looks: the
  year decides.
- *Start over* and *Back to editing*.
- The real quiz or flashcard player runs with instant feedback, then the real
  finish screen and the answer-by-answer review. *Try again* starts fresh.
- For teachers and parents alike. A study guide keeps its reading preview
  (`/library/:id/preview`).

## How it works

- `level.ts`:
  - `levelForGrade` and `levelFor(student, set)` map a year to a look.
  - `LOOKS` is one row of settings per look.
  - `lookFor(level, calm)` drops the motion for calm.
  - The players, the header and the finish screen read it through
    `PlayLevelProvider` / `usePlayLook`.
- `PlayFun.tsx` holds the extras — the drifting backdrop, `ProgressStars`,
  `PointsChip`, `PointsBurst` and `ReadAloudButton`. Each is drawn only by the
  look that wants it.
- **Read it to me** (`usePlayVoice.ts`, `services/read_aloud.py`) uses the
  same warm female voice as live lessons (`SPEECH_VOICE`, `SPEECH_SPEED`):
  - The browser never sends the words. It asks for one *part* of an item —
    `?item=…&part=question|option|front|back&n=…` — from the student's attempt
    (`GET /api/me/attempts/{id}/speech`) or, in a preview, from the owner's
    set (`GET /api/learning-sets/{id}/speech`). The server says what is on
    screen, in the shown order, so the voice can't be made to say anything
    else.
  - Each part is its own clip, played in turn with a breath between (longer
    after the question). All of them are asked for at once, so the next is
    ready by its turn. Clips are recorded once and cached (`Narrator`), and
    count against `RATE_LIMIT_SPEECH_PER_MINUTE`.
  - An attempt's clips may be kept by the browser for an hour; a preview's
    are not, because the set may have just been edited.
  - `READ_ALOUD_LANGUAGES` (default `en`, also in `/api/config`) says which
    sets get the tutor's voice. Any other language, or a voice that fails, is
    read by the browser's own voice instead — the button always does
    something.
- `PlayPage` provides the look from the student's year, falling back to the
  set's.
- **The backend seam** (`backend.ts`): a player sends answers to
  `usePlayBackend().answer`. By default that is the server
  (`playApi.answer`). A preview provides `PreviewGrader` (`preview.ts`)
  instead:
  - it builds the attempt from the set, with the answer key left out;
  - it marks each answer from the key, once each, keeping the streak;
  - it adds up the finish — score, percent, stars and skills — without a
    request.
- Points are ten a right first answer, counted from the answers themselves,
  so a resumed attempt shows the right total.

## Extending it

- **A fourth look** is a key in `PlayLevel`, a row in `LOOKS`, and a rule in
  `levelForGrade`. Every player picks it up.
- **A new kind** can support preview by adding its marking to
  `PreviewGrader.mark`.

## Known limits

- **Preview always gives instant feedback.** A set shared for end-of-quiz
  feedback plays the same in preview; the difference is only when the
  verdicts appear.
- **The tutor's voice reads English only for now.** A set in another
  language is read by the browser's voice, which depends on the device.
- **The first tap on a new question waits for the recording** — about a
  second for the question. After that it is cached for everyone.
- **Study guides still use the browser's voice**, because they light up each
  word as it is read, and a recorded clip doesn't say where it has got to.
- **A student whose year is set wrong gets the wrong look.** The look reads
  the year on their account, nothing else.
- **The star path is for up to 15 items.** A longer set shows the bar, which
  stays readable.
