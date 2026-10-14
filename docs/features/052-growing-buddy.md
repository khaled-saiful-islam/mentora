# 052 — A buddy that grows as you learn (§28.3.1, phase 1)

Every student's buddy starts as a **tiny baby animal** and grows up as they
learn: a kancil fawn, a kitten, an owlet, a baby orangutan or a tiger cub.
Growing up is a celebration, with each stage bringing new moves to show off.
New buddy friends are earned with badges. This phase also brings the "wow"
groundwork the later phases use: a celebration queue, a full-screen scene,
two new buddy sounds and a short buzz on phones.

## What a student sees

| Stage | Growth | Looks | Show-off moves it learns |
|---|---|---|---|
| **Newborn** | 0 | small, big head, big eyes, wobbly | giggle, yawn, wiggle, nod, nap, think |
| **Little one** | 10 | a little bigger, still wobbles | + wave, hop, smile, look around, listen, hug |
| **Young** | 60 | nearly grown | + dance, bounce, stretch, twirl, clap, cheer |
| **Grown** | 200 | as the buddy always was | + star jump, flex, and **its own trick** (Kiko's backflip, Momo's leaf umbrella, Rimau's roar…) |

- **Arrival.** The first time after this release, a full-screen scene
  introduces the baby: "Baby Momo!", with the four stages and a growth bar.
  A new student meets the baby on the welcome screen instead.
- **Growing up.** When a stage is reached, a scene shows the buddy at its old
  size, then growing before the child's eyes, with sparkles, a rising sound,
  confetti and a buzz. Then it performs each move it has just learned, one
  after another, while the moves are listed.
- **The finish screen** says what the work did: "Momo grew +3!", with the bar
  filling. A stage reached fills the bar to the brim ("Ready to grow up!");
  the grow-up scene plays once the child leaves the finish screen.
- **Tapping a young buddy** does the best move it knows so far, and sometimes
  says "When I'm a grown-up orangutan, I'll do my leaf umbrella!".
- **The buddy page** has:
  - the stage path and the growth bar ("34 of 60 growth to Young");
  - **How Momo grows**: the table below;
  - every move as a collection: learned ones play, locked ones say the stage
    they come at;
  - **Buddy friends** (28.3.1, rule below).

### What makes it grow

Only learning (`app/growth/rules.py`):

| Learning moment | Growth | Counted |
|---|---|---|
| Finish a quiz, deck, study guide or game | +2 | once per set per day |
| Three stars (90% or more) | +2 | once per set |
| A day with something finished | +1 | once per day, in the school's time zone |
| A badge | +3 | once per badge and scope |
| A skill mastered (80%+ over 8 answers across 3 sets) | +10 | once per skill |

It never shrinks, gets sick or goes back: points are never taken away.

### Buddy friends

- A student's **first buddy** is theirs to pick. It stays free to change
  ("Pick again" on the welcome screen) until they have learned anything and
  met the baby.
- After that, **one new buddy for every three badges**: the 2nd at 3 badges,
  then 6, 9 and 12. When one is earned, the child picks who to meet next.
- Buddies already met can be switched between freely. **Growth belongs to the
  child, not the animal**: a new buddy arrives at the child's stage.
- On the buddy page, an unmet buddy is a dark silhouette with a lock and
  "3 more badges". The server refuses one not yet earned, with the same words.
- Badges earned before this release count.

### Who sees what

- **Students**: their own buddy at their stage, everywhere it appears: home,
  the corner companion, play, the finish screen, the bell, the buddy page.
- **Parents**: their child's buddy at the child's stage, and on the child's
  page "Momo is a young orangutan · 12 skills mastered".
- **Teachers and parents' own buddies** are grown, with every move. So are
  classmates' buddies on leaderboards and in live rooms (see limits).

## How it works

- **A ledger, written by event reactions.**
  - `buddy_growth` has one row per learning moment, unique on
    `(student, source, source_id)`. A retake, a replayed event or a second
    tab can never count twice: the insert is `ON CONFLICT DO NOTHING`.
  - `events/subscribers/growth.py` reacts to `AttemptCompleted` and
    `BadgeAwarded` inside their transaction, so growth and what earned it land
    together. Each reaction is one registry line.
  - `BadgeAwarded` now carries the badge's `scope`, which makes each award
    one of a kind.
- **Stages are worked out, never stored.** `GET /api/me/growth` sums the
  ledger and says:
  - the stage and where the next one starts;
  - what is not celebrated yet (`seen_points`, `arrived`);
  - the buddies met, and badges to the next.

  `POST /api/me/growth/seen` marks it celebrated. `buddy_progress` keeps
  that, and the buddies met.
- **The choice is enforced by the server.** `PATCH /api/auth/me` with a
  buddy asks `GrowthService.choose` first.
- **Drawn by parameters, not new art.**
  - Each rig's frame shrinks the body about its feet. The head (`Head` in
    `rigs/Rig.tsx`) and the eyes grow relative to it. A baby wobbles.
  - The stage reaches the rig through a context (`look.ts`), so an avatar or
    a classmate's buddy, given none, is grown.
  - Particles start from the smaller head (`shrunk`).
- **Moves.**
  - `growth.ts` lists when each show-off move is learned. Fidgets and the
    tap use only learned ones.
  - A move not listed is a reaction (*oops*, *cheer*, *point*…) and plays at
    every stage, so the feedback a child learns from never depends on growth.
- **Client state.**
  - `GrowthProvider` loads growth for students, again on returning to the
    tab, and on `refresh()` after a finish.
  - The last stage is kept in `localStorage`, so a buddy is drawn at its
    size from the first frame.
  - `Buddy` takes `stage`, or `own` for the signed-in student's own buddy.
- **Celebrations (§28.4).**
  - `CelebrationProvider` queues big moments one at a time, each once, and
    holds them while a quiz, game, practice or live room is open.
  - `Scene` is the full-screen shell: a glow, slow rays, confetti, one
    button. It's a labelled dialog: focus in and back, Escape closes.
    Reduced motion stops the rays and the confetti.
  - Behind a scene, other buddies keep quiet.
- **Feel.**
  - Two new synthesised buddy sounds: `grow` (climbing the scale) and
    `unlock`.
  - `lib/haptics.ts` buzzes on Android, only with sound on and only after
    the first tap on the page, as browsers require.

## Configuration

None. The numbers are in `app/growth/rules.py`, and in `growth.ts` for the
stage thresholds the client draws (keep the two in step).

The time zone for "a day" is `DEFAULT_TIMEZONE`. Set it to
`Asia/Kuala_Lumpur` on a Malaysian deployment, or a day starts at 8 am.

## Extending it

- **A new way to grow:** a point value in `POINTS`, and an `award(...)` call
  in a reaction to the event that earns it. The Daily Quest (phase 4) and
  second chances (phase 5) will be two more.
- **A new move:** add the mood to `LEARNED_AT` with its stage, and a name to
  `MOVE_NAMES`. The buddy page lists it if it has a button.
- **Another big moment:** `useCelebrate()({ id, render })` with a `Scene`.

## Known limits

- **Existing students' buddies became babies** with this release (decided
  2026-10-13). The arrival scene and a fast first stage (10 points, about a
  day's work) soften it; watch for complaints.
- **Classmates' buddies are drawn grown** on leaderboards, in live rooms and
  in results. Only the student's own buddy, and a parent's child's, show their
  stage.
- **The Skill Master badge only ever looks at the first mastered skill**: an
  older quirk of `badges/rules.py`, left as is. Growth checks every skill
  itself.
- **Growth is counted in the request that finished the work.** A failure in
  the reaction is logged and the work stands, but that growth is lost.
- **The stage thresholds live in two places** (`rules.py` and `growth.ts`).
  The server's answer always wins; the client copy only draws the bar.
- **A first pick stays free until the baby is met.** An existing student who
  changes buddy before the arrival scene has played gets that change free.
