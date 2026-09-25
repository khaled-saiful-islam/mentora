# 029 — Quizzes and flashcards: generation, editing, sharing

## What it does

- **Two new tiles sit above the chat box**: Quiz (tangerine) and Flashcards
  (lagoon), each playing a few seconds of what it makes. Pelita's studio
  artifacts (poster, slides, website, app, game) moved to the top of the
  screen, where the news used to be. That is for staff only; students see the
  learning tiles only.
- The **create sheet** asks for a topic, then optionally a subject, grade
  (Malaysian Year/Form), how many (default 10) and a language.
- **Generation is grounded in the web and watched live.** A panel slides in
  and shows, as they happen:
  - the topic check
  - the trusted sources found
  - the skills the set will assess
  - each item as it passes its check
  - a confetti finish

  Close it and the build carries on; you are told when it is ready.
- **The editor** lets you:
  - change any question, option, correct answer, explanation, skill,
    difficulty or source
  - reorder, add and delete items
  - **rewrite one item with AI** ("make it easier")

  Unsaved changes stay in a sticky save bar.
- **Sharing** sends a set to a class or some of its groups. Options: feedback
  after each question or at the end (quizzes), a due date, retakes, shuffled
  question order, and a leaderboard (quizzes only). Students are notified.
- **Students make private practice sets** the same way, up to
  `STUDENT_PRACTICE_PER_DAY`. These can never be shared.

## How it works

### The pipeline (`app/learning/generator.py`)

```
check → research → skills → write ⟲ verify ⟲ repair → built
```

- **check.** Is this a real school topic suitable for the grade? A no is a
  friendly *refusal*, not an error, stored on the set.
- **research.**
  - The model plans 2–3 searches.
  - `Researcher` searches with **Google SafeSearch on**, drops blocked hosts
    (adult, gambling, social, forums), puts educational hosts first (`.edu`,
    `.gov`, `.edu.my`, Britannica, BBC, Khan Academy …), and reads the top
    pages for the paragraph that answers.
  - Every excerpt goes through the **prompt-injection guard** before a model
    sees it.
  - A model pass then **screens the sources** for relevance and
    age-appropriateness.
- **skills.** 3–6 subtopics, each item tagged with one, so results can report
  strengths and weaknesses.
- **write.**
  - Items are drafted in batches of five and validated by their kind.
  - A second pass **verifies each against its sources** (on topic, answer
    right, suitable).
  - Failures get one repair and are then re-checked; what still fails is
    dropped.
  - One top-up round covers a shortfall. The result says honestly, e.g.
    *"8 of 10 passed checks"*.
- With **search down**, the set is still written and is marked *not grounded*
  everywhere it appears.

### Kinds (`app/learning/base.py`)

`LearningKind` is a Protocol. Each kind owns:
- `normalise`: clean a model's or an editor's item, repair what is safe, refuse
  what is not
- `public`: what a student sees before answering — **never the answer**
- `grade`: mark a response; a malformed response is simply wrong
- `writing_rules`: the JSON the model must write

`quiz.py` and `flashcard.py` are the two kinds; `registry.py` lists them.

### Jobs (`services/jobs.py`)

- A build runs in its own task and buffers its events.
- `GET /learning-sets/{id}/stream` replays from the first event, so a reload
  or a second tab rejoins it.
- A build that already finished answers from the set row.
- The set is written as `generating` *before* the job starts, so it is in the
  library at once.

### Versions

- Edits change the current version **in place until it has been shared**, then
  fork a new version.
- An assignment pins its version, so students always answer the questions
  they were shown.

### Cost

Every model call is metered. Build and rewrite tokens are stored on the version
and **count toward the owner's 24-hour token quota**. Builds are also
rate-limited per person (`RATE_LIMIT_GENERATE_PER_MINUTE`).

## Endpoints

```
POST  /api/learning-sets/generate            {kind, topic, subject?, grade_level?, count?, language?} → 202
GET   /api/learning-sets/{id}/stream         SSE: stage, sources, skills, items, done | failed | refused
POST  /api/learning-sets/{id}/retry
GET   /api/learning-sets                     ?kind=&q=&archived=&limit=&offset=
GET   /api/learning-sets/{id}                with items, skills, sources
PATCH /api/learning-sets/{id}                {title?, items?}   forks a version once shared
POST  /api/learning-sets/{id}/items/{item}/rewrite   {instruction}
DELETE /api/learning-sets/{id}               archive
POST  /api/assignments                       {set_id, class_id, group_ids, feedback_mode, due_at, ...}
GET   /api/assignments?class_id=
GET|PATCH /api/assignments/{id}              {due_at?, clear_due?, closed?}
```

## Configuration

`LEARNING_MODEL`, `LEARNING_BASE_URL` and `LEARNING_API_KEY` fall back to
`LLM_*`. Also: `LEARNING_TIMEOUT_SECONDS`, `LEARNING_READ_PAGES`,
`RATE_LIMIT_GENERATE_PER_MINUTE`, `STUDENT_PRACTICE_PER_DAY`. Grounding needs
`SERPAPI_KEY`.

## Extending it

**A new kind** (a worksheet):
- Backend: `app/learning/worksheet.py` implementing `LearningKind`, plus one
  line in `learning/registry.py`.
- Frontend:
  - an editor in `features/learning/editors/` plus one line in
    `editors/index.ts`
  - a look in `features/learning/kinds.tsx`
  - `--kind-worksheet` colour tokens

The generator, the library, sharing and the job runner need no change.

## Known limits

- **Generation is started from the tiles, not from free chat.** "Make me a
  quiz on fractions" typed into the chat box is answered as a chat message. A
  chat tool that starts a build is a natural next step; the job runner is
  already the seam for it.
- **Leaving the editor by an in-app link loses unsaved edits** — only closing
  the tab asks first. The app uses `BrowserRouter`, and React Router's
  navigation blocker needs a data router.
- **One API worker**: jobs are in-process, like chat turns.
- Verification is the same model checking its own work against the sources. It
  catches unsupported answers and off-topic items well, but is not a subject
  expert — the editor exists so a teacher has the last word.
- A build is typically 30–60 s and ~4–8k tokens for ten items (measured:
  31 s / 3.9k tokens for five on `ilmu-v3.1`).
