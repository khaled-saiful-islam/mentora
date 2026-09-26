# 041 — Coverage map

## What it does

A class's **Coverage** tab shows how much of the year's syllabus has been
taught, and how well.

- **The syllabus.** *Draft it for me* writes the year's areas and topics
  from the class's subject and grade, following KSSR/KSSM where the model
  knows it. *Write my own* starts blank. Every area and topic can be renamed,
  added or removed.
- **The map.** Topics run down the side and the months across. There is a dot
  wherever a quiz, flashcard deck, study guide or live lesson was taught, and a
  hollow dot for a live lesson still to come. The current month is lit. Each
  topic shows its status:
  - **Not yet**: nothing taught on it.
  - **Planned**: only a live lesson still to come.
  - **Taught**
  - **Secure**: first-try score of 75% or more.
  - **Needs work**: first-try score under 50%.

  Each topic also shows the class's first-try score. Areas fold open and
  closed.
- **Also taught** lists what sits outside the syllabus, so the teacher can
  give it a topic.
- **Plan the rest** suggests up to six next steps from what is left and where
  the class scored low. Each step is a study guide, flashcards, a quiz, or a
  live lesson (at most two), with *when* and *why*. **Make it** opens that maker
  already filled in:
  - The learning kinds open the Create sheet.
  - A live lesson opens `/live/new?class=…&topic=…`.
- **Share with parents** makes read-only links, each of which can be stopped:
  - **The whole class**: what has been covered and when, with no names and no
    one's scores.
  - **One student**: their own score on each topic, for their family.

## How it works

- **Tables** (migration `b3d8f1a6c472`):
  - `class_syllabi`: one per class, `areas` as JSONB with stable ids (`a1`,
    `a1t2`).
  - `coverage_links`: each taught thing sorted onto one topic, or onto none.
  - `progress_reports`: link tokens, with `student_id` null for a class
    report.
- **Sorting is done once.**
  - When the map is opened, anything not yet sorted goes to the model in
    batches of 30 (`coverage.sort`), judged by meaning, not shared words.
  - Each placement is stored, so the map never moves under the teacher's feet
    and the next look costs no model call.
  - Items the model could not place stay unsorted and are tried again next
    time.
  - Removing a topic deletes its links, so its lessons are sorted again.
- **The pieces** (`services/coverage/`):
  - `syllabus.py` cleans any syllabus (a draft or an edit) and keeps ids that
    are well-formed and unique.
  - `matrix.py` is pure: it builds the map from the syllabus, the items, the
    links and the scores.
  - `service.py` does the database and model work.
- **Scores** are the class's first attempt at each assignment. On a student's
  report, it is their best attempt.
- **The public page** (`/r/:token` → `GET /api/reports/{token}`):
  - No account needed. It is rate limited like shared chats, sends
    `noindex, no-store`, and is built from an allow-list: no ids, no other
    students.
  - A stopped link answers exactly like one that never existed.
  - It never calls a model.

## Configuration

None beyond the model the learning sets already use. Drafting and planning
count against `RATE_LIMIT_GENERATE_PER_MINUTE` and the token allowance.

## Extending it

- **A new kind of thing taught**: add it to `CoverageService._taught` as a
  `Taught` (`source`, `id`, `kind`, `title`, `topic`, `when`), and give it a dot
  in `frontend/src/features/coverage/looks.ts`.
- **Another suggestion kind**: add it to `STEP_KINDS` and to `PlanPanel`'s
  `make()`.

## Known limits

- **A thing sits on one topic.** A quiz that spans two topics counts for the
  one it mainly teaches.
- **The year is January to December.** The map runs from the first thing
  taught (or the class's start) to December, at most twelve months. A class
  kept across two years shows its last twelve months.
- **Scores need quizzes.** Flashcards, study guides and live lessons count as
  taught, but only quiz attempts give a score.
- **Suggestions are not saved.** Planning again asks the model again.
