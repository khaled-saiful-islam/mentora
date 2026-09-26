# 040 — Made for you: practice from what a student found hard

## What it does

When a student finishes a quiz or flashcard deck their teacher shared:

1. Mentora finds the skills they got mostly wrong (under 60% right, the
   weakest first, up to three).
2. In the background, it makes a small practice set just for them:
   - Five questions or cards on exactly those skills.
   - Grounded in the same sources as the shared set.
   - Tagged by the same skills, so their results land where the weakness
     showed.
3. Their buddy announces it in the bell: *"Kiko made you a practice quiz on
   Evaporation!"*, with a **Practise now** button.
4. It waits on their home page under **Made for you**, with the weak spots
   it works on and where it came from. Once they have done it, the card says
   so and offers *Go again*.
5. **Worth another look** chips link straight to that practice when there is
   one.

## How it works

- **Deciding** happens in the attempt's own transaction:
  - `events/subscribers/practice.py` reacts to `AttemptCompleted`.
  - `AutoPracticeService.plan()` checks that it was a shared quiz or deck, that
    the owner is a student, that nothing was made for this assignment already,
    and that fewer than `PER_DAY` (3) were made in the last 24 hours.
  - It then reads this attempt's answers per skill.
- **Making** starts only after that transaction commits (`services/after_commit.py`,
  the same rule realtime pushes follow), in its own task:
  - `make_practice()` inserts an `auto_practice` row. One per student per
    assignment is a unique constraint, so a race cannot make two.
  - It begins the set as the student's practice with `made_for=True`. That
    skips their own daily practice limit, and `practice_made_today` never
    counts these sets.
  - It runs the ordinary generator with the given sources and skills.
  - On success it publishes `PracticeMade`, and the notification subscriber
    writes `practice_ready`.
- **Showing:** `GET /api/me/home` carries `made_for_you`, the ready rows with
  their set and whether the student has finished it. The home page reloads
  when a `practice_ready` note arrives.

## Configuration

None. The numbers are constants in `services/auto_practice.py`:
`WEAK_BELOW`, `MOST_SKILLS`, `PER_DAY` and `COUNT`.

## Extending it

- **Another kind**: add it to `PRACTISED_AS`, which says what each shared kind
  is practised with.
- **Another trigger**, such as a live lesson's quiz: call
  `AutoPracticeService.plan` with that event's attempt. Everything after the
  plan is shared.

## Known limits

- **In-process.** A restart in the middle of a build loses it. The row stays
  `making` and is never retried, and that assignment gets no practice.
- **A failed build is quiet.** The student never asked for it, so they are not
  told. The log says why.
- **One attempt decides.** Weak spots come from the attempt just finished, not
  from the student's whole history (`ResultsService.insights` has that).
- **Small quizzes give rough signals.** One wrong answer on a skill with a
  single question counts as weak.
