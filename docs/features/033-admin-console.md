# 033 — The admin console

## What it does

`/admin`, for admins only, has four tabs.

- **Overview.** It shows:
  - people: total, active this week, new, and by role
  - learning: classes, sets, and what was shared and finished this week,
    with the average score
  - tokens spent in the last 24 hours, on chat and generation
  - the safety queue
  - suspended accounts
  - two weeks of activity: activities finished and chat messages per day

  A student who may need support puts a red banner at the top.
- **People.** Search by name, username or email, and filter by role and
  status, 50 at a time. Each person opens to these actions:
  - **reset password**: a readable temporary one such as `mango-tiger-47`,
    shown once with a copy button
  - **suspend or restore**
  - **daily token limit**
  - **delete**, which first lists what goes with the account (classes, their
    students' work in them, sets, activities, chats), and needs the sign-in
    name typed

  Admins can also create an account for a student who cannot sign up alone.
- **Safety.** The moderation queue. The most serious open items come first.
  - **A support item** carries safeguarding guidance, and what the student
    said stays hidden until the reviewer chooses to see it.
  - **Every item can be marked reviewed or dismissed with a note,** and
    reopened later.
- **Content.** Every quiz and flashcard set, and every studio piece, whoever
  made it.
  - A set opens to its questions, with the answers marked.
  - A studio piece opens in a sandboxed frame, under the same content policy
    its owner sees, so it cannot read the admin's session.

**Teachers can also reset a student's password,** from the student's row in
the class's Students tab. This works only for students approved into that
teacher's own class.

## How it works

```
api/routes/admin.py          /api/admin/users…  list (q, role, status, offset),
                             create, update, footprint, delete (?confirm=), password
api/routes/admin_console.py  /api/admin/overview, /moderation, /content/…
services/admin_service.py    paging with usage for the page in two queries,
                             footprint, delete, reset
services/admin_stats_service.py   one aggregate query per figure
services/content_service.py       read-only listings and the set/document lookups
core/passwords.py            temporary passwords: two words and two digits
```

- **Every route is behind `current_admin`**, as a router dependency. The
  route walk in `test_rbac.py` checks each one refuses a teacher and a
  student.
- **"Active this week"** reads `users.last_seen_at`. It is stamped on any
  authenticated request, at most every ten minutes.
- **Deleting uses the database's cascades.** Deleting a teacher takes their
  classes, and with them their students' attempts in those classes.
  Moderation events for a deleted student go too.

## Configuration

None.

## Extending

- **A new overview figure** is a method on `AdminStatsService` and a key in
  its dict. The page reads the keys it knows.
- **A new kind of moderation event** needs its `kind` string where it is
  recorded, and a look in `KINDS` in `SafetyTab.tsx`. Unknown kinds show as
  "Flagged".

## Known limits

- **The content browser shows the newest 50 of each kind.** Search narrows
  it; there is no paging beyond that yet.
- **No audit log of admin actions.** Deletes and resets are logged to the
  server log only.
- **A temporary password does not force a change** at next sign-in.
- **Day boundaries in the trend are UTC,** not Malaysia time.
