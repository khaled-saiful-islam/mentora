# 042 — Parents

A fourth kind of account, for a child's parent or carer (PLAN.md §20). This
page grows phase by phase. **Built: P0, the role and the link; P1, seeing
the child.**

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
```

## Known limits

- **A preview shows a first name and a buddy to anyone with the link or
  code.** It shows nothing else, and the look-up is rate limited per address.
- **A parent's account is one email.** Two parents share nothing but the
  child; each connects with the child's invitation.
- **Chat, sharing material and past-due alerts arrive in P2–P4.**
- **The home card asks for each child's week separately**: one request per
  child, at most 8.
- **Work in progress is not pushed live.** The parent's page changes when a
  piece is finished, not with each answer.
- **A study guide's review is its score only.** Its parts are read, not
  answered, so there is no answer-by-answer view.
