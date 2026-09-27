# 044 — Three looks by year, and preview as a student

Quizzes and flashcards play differently for young children, older primary
pupils and secondary students. A teacher or parent can play any quiz or deck
before sharing it, in each look.

## What it does

**The looks** (`features/play/level.ts`):

| | Year 1–3 — *playground* | Year 4–6 — *quest* | Form 1–5 and up — *focused* |
|---|---|---|---|
| Behind the game | Shapes drifting slowly | A still, dotted map grid | Plain |
| Question | Big, playful lettering | In its own card, with a colour strip across the top | As before |
| Answer tiles | Bright, each in its shape's colour; the shapes bob; they tumble in | White with a bold edge in the shape's colour; they slide in like dealt cards | The usual white tiles |
| Progress | A path of stars: gold when right, grey when not, the current one twinkling (up to 15 items) | The bar, with a rocket riding it to the current question | The bar |
| A right answer | Confetti every time, and *"Yay! You got it!"* | Stars burst from the tile, *"+10"* rises, a points counter ticks | *"Correct!"* |
| Read it to me | Reads the question and each answer by its shape (*"Triangle: …"*), or the card | — | — |
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
- A banner says *"Preview — this is how a student sees it. Nothing is saved."*
- It has the three looks to switch between (starting at the set's year),
  *Start over* and *Back to editing*.
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
  `PointsChip`, `PointsBurst` and `ReadAloudButton` (the study guides' own
  `useReadAloud`). Each is drawn only by the look that wants it.
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
- **Read it to me uses the browser's voice.** It depends on the device, and
  it isn't offered where the browser has no speech synthesis.
- **A student whose year is set wrong gets the wrong look.** The look reads
  the year on their account, nothing else.
- **The star path is for up to 15 items.** A longer set shows the bar, which
  stays readable.
