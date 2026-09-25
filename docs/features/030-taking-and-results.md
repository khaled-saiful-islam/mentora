# 030 — Taking sets, results, badges and the leaderboard

## What it does

- **Students take what was shared with them**, one item at a time, and can pick
  up where they left off. Quizzes give feedback either instantly or at the end,
  as the teacher chose when sharing. Flashcards are marked "knew it" or "not
  yet".
- **Students take their own practice sets** the same way. These never appear
  in a class, on a leaderboard or in a teacher's results.
- **Every answer is saved as it is given.** Closing the tab loses nothing.
- **Finishing returns everything the celebration screen shows** in one reply:
  score, stars (3 at 90%+, 2 at 70%+, 1 at 40%+), per-skill scores, badges
  earned just now, and a leaderboard place if the quiz has one.
- **Teachers see an assignment's results.** They get:
  - students and their status
  - first and best scores
  - a ten-bucket distribution, average and median
  - per-question correct rates and which option each student chose
  - a student × skill heatmap
  - a drill-down into one student's answers

  They can filter all of this to a group.
- **Students see their history and insights.** Their own attempts, plus the
  skills across everything they have done, labelled *strong*, *growing* or
  *practise*.
- **Badges.** There are nine attempt rules (`app/badges/rules.py`) and three
  podium medals. Each is unique per student, badge and scope, so the same badge
  can be earned once per quiz, not once per retake.
- **Leaderboard (quizzes only, opt-in per share).** It ranks first attempts
  only, and ties share a place (1, 1, 3). Students see the top ten plus their
  own row; the teacher sees everyone. Updates are pushed live.

## The screens

- **`/` is a student's home.** It shows:
  - their buddy saying hello and giving a tip
  - their streak and badge count
  - what their teachers shared, as cards with due dates
  - skills worth practising
  - what they finished lately

  Their chat moves to `/chat`, and staff keep `/` as the studio.
- **Classes open for students.** `/classes/:id` shows a student's own view of
  the class: the to-do list first, then what is done.
- **`/play/:id`, `/practice/:id` and `/attempts/:id` are full-screen players**,
  with no app frame. The kind decides the player (`features/play/players.ts`):
  - **The quiz** has four big tiles, each with a shape and a colour, and keys
    1–4 or A–D. It also has a segmented progress bar, a streak flame, the
    text-size control, and a verdict bar with the explanation in instant mode.
  - **Flashcards** flip in 3D. Students tap, swipe, or press ←/→ to say
    whether they knew each one. The cards they did not know come back for
    round 2, which is practice only: the first answer is the one that counts.
- **The finish screen** has:
  - a score ring that counts up, and stars that land one by one
  - confetti at two stars or more
  - new badges on shining medals, and the student's leaderboard place
  - per-skill chips, and the buttons "Check my answers", "Try again" (only
    when retakes are allowed) and "Home"
- **`/results`** shows a student's strengths, what to practise next, a bar for
  every skill, and their history.
- **`/badges`** shows a trophy shelf of earned badges, and locked silhouettes
  with hints for the rest.
- **`/leaderboard/:id`** shows a podium with each student's buddy, the rest
  in rows that animate into place, and "You" pinned. It reloads when the
  server pushes a `leaderboard` event.
- **`/assignments/:id` is the teacher's results page.** It has:
  - the headline numbers and the spread of scores
  - students, with a drill-down into every answer
  - questions, hardest first, with how many chose each option
  - a skill heatmap
  - a group filter

  It is linked from each row of a class's Shared tab.
- **Sound** is synthesised by WebAudio (`lib/sound.ts`) and plays only when
  the student has sound turned on.
- **`make demo`** seeds a class to try all this with: a demo teacher, three
  students who have already played, and three shared sets with real content.
  `make demo join=<username>` adds your own student to it. It refuses to run
  when `APP_ENV=production`.

## How it works

```
api/routes/play.py      /api/me/…   (capability take_assignments)
api/routes/results.py   /api/assignments/{id}/results|leaderboard
services/attempt_service.py      start / resume / answer / complete
services/play_service.py         finish = complete + badges + place + events
services/badge_service.py        rules → StudentBadge, podium once
services/leaderboard_service.py  ranking, settle podium when final
services/results_service.py      teacher results, student insights
services/student_home_service.py to-do cards, streak, badge count
policies/access.py               who can see which assignment
badges/                          BadgeRule protocol, rules, catalog
```

- **The attempt plan.** A new attempt fixes its item order and each option
  order (`plan` JSONB), shuffled if the share asked for that.
  - The student gets each kind's *public* view: options in their shown order,
    with no answer key.
  - An answer arrives as a shown position. It is converted back to the real
    option index before it is stored, so results never depend on one student's
    shuffle.
- **The answer key is revealed only after an answer.** In `instant` mode the
  answer's reply includes whether it was right and the correct position. In
  `end` mode it includes neither, until the attempt is complete.
- **Answering is idempotent.** It is unique per attempt and item, so a retried
  request gets the first result, not a second answer.
- **Starting is idempotent too.** Partial unique indexes allow one attempt in
  progress per student per assignment (or practice set), and one of each
  number. When two starts race (a double tap, or React's dev double effect),
  the one that loses the insert joins the winner (`AttemptService._create`).
  Migration `b7c4e2a9d130` cleared the twins an earlier race had left.
- **Retakes.**
  - `allow_retakes` and `max_attempts` limit how many attempts a student gets.
  - Starting again while an attempt is running resumes it.
  - Starting after the retakes are used up returns the last attempt.
  - A closed assignment refuses a new attempt but still shows old ones.
- **Late** is recorded (`is_late`) and never refused. A due date is a nudge,
  not a lock.
- **Events** (`events/catalog.py`):
  - `AttemptCompleted` notifies the teacher.
  - `BadgeAwarded` notifies the student.
  - The realtime subscriber pushes `{"topic": "leaderboard", "assignment_id"}`
    on the SSE event `leaderboard` to everyone in the audience, after commit.
- **Podium medals are awarded once.** When a leaderboard is final (closed, or
  past due), the first read or finish settles it. `ranks_awarded_at` records
  that, so nothing is awarded twice.
- **Streak** counts days in a row, ending today or yesterday, on which the
  student finished something.

## Configuration

None. The feedback mode, shuffles, retakes, due date and leaderboard are chosen
per share (`ShareDialog`, `assignments` columns).

## Extending

- **A new badge.** Write a class with `key`, `name`, `description`, `hint` and
  `evaluate(ctx) -> Award | None` in `badges/rules.py`, then add it to `RULES`
  in `badges/catalog.py`. `Context` carries what a rule may look at. If a rule
  needs more, add a field there, not a query in the rule.
- **A new learning kind** (`learning/base.py`) is playable once it implements
  `public()` and `grade()`. The attempt service never names a kind, except
  that feedback mode applies to quizzes only.

## Known limits

- **Only first attempts rank**, so a student who retakes and improves keeps
  their first place. This is deliberate: it stops "retake until top".
- **Podium medals settle lazily.** They settle on the first leaderboard read or
  finish after the due date, not at the due date itself; there is no scheduler.
- **Insights need at least two answers per skill** before a skill is called
  strong or one to practise. With less than that it shows as *growing*.
- **Duration is wall time** from start to finish, including time the tab spent
  closed.
- **The heatmap and per-question numbers use first attempts only**, the same
  as the leaderboard. Retakes show as the best score in the student row.
- **Round 2 of flashcards is not saved.** Reloading during round 2 returns to
  the "Round 2?" prompt, not to the card the student was on.
- **The teacher's results page refreshes on news**: the bell or a leaderboard
  push. On a flashcard assignment without a leaderboard, it updates when the
  "finished" notification arrives.
