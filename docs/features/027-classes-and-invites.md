# 027 — Classes, groups, invites and joining

## What it does

- A teacher runs any number of **classes** (name, subject, grade, colour), each
  with any number of **groups**. A student can be in several groups of a class.
- Every class is born with one **invite**: a link (`/join/<token>`) and a
  six-character **class code** for typing off a whiteboard. A QR code of the
  link is shown for projectors. The teacher can turn the invite off, set it to
  expire, or rotate it (a new link and code; the old ones die at once).
- A student joins by opening the link or typing the code:
  - **New students** sign up through the link; the account and the join
    request are created in one transaction.
  - **Existing students** who open a link while signed in have the request
    sent automatically — the click on the link was the ask.
  - A dead invite at signup does not block the account; the student is told.
- The teacher gets a notification and **approves or declines** it — from the
  bell, from the Requests tab, or everyone at once. Declining is quiet: the
  student is not sent a message about it.
- Approved students go into the class (not a group); the teacher assigns
  groups by ticking students and choosing a group, or from the group itself.
- The teacher can **remove** a student; the student can **leave**. Either way
  they leave every group in that class, and their history stays.
- Classes are **archived**, not deleted, and can be restored.
- **Class cards show how things are going.**
  - A teacher's card shows who is in the class (their faces), how many things
    are shared and still open, the class's first-try score, what was finished
    this week, and the next live lesson.
  - Above the cards, one strip counts students, who is waiting to join and
    what is shared, and shows the next live lesson (or offers to plan one).
  - A student's card shows what is left to do, what is finished and their next
    live lesson in that class. The join box sits beside the classes, not on
    top of them.

## How it works

- Tables: `classes`, `class_invites` (one per class: `token`, `code`,
  `enabled`, `expires_at`), `class_memberships` (unique per class+student,
  status `pending → approved | rejected`, `approved → revoked | left`; never
  deleted), `class_groups`, `group_members`.
- **Ownership is a lookup parameter**: `ClassRepository.owned(class_id,
  teacher_id)`. Another teacher's class is *not found* (404), never
  *forbidden*, which would confirm it exists.
- **Every dead invite answers identically** — disabled, expired, rotated,
  archived, or never existed: *"This invite isn't working any more — ask your
  teacher for a new one."* Lookups and joins are rate-limited per address
  (`RATE_LIMIT_INVITE_PER_MINUTE`, default 30).
- Codes use an alphabet without 0/O/1/I/L (31⁶ ≈ 887 million codes).
- **Domain events** (`app/events/`): services publish `MembershipRequested`,
  `MembershipApproved`, `MembershipRejected`, `MembershipEnded`; subscribers in
  `events/subscribers/` write notifications. Each subscriber runs in its own
  savepoint and its failures are logged, so a reaction can never undo the
  action.
- Router gates: `/api/classes/*` needs `manage_classes`; joining and
  `/api/me/classes` need `join_classes`.
- **The card numbers** come from `services/class_pulse.py`, on
  `GET /api/classes` (the `pulse` field) and `GET /api/me/classes`. It costs a
  handful of grouped queries for any number of classes. Single-class
  endpoints leave `pulse` out.

## Endpoints

```
GET|POST        /api/classes                         ?archived=true
GET|PATCH|DELETE /api/classes/{id}                   DELETE archives
POST            /api/classes/{id}/restore
GET|PATCH       /api/classes/{id}/invite             {enabled, expires_at, clear_expiry}
POST            /api/classes/{id}/invite/rotate
GET             /api/classes/{id}/members            ?status=&q=&limit=&offset=
POST            /api/classes/{id}/members/{mid}/approve | /reject
POST            /api/classes/{id}/members/approve-all
DELETE          /api/classes/{id}/members/{mid}      remove, history kept
GET|POST        /api/classes/{id}/groups
PATCH|DELETE    /api/classes/{id}/groups/{gid}
PUT             /api/classes/{id}/groups/{gid}/members   {student_ids}
GET             /api/invites/{token-or-code}          public preview
POST            /api/invites/{token-or-code}/join     students
GET             /api/me/classes
POST            /api/me/classes/{id}/leave
```

## Extending it

- **React to a membership change** (an email, an analytics event): write a
  subscriber and add one line to `events/registry.py`. The services do not
  change.
- **Another way in** (a CSV roster import): call
  `MembershipService.request` per student — the events and notifications come
  with it.

## Known limits

- **Declined students can ask again** with the same link. A teacher who wants
  someone kept out rotates the invite.
- **A group removed from a class takes its membership rows**, not the
  students. Work shared with that group (a later phase) stays with the
  students who had it.
- The member search is a simple `LIKE` on name and username; fine for a class,
  not for a school directory.
