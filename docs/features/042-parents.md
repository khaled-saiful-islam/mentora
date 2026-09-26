# 042 — Parents

A fourth kind of account, for a child's parent or carer (PLAN.md §20). This
page grows phase by phase. **Built: P0, the role and the link; P1, seeing
the child; P2, making and sending work home; P3, past-due alerts.**

## What it does

- **A parent signs up** from a third door on the sign-up chooser, *"I'm a
  parent"*. It asks for a name, an email and a password, and who they are to
  the child: *Mum, Dad, Guardian*, or their own words.
- **The child's invitation links them.**
  - In **Settings → My family**, a student has a 6-letter code, a link
    (`/family/<token>`) and a QR code.
  - The invitation works for 14 days. It can be turned off or made anew.
- **Every way in lands in the same place:**
  - A parent who opens the link signed out meets the child's buddy, then
    makes an account (connected in the same step) or signs in and connects.
  - A parent who signed up on their own types the code on their home page.
  - Either way, the child gets a bell note: *"Mum is following along now!"*
- **The parent's home** shows each child: their buddy, name and grade, what
  they call the parent, and their classes with each teacher. It also has a
  *Connect another child* card.
- **Teachers** see a heart badge beside each student with family connected,
  saying who: *"Siti Aminah (Mum)"*.
- **Only the parent can disconnect** (a button on the child's card, with a
  confirmation). The child sees who is connected but cannot remove them.

## How it works

- `Role.PARENT`, with capabilities `see_children` (parents) and
  `invite_family` (students). `make_family_sets` is declared for P2. The
  matrix test asserts every cell for all four roles.
- Tables (migration `c5e2a9d4f713`):
  - `family_links`: parent and student, with the label. A pair is unique.
  - `family_invites`: one per student, with token, code, enabled and expiry.
- `services/family_service.py`:
  - `child(parent_id, student_id)` is the gate for every parent read. A child
    who is not linked is *not found*, the same rule as classes.
  - `connect()` checks the invitation is alive and the account is a parent.
    It enforces 4 parents per child and 8 children per parent, and is
    idempotent.
  - A dead invitation answers the same way whether it was off, expired,
    renewed or never real.
- Signing up through an invitation connects in the same transaction. A dead
  invitation never blocks the account.
- `FamilyLinked` → the child's bell note (`family_linked`) and a `family`
  realtime push to both.

## Seeing the child (P1)

- **The parent's home card** shows the child's week:
  - streak, badges, how much is waiting, and anything past due in coral;
  - the next three pieces of work and the last three results;
  - the next live lesson, and their classes with each teacher.
  - *See everything* opens the child's page.
- **The child's page** (`/children/:id`) has the child's buddy, name and
  grade, the same numbers, and six tabs:
  - **Overview:** what is waiting (past due first), the latest results,
    live lessons coming up, strong and weak skills, and *Made for them*.
  - **Work:** everything shared, grouped *Past due*, *To do*, *Done* and
    *Closed*. A finished piece has *See answers*.
  - **Results:** skills and every finished try, as on the child's own
    Results page.
  - **Practice:** the child's own sets and those Mentora made for them,
    with the best score and number of tries.
  - **Schedule:** lessons coming up, and past ones with *Was there* or
    *Missed it* and the lesson's notes.
  - **Classes and teachers:** each class, and what it covers, with how the
    child did on each topic. It is the same report a teacher can send home.
- **See answers** (`/children/:id/attempts/:attemptId`) is the child's own
  review, labelled with the child's name, without *Try again*.
- **Live:** the page and the home card refresh as the child works. The
  `child` push carries whose page changed. It fires when the child finishes
  something, earns a badge, gets practice made, joins or leaves a class, or
  gets new work, a changed due date, or a lesson added or cancelled.

How it works:

- `api/routes/children.py`: every route starts at `FamilyService.child`, then
  calls the child's own services for the child's id: `StudentHomeService`,
  `ResultsService`, `LiveSessionService.for_student`, `AttemptService.view`
  and `CoverageService.for_student`. A parent sees what the child sees.
- `services/child_view_service.py` builds the two things the child's pages
  do not already: best score per practice set, and lesson attendance.
- Lesson notes for a parent are the key points only. The transcript names
  classmates, so it is left out.
- `realtime.child_did`, `children_got` and `children_saw_change` look up the
  parents with `FamilyService.watchers` and push `child` to each.

## Making and sending work home (P2)

- **Parents make quizzes, flashcards and study guides** with the same Create
  sheet and grounded generator as teachers, from a topic, their own files
  (**Library → My materials**) or both. The parent's home has a *Make
  something for Aina* card; the Library lists what they made.
- **Send home** (on each Library card and in the editor): choose which
  children, and a due date if you like.
  - Sending again to the same child moves them to the latest version and the
    new due date, without a second bell note.
  - *Take back* removes it from the child's home.
- **The child** gets *"Mum sent you a quiz: …"* in the bell, and a **From
  home** section on their home. They take it like practice: resume, or go
  again as often as they like. It counts for badges (*Perfect Score* and
  *Star Scorer* included) and for skills.
- **The parent hears back**: *"Aina finished Fractions — 80%"*, opening the
  answers. The child's page shows it in Work and on the overview, marked
  *From you*, or *From Dad* when the other parent sent it.
- The background tray and the *ready* bell note work for parents as for
  teachers, and say what to do next in their words: *"Look it over, then
  send it home."* The work ticket carries the set's purpose for this.

How it works:

- `purpose = "family"` joins `assign | practice` (migration `e8a4c2f1b735`).
  `GenerationService._purpose` picks it for anyone with `make_family_sets`,
  within `PARENT_SETS_PER_DAY`.
- `family_shares` (parent, child, set, version, due), one per set and child.
  `services/family_share_service.py` shares (the set must be the parent's
  own, `family`, and ready; each child must be linked), takes back, and lists
  a child's work from home with status and best score.
- Every read joins `family_links`, so once a parent disconnects, the child no
  longer sees what they sent and cannot start it.
- `AttemptService.start_from_home` takes the share's version. An attempt on
  a family set finds its share for the due date (late marking, the Early
  Bird badge).
- Events: `FamilyWorkShared` → the child's `family_shared` note, an
  `assignments` push to the child and `child` to their parents.
  `AttemptCompleted.shared_by` → the parent's `family_done` note.
- Parents gain `make_family_sets` and `keep_materials`.

## Past-due alerts (P3)

- When a child's work passes its due date unfinished, **every parent linked
  to them hears within a minute**: *"Aina hasn't finished The Water Cycle —
  it was due today at 5:00 pm"*, saying where it came from (*From 4 Cerdik*,
  or *Sent from home by Dad*). *See their work* opens the child's Work tab,
  where it sits under *Past due*.
- It covers both teachers' work and work sent home.
- **Once per piece of work, due date and child.** Reading the note does not
  bring it back. A moved due date is a new deadline, and can be missed again.
- **Nothing is sent** for work finished before the watcher looks (late or
  not), a closed assignment, an archived class, a child who has left the
  class or the group, a child with no parent, or a parent who has
  disconnected.

How it works:

- `services/due_watcher.py`, a loop in the app's lifespan like the
  live-lesson clock. Every `DUE_WATCHER_SECONDS` it reads the work due in the
  last `OVERDUE_LOOK_BACK_HOURS`, for the children it is shared with now.
- Each alert is claimed in `overdue_notices` (`work_key`, `student_id`) with
  `INSERT … ON CONFLICT DO NOTHING`, in the same transaction as the notes. A
  restart, a second tick or a second worker cannot repeat it, and a failed
  tick is retried next time. The key is `class:<assignment>:<due>` or
  `home:<share>:<due>` (migration `f1c9d3e2a846`).
- `ChildOverdue` → a `child_overdue` note for each parent, with the bell's
  own live push.
- Tests drive `check(session, now)` with a clock set years ahead, so nothing
  in a shared database falls in the window.

## Endpoints

```
GET    /api/me/family                    the child: invitation + who is connected
POST   /api/me/family/invite/rotate      a new code and link
PATCH  /api/me/family/invite             {enabled}
GET    /api/family/invites/{key}         open, rate limited: {first_name, buddy}
POST   /api/family/connect               a parent: {key, label}
POST   /api/auth/signup/parent           {name, email, password, invite?, label?}
GET    /api/me/children                  a parent's children
GET    /api/me/children/{id}/classes     that child's classes and teachers
DELETE /api/me/children/{id}             the parent disconnects
GET    /api/me/children/{id}/overview    the week: waiting, done, latest, upcoming, skills
GET    /api/me/children/{id}/work        every shared piece + review_attempt_id
GET    /api/me/children/{id}/results     history + skill insights
GET    /api/me/children/{id}/practice    own and made-for-you sets, best + tries
GET    /api/me/children/{id}/schedule    upcoming, and past with attended
GET    /api/me/children/{id}/schedule/{session_id}/notes    key points, once ended
GET    /api/me/children/{id}/attempts/{attempt_id}          one try, answer by answer
GET    /api/me/children/{id}/classes/{class_id}/coverage    the class's map, for the child
POST   /api/family-shares                {set_id, student_ids, due_at?}: send home
GET    /api/family-shares?set_id=        who a set has been sent to
DELETE /api/family-shares/{id}           take it back
POST   /api/me/from-home/{share_id}/attempts   the child starts or resumes it
GET    /api/me/home                      + from_home, for the child
```

## Known limits

- **A preview shows a first name and a buddy to anyone with the link or
  code.** It shows nothing else, and the look-up is rate limited per address.
- **A parent's account is one email.** Two parents share nothing but the
  child; each connects with the child's invitation.
- **The parent chat arrives in P4.**
- **Only the last `OVERDUE_LOOK_BACK_HOURS` (48) are watched.** Work that went
  past due longer ago — while the server was down, or before this shipped —
  is never announced.
- **The alert is to the minute, not the second.** It waits for the next
  tick, 60 seconds by default.
- **One API worker, like the live clock.** A second worker would run a second
  watcher. The ledger still stops duplicate alerts, but the work is done
  twice.
- **Two parents do not see each other's sets** in their libraries. Each sees
  everything sent to the child, labelled with who sent it.
- **Work from home has no retake limit and no end-of-quiz mode.** Feedback
  is instant, as for practice.
- **An archived family set leaves the child's home.** What the child already
  finished stays in their results.
- **The home card asks for each child's week separately**: one request per
  child, at most 8.
- **Work in progress is not pushed live.** The parent's page changes when a
  piece is finished, not with each answer.
- **A study guide's review is its score only.** Its parts are read, not
  answered, so there is no answer-by-answer view.
