# 042 — Parents

A fourth kind of account, for a child's parent or carer (PLAN.md §20). This
page grows phase by phase. **P0 (built): the role and the link.**

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
```

## Known limits

- **A preview shows a first name and a buddy to anyone with the link or
  code.** It shows nothing else, and the look-up is rate limited per address.
- **A parent's account is one email.** Two parents share nothing but the
  child; each connects with the child's invitation.
- **Chat, sharing material and past-due alerts arrive in P2–P4.**
