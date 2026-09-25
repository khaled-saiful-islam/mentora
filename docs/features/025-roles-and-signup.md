# 025 — Roles, signup and preferences

## What it does

Every account has one of three roles:

| Role | Signs up with | Signs in with |
|---|---|---|
| **Teacher** | name, email, password | email |
| **Student** | name, grade, username, password — no email | username |
| **Admin** | seeded, or created by an admin | email or username |

What each role may do is decided in one place,
`app/policies/capabilities.py`, and enforced on the backend:

- **Studio artifacts** (posters, slides, games, websites, apps) are for
  teachers and admins. A student is refused at every artifact route (403), at
  the chat route's `artifact_id`, and — the last line — never has the artifact
  tools built into their turn at all.
- **Public share links** to a conversation are for teachers and admins.
- **The chat is closed to students for now** (`use_chat`). They make practice
  quizzes and flashcards from Practice (`POST /api/learning-sets`, which is not part
  of the chat) and take their class's work. Every chat route — the stream,
  conversations, their files and memories — refuses them with a 403 at the
  router, and the menu, `/chat` and `/c/…` are hidden and redirect home.
  Re-opening it is `use_chat=True` on the student row of the capability table;
  the guardrails in `032-guardrails.md` still screen every student turn.
- **Admin routes** are admin-only, with the gate on the router itself.

The grade scale is Malaysian: Year 1–6, Form 1–5, Lower Six, Upper Six
(`app/core/grades.py`), served in picker order by `/api/config`.

Each person has **display preferences** — text size, font style, motion and
sound — plus a **buddy** (the companion a student picks) and an onboarding flag.

## How it works

- `users.role` is the only source of truth. `User.is_admin` is a hybrid
  property derived from it, so queries and code that ask "is this an admin?"
  still read naturally, and there is no second column to disagree.
- `email` and `username` are both nullable, with a check that at least one is
  set. Unique indexes allow many NULLs.
- **Capabilities** are a frozen dataclass per role. An unknown role gets
  nothing (fail closed). `require_capability("name")` and
  `require_roles(Role.X, ...)` in `api/deps.py` turn them into dependencies;
  `UserResponse.capabilities` tells the browser the same answers.
- **Preferences** store only overrides. Defaults come from the role at read
  time (students: 115% text, playful fonts; staff: 100%, classic), so a better
  default reaches everyone who never changed theirs. Reading is forgiving —
  a stale value falls back to the default — and writing is strict.
- `/api/me/makeable` lists the studio kinds this person may make (empty for a
  student). `/api/config` no longer lists them, because it does not know who
  is asking.
- The username check suggests free alternatives (`adam` → `adam2`, `adam3`…),
  because a dead end at signup is a lost student.

## Endpoints

```
POST  /api/auth/signup/teacher      {name, email, password}
POST  /api/auth/signup/student      {name, grade_level, username, password, invite_token?}
GET   /api/auth/username-available?u=
PATCH /api/auth/me                  {display_name?, email?, buddy?}
PATCH /api/auth/me/preferences      {text_scale?, font_style?, motion?, sound?}  null resets
POST  /api/auth/me/onboarded
GET   /api/me/makeable
```

## Configuration

None new. Text scales, font styles and buddies are code (`services/preferences.py`,
`core/buddies.py`) because the frontend has to draw each one.

## Extending it

- **A new capability**: add a field to `Capabilities`, set it per role, add a
  row to the matrix in `tests/test_roles.py` (the test fails until you do),
  and a refusal message in `api/deps.py`.
- **A new role**: add it to `Role`, give it a `Capabilities` entry, widen the
  `ck_users_role` check in a migration.
- **A new preference**: add it to `Preferences`, its allowed values to
  `_ALLOWED`, and its default per role.

## Known limits

- **Student password recovery has no self-service path** — students have no
  email. An admin (and, from the classes phase, their teacher) resets it.
- **Changing a student into a teacher is refused**, not converted: the two carry
  different data (grade, no email).
- The username check is rate-limited with sign-in, per address; a school behind
  one NAT shares that budget.
- The migration's downgrade refuses once any student exists, rather than
  inventing email addresses for children.
