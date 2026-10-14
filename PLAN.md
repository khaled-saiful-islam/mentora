# Mentora — Implementation Plan

> **Status: APPROVED 2026-09-24 — Phases 1–5 done (roles, design, classes, learning sets, taking/results/buddies); Phase 6 (guardrails & admin) next.**
> **§19 Live AI group tutoring — approved 2026-09-26. Phases 0–5 built (docs/features/036–038); waiting on your testing.**
> **§20 Parents — approved 2026-09-26. P0–P5 built (docs/features/042); waiting on your testing.**
> **§21 My materials — requested 2026-09-26. Built (docs/features/043).**
> Mentora is a fork of Pelita (`~/projects/pelita` @ `5a23f41`). This plan reuses
> Pelita's stack, layering and Protocol-plus-registry design, and extends it into a
> teacher–student learning platform.
>
> **§0** records your decisions. Everything else I had to decide is in
> **§17 Defaults I chose**, flagged so you can overturn it.

---

## 0. Decisions (answered 2026-09-24)

| # | Topic | Decision |
|---|---|---|
| Q1 | GitHub | `khaled-saiful-islam/mentora` (exists, empty); push over the `github-personal` SSH alias, as Pelita does |
| Q2 | Visibility | **Public** |
| Q3 | History | Fresh — first commit `chore: fork Pelita @5a23f41` *(default)* |
| Q4 | Theme | One Mentora palette, **light + dark** |
| Q5 | Icon | **One logo mark** (favicon, PWA icon, brand). Phosphor as the single UI icon set *(default)* |
| Q6 | Student practice | **Students can generate their own private practice** quizzes/flashcards (§8.8) |
| Q7 | Student chat | Yes — guardrailed study buddy *(default)* |
| Q8 | Grade scale | **Malaysian only**: Year 1–6, Form 1–5, Lower 6, Upper 6 |
| Q11 | Leaderboard | **Quizzes only.** Flashcards get no leaderboard |

**Still on defaults — change any of these before its phase starts:**

| # | Topic | Default |
|---|---|---|
| Q9 | Set language | Teacher/student picks from `en, ms, ta, zh, bn`; default English |
| Q10 | Teacher signup | Open; admin can suspend |
| Q12 | Leaderboard privacy | Students see top 10 + own rank; teacher sees all and can turn it off |
| Q13 | Counting attempt | First completed attempt counts for leaderboard and rank badges |
| Q14 | Cadence | Summary after each phase, then wait for your "go" |
| Q15 | Ports / names | Web 8300 · API 8301 · DB 8302 · Vite dev 8303 · `mentora-backend` / `mentora-frontend` / `mentora-db` |
| Q16 | Local `.env` | Pelita's `LLM_*` + `SERPAPI_KEY` copied locally (gitignored); new `JWT_SECRET` |
| Q17 | Credit | One "Forked from Pelita" line in the README; no other mention |
| Q18 | Extras | ✅ items in §16 |

---

## 1. What Pelita gives us (facts that shape this plan)

| Area | Pelita today | Consequence for Mentora |
|---|---|---|
| Stack | FastAPI · Py 3.12 · SQLAlchemy 2 async · Alembic · Postgres 16 · React 18 · TS strict · Vite 6 · **Tailwind v4 (CSS-first)** · Docker Compose + Makefile | Keep all of it |
| Layering | `api/` = HTTP only. `services/ providers/ guards/ context/ tools/ core/` never import FastAPI (AST test) | Keep, and extend the AST test to `learning/`, `artifacts/`, `events/` |
| Extensibility | Protocol + registry for providers, guards, tools, context contributors, artifact kinds | New seams follow the same shape (§3) |
| Users | `username`+`email` both required, **`is_admin` bool, no role** | Add `role`. `email` and `username` become nullable (students have no email) |
| Auth | JWT HS256 in httpOnly cookie `pelita_session`, bcrypt, rate-limited in Postgres | Rename cookie, keep mechanism |
| Artifacts | **HTML-document-shaped throughout** (`Built.html`, `artifact_versions.html` NOT NULL, iframe + CSP) and strictly per-owner | Quiz/Flashcard get a **separate structured domain** (§5), reusing the model, search, page reader and guards |
| Tool path | `get_chat_service` builds tools **with no user** | Artifact kinds must be filtered by role here, or students can still create posters |
| `/api/config` | Unauthenticated; lists makeable kinds | Becomes role-scoped |
| Guards | Sync regex prompt-injection only; **never blocks**. `guard_events` table exists but **nothing writes it** | New async scope classifier + refusals + logging (§10) |
| Search | SerpAPI + SSRF-safe page reader, dates, excerpts | Reused for grounding, wrapped with a safe-source filter |
| LLM | `ilmu-v3.1` via OpenAI-compatible API. No JSON mode in `ChatRequest` | Prompted JSON + tolerant parse + schema validation + repair pass (a pattern already proven in `ArtifactModel.decide`) |
| News | MCP server, own venv, `news_cache` table, `/api/news`, `NewsStrip` | Removed entirely (§14 Phase 1) |
| Frontend state | Plain hooks + 2 contexts, `apiFetch` wrapper, no query lib, no animation lib | Keep hooks-per-resource. Add `motion` for animation |
| Tests | 1177 backend (85%), 117 frontend, rollback-per-test Postgres, fakes not mocks. **No E2E** despite the spec | Keep the conventions. Add Playwright E2E |
| Rules | No function > 50 lines, a feature doc per feature, `clock_timestamp()` in migrations, theme tokens only | Keep all |

**Pelita defects I'll fix because they touch Mentora's security or correctness:**

- `/artifacts/{id}/revise` has no rate limit or quota.
- `artifact_max_per_conversation` is never enforced.
- Stop doesn't cancel a build.
- The admin-create path skips the username regex, and a password over 72 bytes returns a 500.
- `ix_conversations_user` has drifted between model and migration.
- `CreateArtifactTool` never passes `language`.

---

## 2. Architecture

```
                        ┌────────────────── frontend (React, nginx :8300) ──────────────────┐
                        │ features/{auth,classes,learning,play,results,leaderboard,badges,   │
                        │  buddies,notifications,admin,chat,artifacts}  +  ui/ motion/ brand/│
                        └───────────────▲──────────────────────────────▲────────────────────┘
                                        │ JSON / SSE (/api)             │ SSE /api/notifications/stream
┌───────────────────────────── backend (FastAPI :8301) ─────────────────┴──────────────────────┐
│ api/        routers · deps (require_role, policies) · schemas         ← HTTP only             │
│ services/   classes · memberships · groups · invites · learning_sets · assignments · attempts │
│             results · insights · leaderboard · badges · notifications · moderation · admin    │
│ learning/   LearningKind Protocol + registry (quiz, flashcard) · generator · research · grade │
│ guards/     prompt_injection (kept) · scope classifier · output screen · safe sources         │
│ events/     domain event bus (observer): AttemptCompleted → notifications, badges, leaderboard│
│ policies/   access rules (who may see what), one place, tested as a matrix                    │
│ context/    ordered contributors (+ persona @100 role/grade aware)                            │
│ tools/ artifacts/ providers/ vision/  (Pelita, kept; artifacts gated by role)                 │
│ db/         models · repositories (ownership/membership are lookup PARAMETERS)                │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    Postgres 16 (:8302)
```

---

## 3. Engineering patterns (so features can be added later without surgery)

| Pattern | Where | Adding something later means… |
|---|---|---|
| **Layered architecture** | `api → services → repositories → db`; logic never imports FastAPI (AST test) | New feature = service + repo + router; no cross-layer shortcuts |
| **Protocol + registry (strategy / plugin)** | `LearningKind`, `ScopeClassifier`, `SourceFilter`, `BadgeRule`, `NotificationType`, `Buddy` (frontend) | One new file + one registry line |
| **Repository with scope-as-parameter** | `repo.get(id, teacher_id)`; `assignments.visible_to(student_id)` | Ownership can't be forgotten. There is no "fetch then check" |
| **Policy objects** | `policies/access.py`: `can_view_set`, `can_take`, `can_manage_class`… | One function per rule, tested as a role × resource matrix |
| **Domain events (observer)** | `events/bus.py`: `MembershipRequested`, `MembershipApproved`, `AssignmentShared`, `AttemptCompleted`, `BadgeAwarded` | New reaction (email, webhook, analytics) = one subscriber. The emitting code is untouched |
| **Frozen dataclasses at boundaries** | Service inputs and outputs, events, generation results | No shared mutable state (the Pelita rule) |
| **Pipeline of stages** | Generation: `classify → research → filter → skills → draft → validate → screen → repair` | Insert or replace one stage |
| **Adapter** | SerpAPI behind `SearchProvider`; LLM behind `Provider` | Swap vendors via `.env` |
| **Feature folders (frontend)** | `src/features/<feature>/{api.ts, hooks, components, pages}` | A feature is one folder |
| **Frontend kind registry** | `features/learning/registry.ts`: kind → look, Player, Editor, Card, Scene | New kind = one entry + its components |

**Extension recipes** get written into `CLAUDE.md` and tested where possible:

1. **Add a learning kind** (e.g. Worksheet): `learning/worksheet.py` implementing `LearningKind` (item schema, prompts, `public_view`, `grade`), then one line in `learning/registry.py`, then `features/learning/kinds/worksheet/` (Player, Editor), then one registry entry and a `--kind-worksheet` token. A test registers an unknown kind and asserts it generates, grades and renders.
2. **Add a notification type**: a `NotificationType` subclass (payload schema + render keys) plus a subscriber on the event.
3. **Add a badge**: a `BadgeRule` with `evaluate(ctx) -> Award | None`, one registry line, and art in the badge atlas.
4. **Add a moderation rule**: a rule file in `guards/scope_rules/` plus benign and attack corpus lines.
5. **Add a buddy**: an SVG rig plus a `Buddy` entry (name, palette, moves, tip voice).

---

## 4. Roles & access (enforced on the backend)

**Dependencies:** `require_role(*roles)` produces `AdminUser`, `TeacherUser`, `StaffUser` (teacher|admin) and `StudentUser`. Resource checks go through `policies/` and scoped repositories. Hiding UI is never the control.

| Capability | Admin | Teacher | Student |
|---|---|---|---|
| Pelita artifacts (poster, slides, game, website, app): create/list/view/revise/share | ✅ (all users') | ✅ own | ❌ **403 at API**; tool not offered; `/config` hides them |
| Quiz / Flashcard: generate, edit, share | ✅ | ✅ own | Generate + edit **private practice** sets only; cannot share/assign (§8.8) |
| Classes, groups, invites, approvals | view all | ✅ own classes | ❌ |
| Join class via invite | ❌ | ❌ | ✅ |
| Take shared sets | — | preview only | ✅ if in audience |
| Results | all | own classes | own only |
| Leaderboard | all | own assignments | assignments they're in (top 10 + own rank) |
| Users: suspend, delete, reset password | ✅ | reset password of own approved students (§17) | ❌ |
| Moderation log, platform stats | ✅ | ❌ | ❌ |

**Where a student is blocked from Pelita artifacts:**

- `get_chat_service` gains `CurrentUser`, and `build_kinds()` is filtered by role before tools are built. `CreateArtifactTool` already rejects unknown kinds.
- `routers /artifacts/*` and `/conversations/{id}/artifacts` take `StaffUser`.
- `SqlArtifactRepository` gains a role-aware scope (defence in depth).
- `/chat/stream` rejects `artifact_id` for students.
- `/config` becomes role-scoped (it is only authenticated when it lists kinds).

A test walks **every route** in the OpenAPI schema with a student cookie and asserts that artifact routes return 403.

---

## 5. Database changes

All migrations follow Pelita's rules: `clock_timestamp()`, `server_default` on new NOT NULL columns, a model import in `models/__init__.py`, and downgrade paths.

### 5.1 Altered

- **users**
  - `+ role` varchar(16), NOT NULL, default `'teacher'`, CHECK in (`admin`, `teacher`, `student`). Backfilled from `is_admin`, then **`is_admin` is dropped**; a model property keeps it readable.
  - `email` → nullable. `username` → nullable. CHECK that at least one is set; the existing unique indexes stay.
  - `+ grade_level` varchar(32), null.
  - `+ buddy` varchar(24), null.
  - `+ preferences` JSONB, default `{}`, holding `text_scale`, `font_style`, `sound`, `reduced_motion_override`.
  - `+ onboarded_at`, `+ last_seen_at`.
- **guard_events** is renamed **`moderation_events`**, gaining:
  - `+ user_id` (FK users SET NULL), `+ conversation_id` (FK SET NULL)
  - `+ surface` (chat | quiz_gen | flashcard_gen | artifact_gen | web_source | output)
  - `+ stage` (input | source | output), `+ category`, `+ action` (refused | redirected | filtered | retracted | flagged)
  - `+ excerpt` (≤500 chars), `+ detail` JSONB
  - `+ reviewed_at`, `+ reviewed_by`, `+ review_note`
  - Indexes on `(created_at)`, `(reviewed_at)` and `(category)`.
- **news_cache** is dropped (migration `9d5f12e0e5e4` stays; it also creates `message_sources`).

### 5.2 New

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `classes` | teacher_id→users CASCADE, name, subject?, grade_level?, description?, theme (colour key), archived_at? | ix(teacher_id, archived_at) |
| `class_invites` | class_id→classes CASCADE **unique**, token (32 random bytes, url-safe) unique, enabled, expires_at?, rotated_at | one live invite per class; regenerate = new token |
| `class_memberships` | class_id, student_id→users CASCADE, status CHECK(pending, approved, rejected, revoked, left), requested_at, decided_at, decided_by? | **unique(class_id, student_id)**; ix(student_id, status), ix(class_id, status) |
| `class_groups` | class_id CASCADE, name, colour, position | unique(class_id, lower(name)) |
| `group_members` | group_id CASCADE, student_id CASCADE, added_at | PK(group_id, student_id); service enforces "approved in class" |
| `learning_sets` | owner_id CASCADE, **purpose (assign | practice)**, kind, title, subject, topic, grade_level, language, item_count, status(draft, ready), current_version, conversation_id?/message_id? (SET NULL), archived_at? | ix(owner_id, updated_at) |
| `learning_set_versions` | set_id CASCADE, version, **items JSONB**, skills JSONB, sources JSONB, model, tokens, build_ms | unique(set_id, version). A version referenced by an assignment is **immutable**; edits fork a new version |
| `assignments` | set_id, **version (pinned)**, class_id CASCADE, teacher_id, title, kind, feedback_mode(instant, end), shuffle_questions, shuffle_options, allow_retakes, max_attempts?, due_at?, leaderboard_enabled, closed_at? | ix(class_id, created_at) |
| `assignment_groups` | assignment_id CASCADE, group_id CASCADE | PK both. Empty = whole class |
| `attempts` | assignment_id CASCADE, student_id CASCADE, number, status(in_progress, completed), plan JSONB (item order + option permutation), score, max_score, percent numeric(5,2), duration_ms, is_late, started_at, completed_at? | unique(assignment_id, student_id, number); **ix(assignment_id, status, percent DESC)** for the leaderboard |
| `attempt_answers` | attempt_id CASCADE, item_id, skill, response JSONB, correct, time_ms, answered_at | unique(attempt_id, item_id) |
| `notifications` | user_id CASCADE, type, actor_id?, payload JSONB, group_key?, count, read_at? | ix(user_id, read_at, created_at DESC) |
| `student_badges` | student_id CASCADE, badge_key, assignment_id? CASCADE, class_id?, meta JSONB, awarded_at | unique(student_id, badge_key, assignment_id) |

**Item JSON** is validated by the kind:

- A **quiz item** has `id`, `type` (`mcq`), `prompt`, `options[4]`, `answer`, `explanation`, `skill`, `difficulty`, `source_ids[]`.
- A **flashcard item** has `id`, `front`, `back`, `hint?`, `skill`, `source_ids[]`.

**Revoke keeps history.** The membership becomes `revoked`, its group rows are deleted, and its attempts stay. Revoked students lose access to new work and to anything they haven't started, but keep read-only access to their own past results.

---

## 6. API (new and changed; all under `/api`)

**Auth**

- `POST /auth/signup/teacher` {name, email, password}
- `POST /auth/signup/student` {name, grade_level, username, password, invite_token?}: account + pending membership + teacher notification, in **one transaction**.
- `GET /auth/username-available?u=` (rate-limited)
- `/auth/signin` (existing, username **or** email). `/auth/me` gains role, grade, buddy and prefs. `PATCH /auth/me/preferences`.

**Invites (public, rate-limited)**

- `GET /invites/{token}` → class name, teacher name, subject, or "no longer active". Revoked, expired and unknown tokens all answer identically.
- `POST /invites/{token}/join` (StudentUser) is idempotent. It re-opens a rejected or left membership as pending.

**Classes & groups (TeacherUser, owner-scoped)**

- `GET|POST /classes` · `GET|PATCH|DELETE /classes/{id}` (DELETE = archive once it has assignments)
- `GET /classes/{id}/invite` · `POST /classes/{id}/invite/rotate` · `PATCH /classes/{id}/invite` {enabled, expires_at}
- `GET /classes/{id}/members?status=&q=&page=`
- `POST /classes/{id}/members/{mid}/approve|reject` · `POST /classes/{id}/members/bulk` · `DELETE /classes/{id}/members/{mid}` (revoke)
- `GET|POST /classes/{id}/groups` · `PATCH|DELETE /groups/{gid}` · `PUT /groups/{gid}/members` {student_ids}

**Student classes**

- `GET /me/classes` · `POST /me/classes/{id}/leave`

**Learning sets** (StaffUser for sharing; students may create `practice` sets — owner-scoped, never assignable)

- `GET /learning/kinds` (role-scoped tiles)
- `GET /learning-sets?kind=&q=&page=` · `GET|PATCH|DELETE /learning-sets/{id}` · `PUT /learning-sets/{id}/items`
- `POST /learning-sets/{id}/items/{item_id}/regenerate` {instruction?}
- `GET /learning-sets/{id}/preview` (teacher plays it; nothing is recorded)
- **Generation runs inside the chat turn** (§7). `ChatRequest` gains an optional `make` {kind, subject, topic, grade_level, count, language}.

**Assignments**

- `POST /assignments` {set_id, class_id, group_ids[], feedback_mode, due_at?, allow_retakes, shuffle_*, leaderboard_enabled}
- `GET /classes/{id}/assignments` · `GET|PATCH /assignments/{id}` · `POST /assignments/{id}/close` · `DELETE` (only with no attempts)

**Taking (StudentUser, audience-checked)**

- `GET /me/assignments?status=todo|done` · `GET /me/assignments/{id}`
- `POST /me/assignments/{id}/attempts` starts or resumes. It returns items with **no answer key** (flashcard backs are included).
- `POST /attempts/{id}/answers` {item_id, response, time_ms}. In instant mode it returns `{correct, answer, explanation}`; in end mode `{recorded}`.
- `POST /attempts/{id}/complete` returns score, reveal, new badges and rank.

**Results & insights**

- Teacher: `GET /assignments/{id}/results?group_id=` (summary, per-question, per-skill, per-student) · `GET /assignments/{id}/results/students/{sid}` · `GET /classes/{id}/gradebook`
- Student: `GET /me/results` · `GET /me/results/{attempt_id}` · `GET /me/insights?subject=`

**Leaderboard & badges**

- `GET /assignments/{id}/leaderboard`: teacher gets the full list; a student gets top 10 + own rank.
- `GET /me/badges`
- Practice: `POST /me/practice/{set_id}/attempts` (student's own sets; results private to the student)

**Notifications**

- `GET /notifications?cursor=` · `GET /notifications/unread-count` · `POST /notifications/{id}/read` · `POST /notifications/read-all`
- `GET /notifications/stream` (SSE, per user)

**Admin (AdminUser)**

- `GET /admin/stats`
- `GET /admin/users?role=&q=&status=&page=` · `PATCH /admin/users/{id}` (suspend/activate) · `DELETE /admin/users/{id}` · `POST /admin/users/{id}/password`
- `GET /admin/moderation?category=&surface=&reviewed=&page=` · `PATCH /admin/moderation/{id}`
- `GET /admin/artifacts?type=&kind=&owner=&page=` · `GET /admin/artifacts/{id}` · `GET /admin/learning-sets/{id}`

**Response conventions stay Pelita's**: plain bodies, `{items, total, page, limit}` for lists, and the `{"error":{code,message}}` envelope. The error class is renamed `MentoraError`.

---

## 7. Quiz & Flashcard generation (web-search grounded)

**Teacher flow.** The teacher taps the **Quiz** or **Flashcards** tile above the chat box, and the **Create sheet** springs up with subject, topic, grade, count (default 10, range 5–30) and language. Submitting sends a chat turn with `make`. The backend forces the `create_learning_set` tool with exactly those arguments; the model doesn't reinterpret them. Natural language ("quiz on fractions for Year 4") also works through tool calling; the tool requires a grade, so the model asks for one if it's missing.

**Pipeline** (`learning/generator.py`). Each stage is a small unit that is tested alone and emits `learning.*` SSE events:

1. **Classify** the request. It must be educational and age-appropriate for the grade (§10). A refusal is logged.
2. **Plan queries.** One LLM call writes 2–3 queries for subject + topic + grade (e.g. syllabus terms).
3. **Research.** SerpAPI with **`safe=active`**, then the page reader (SSRF-safe, as in Pelita).
4. **Filter sources**:
   - a host blocklist
   - educational-domain boosts (gov/edu, curriculum bodies, encyclopedias)
   - one batched LLM screen of the excerpts for age-appropriateness and relevance
   - the prompt-injection guard on every excerpt
5. **Map skills.** From the sources, derive 3–6 subtopic/skill tags (a slug plus a label) for the topic at that grade.
6. **Draft items.** Items are written in batches of 5 as strict JSON. Each one cites `source_ids` and carries a skill tag.
7. **Validate**:
   - schema checks (4 unique options, exactly one correct, length limits)
   - no duplicates
   - reading level suited to the grade
   - every skill covered
8. **Verify and screen.** An LLM checker confirms the answer is supported by the cited excerpt, that the item is on-topic, and that it is appropriate for the grade. Failing items are **repaired once**, then dropped. If fewer than the requested count survive, the teacher is told honestly ("8 of 10 passed checks").
9. **Persist** version 1 as a draft. The editor opens.

**Editor**: inline edit, change the correct answer, drag to reorder, add or delete items, "regenerate this one" with an optional instruction, source chips per item, and **Play preview**. Edits happen in place until the set is shared; after that they fork a new version. Assignments already out keep the version they were given.

**Model**: `LEARNING_MODEL` (defaults to `LLM_MODEL`) with its own token budget and timeout. Build tokens **count toward the user's quota** (fixing a Pelita gap). There is an eval set of 12 topics × grades, run by `make eval-learning`, to track the pass rate as prompts change.

---

## 8. Student experience ★ the showcase

This is the part that has to feel magical. It's designed phone-first; animation is part of what it says, not decoration.

### 8.1 The Buddies (named companions — student view)

| Buddy | What | Personality / voice | Signature move |
|---|---|---|---|
| **Kiko** | Kancil (mouse-deer, Malaysian folk hero) | Quick-witted puzzle lover — "Ooh, tricky one!" | Hop-spin + wink |
| **Bolt** | Tiny robot | Beeps with joy, loves maths & science — "Calculating… AWESOME!" | Antenna sparks + robot dance |
| **Ollie** | Owl | Calm reader, loves stories & languages — "Let's read it slowly." | Head tilt 180° + page flap |
| **Momo** | Round baby dragon | Gentle and kind — "Mistakes help me grow!" | Tiny puff of heart-shaped smoke |
| **Rimau** | Malayan tiger cub | Energetic, loves challenges & streaks — "RAWR, streak!" | Roar + pounce, podium flex |

- **Rig**: hand-built layered SVG (body, eyes, brows, mouth, arms, prop). It's animated with `motion` through a **state machine**: `idle, wave, think, cheer, oops, celebrate, sleepy, dance, trick`. Idle antics on a random timer: blink, stretch, juggle, peek from the edge.
- **Where buddies appear**:
  - onboarding: pick your buddy, and each one introduces itself with its move
  - Home: greeting by time of day, plus a daily tip
  - quiz: cheers correct answers, consoles wrong ones, reacts to streaks
  - flashcards: nods or shrugs as you mark cards
  - celebration screen: its dance
  - empty and error states
  - the chat avatar
- **Tips**, from a curated, localized tip library per buddy voice. No LLM, so they're always safe:
  - study strategies ("Read every option before choosing!")
  - encouragement tied to the student's **own weak skills** from insights ("Fractions are getting stronger — 3 more to master!")
  - **never answer hints** during a quiz (§17)
- **Tap the buddy** for a random trick. Mute or hide it in settings. With reduced motion, poses swap instantly with no bounce.

### 8.2 Quiz player (Tangerine theme)

- **Stage**: full-screen, with animated ambient background blobs in the quiz hue.
- **Segmented progress rail**: one pill per question, filling mint or coral as you go (tangerine in end-of-quiz mode).
- **Streak flame counter**; **text-size control** always visible.
- **Question card** springs in (shared-layout transition from the previous card). Options are **big tiles**, each with **colour + shape + letter** (never colour alone), tappable with keys `1–4` / `A–D`.
- **Instant mode**:
  - correct: tile pop, mint glow, sparkle particle burst, "+1" float, buddy cheer, streak increments
  - wrong: gentle wobble (never harsh), the coral tile, the correct tile highlighted, an explanation card sliding up with its source chip, buddy consoles
- **End mode**: select, then **Lock in**, then next. You get a review at the end.
- **Autosave** after every answer. Resume where you left off on any device.

### 8.3 Flashcard player (Lagoon theme)

- A **3D flip card** (perspective + backface) over a stacked deck. Tap, Space or Enter flips it.
- **Swipe right = Knew it, left = Not yet**: drag gesture with rotation and velocity, green/coral edge glow while dragging, and buttons for accessibility.
- **Round 2** replays only the "Not yet" cards. Results record first-pass marks.

### 8.4 Celebration & results

The celebration screen:

- effort always celebrated ("You finished!")
- the score **count-up** inside a radial gauge
- 1–3 **stars** dropping in
- **confetti** (canvas) scaled to the score
- **badges earned** flipping in
- the leaderboard rank slide-in
- the buddy's victory dance
- **strength / keep-practising chips**

Then: Review answers · Try again (if allowed) · Home.

### 8.5 Student Home

- The buddy greeting.
- **To-do cards** in each kind's colour, with due chips (and a gentle wiggle when it's due today).
- "Continue where you left off", recent results, the badge shelf teaser.
- On phones, a bottom tab bar: **Home · Chat · Results · Badges**.

### 8.6 Leaderboard & badges

- **Leaderboard** per **quiz** assignment (flashcards have none — Q11):
  - a podium for the top 3 (crowns, with the buddies of the top students)
  - animated rank reordering (FLIP layout animation) as classmates finish, **live over SSE**
  - "You" row pinned
  - ties share a rank
  - students see top 10 + their own rank (Q12)
  - the teacher can turn it off per assignment
- **Badges**:
  - Rank badges: 🥇 Gold / 🥈 Silver / 🥉 Bronze. These are **provisional** crowns while the assignment is open and are **finalized** when it closes or passes its due date, which stops later finishers "stealing" a badge unseen.
  - Instant personal badges (assigned work): **Perfect Score** (100%), **Star Scorer** (≥90%), **Hot Streak** (5 correct in a row), **Comeback** (improved on a retake), **Early Bird** (finished well before the due date), **Card Shark** (finished a deck with all cards known), **Skill Master** (a skill ≥80% across 3 sets).
  - Badges are illustrated SVG medals with a shine sweep. The **trophy shelf** page shows locked silhouettes to aim for.

### 8.7 Typography & text size

- **Fonts** are self-hosted (no Google CDN, for children's privacy) and use variable fonts where possible:
  - **Fredoka** for headings
  - **Nunito** for body
  - **Lilita One** for big moments (scores, podium, badge names)
  - **Andika** for the "Easy read" style (designed for early readers: single-storey a/g)
- Students choose a **font style**: *Playful* (default), *Easy read*, *Classic*.
- **Text size control**: five steps = 90 / 100 / 115 / 130 / 150%. It sits in the **artifact panel** and the players, and drives the CSS variable `--text-scale`. Students default to **115%** and teachers to **100%**. It's saved in `users.preferences` so it follows the user across devices.
  - For Pelita HTML artifacts (fixed-canvas posters and slides), the same control **zooms** the frame rather than reflowing it (§17).

### 8.8 Private practice (students)

- Students see the **Quiz / Flashcard tiles above their chat box**. The Create sheet is simpler: topic plus count, with subject optional and the grade prefilled from their profile.
- Generation runs the **same grounded pipeline and guardrails** as for teachers, and the same animated panel with their buddy narrating the steps.
- Practice sets are **private**: they can't be shared or assigned, and no teacher sees them. Admin can, for moderation.
- Practice attempts feed the student's **own strengths/weaknesses**. They earn **no leaderboard rank and no rank badges**, so there's no farming with easy self-made quizzes. Two practice-only badges: *Self-Starter* and *Practice Pro*.
- Rate-limited per student per day (`STUDENT_PRACTICE_PER_DAY`, default 10).

---

## 9. Teacher experience

- **Studio** (home) is the redesigned chat:
  - **existing artifact tiles** (Poster, Slides, Website, App, Game) sit at the **top**, where News was
  - **Quiz + Flashcard tiles** sit **above the chat box**
  - both are animated living tiles in their kind colours
- **Generation panel** (animated, in the kind's theme): research steps tick in; sources fly in as favicon chips; skill tags "stamp" down; then each **question card materializes** as it passes checks (shimmer, then settle), with the counter filling. When it's done, the panel morphs into the Editor.
- **Classes**:
  - class cards with colour themes
  - a class page with tabs for **Students · Requests · Groups · Assignments · Results · Invite**
  - invite panel: link, copy, rotate, enable/disable toggle, expiry
- **Groups**: multi-select students, then "Add to group". Coloured group chips; a student can be in several groups.
- **Share dialog**: pick the class, then the whole class or specific groups, then feedback mode, due date, retakes, leaderboard.
- **Results**:
  - summary tiles
  - score distribution
  - per-question bars (showing the most common wrong option)
  - a **skill heatmap** (students × skills)
  - a student table, then a drill-down
  - a group filter
  - a class gradebook
  - Charts are animated SVG components (no chart library).
- **Notifications**: bell with an unread badge. Join requests carry **inline Approve / Reject**. Completions are coalesced per assignment ("5 students finished *Photosynthesis*").

---

## 10. Guardrails (system prompt + input + sources + output)

| Layer | What | Where |
|---|---|---|
| **System prompt** | Persona contributor @100, role- and grade-aware. Student: a friendly study buddy, explains at grade level, encourages, stays educational. Teacher: a teaching assistant. Scope rules stated explicitly | `context/persona.py` |
| **Input classification** | `ScopeClassifier` Protocol (async). Stage 1 is fast rules (EN + MS lexicons) for unsafe categories and obvious educational requests. Stage 2 is a small LLM JSON verdict `{educational, off_topic, unsafe, self_harm}` with role + grade context, temperature 0 and a tiny `max_tokens` | `guards/scope.py`, called in `ChatService._prepare` and the generator |
| **Refusal** | The turn short-circuits: no main model call. A friendly templated redirect in the conversation's language, plus 3 educational suggestion chips. Persisted as an assistant message with `finish_reason=refused` | `guards/refusals.py` |
| **Self-harm** | Never just "refused". A supportive message that points to a trusted adult and a **configurable helpline** (`SAFETY_HELPLINE_TEXT`). Logged as high priority | same |
| **Web sources** | `SafeSearchProvider` wrapper: SerpAPI `safe=active` + host blocklist + excerpt screening. Applied in **all three** places search is built (chat tools, artifacts registry, learning) | `guards/safe_sources.py` |
| **Output check** | After the stream closes, rules + an LLM screen (always for students; for teachers, rules only). If flagged, a `retract` SSE event replaces the message with a safe version and the event is logged. Generated quiz and flashcard items are screened per item (§7) | `guards/output_screen.py` |
| **Logging** | Every refusal, filter and retraction goes to `moderation_events` with the excerpt. The admin **Moderation queue** has filters, a review/note action and category charts | `services/moderation_service.py` |

- **Teacher scope is broader**: lesson planning, classroom materials, school events, parent letters and pedagogy are all educational.
- **Classifier outage** degrades to rules-only plus the strict persona, is logged as `classifier_unavailable`, and never fails the turn. That's Pelita's "degrade, never break" rule.
- **Streaming trade-off**: tokens stream live, so output checking is **after the fact, with retraction**. Buffering the whole answer would kill the streaming feel. See Risks.

---

## 11. Notifications

- **Types** (`NotificationType` registry): `join_request` (teacher), `completion` (teacher, coalesced by `group_key`), `join_approved` (student), `assignment_shared` (student), `badge_awarded` (student).
- **Created by event subscribers**, never inline in services.
- **Delivery**: an in-process `NotificationHub` feeds `GET /notifications/stream` (SSE), with **60 s polling as the fallback**. The same stream carries leaderboard updates. Single-worker constraint, as with Pelita's cancellation registry; documented.
- **UI**:
  - the bell wiggles on arrival, and the count badge pops
  - the panel slides in (a bottom sheet on phones)
  - inline actions resolve in place with a check morph
  - "Mark all read"
  - older than 90 days → pruned
- **Accessibility**: an `aria-live` region announces new notifications.

---

## 12. Design system (one theme, one icon)

- **Palette**: one Mentora palette with light and dark variants (Q4). Defined in `theme.css` as HSL tokens (Pelita's mechanism). Every text/background pair is **contrast-tested in unit tests** (AA ≥ 4.5:1), reusing Pelita's `contrast.ts`.

  | Role | Light | Dark |
  |---|---|---|
  | Primary — *Grape* | `#6D4AFF` | `#9B86FF` |
  | Sunshine (stars, highlights) | `#FFC23D` | `#FFD166` |
  | Mint (correct) | `#18B98A` | `#3DDBA8` |
  | Coral (try again) | `#FF6B6B` | `#FF8A8A` |
  | Sky (info) | `#3AA0FF` | `#6CB8FF` |
  | Paper / Surface / Ink | `#FFF9F0` / `#FFFFFF` / `#1E1B3A` | `#16132B` / `#211D3D` / `#F4F1FF` |

- **Kind colours** are used consistently on the tile, card, header, player and badges:

  | Kind | Colour |
  |---|---|
  | **Quiz** | Tangerine `#FF7A1A` |
  | **Flashcard** | Lagoon `#10B3A3` |
  | Poster | Rose `#F43F76` |
  | Slides | Blue `#3B82F6` |
  | Game | Orchid `#C04CF0` |
  | Website | Lime `#84CC16` |
  | App | Leaf `#22C55E` |

- **Icons**: **Phosphor** everywhere (duotone for features and kinds, bold for controls). `lucide-react` is removed.
- **Logo**: one mark, a rounded open book whose pages form an **"M"**, with a sunshine spark above. It's used for the favicon, PWA icons (192/512 and maskable), apple-touch-icon, sign-in and the loading states (the spark twinkles).
- **Shape language**: large radii (16–28px), soft coloured shadows, chunky 2px outlines on interactive tiles, and a tactile "press-down" on tap.
- **Motion**:
  - Libraries: **`motion`** (successor to Framer Motion: springs, layout/FLIP, gestures, `AnimatePresence`) and **`canvas-confetti`**. Plain CSS keyframes for loops.
  - One `motion/presets.ts` (spring tokens: `snappy`, `bouncy`, `gentle`) so it all feels like one app.
  - Motion covers: page transitions, list staggering, hover and tap micro-interactions, skeleton shimmer, count-ups, the bell, tiles, generation, both players, celebrations, the leaderboard and badges.
- **`prefers-reduced-motion`** is respected globally:
  - `MotionConfig reducedMotion="user"`
  - CSS `@media` blocks
  - a `useReducedMotion()` guard on JS timers (fixing Pelita's MakeRail gap)
  - confetti disabled
  - flips become cross-fades
  - a user override in settings
- **Sound** (optional, **off by default**): tiny Web Audio synthesized blips for correct, wrong and celebrate. No audio files.
- **Responsive**: phone-first. Tap targets ≥ 48px, safe-area insets, and a bottom tab bar on phones. The artifact panel becomes a full-screen sheet below 900px.

---

## 13. Frontend structure & components

```
src/
  app/            App.tsx (role routes), providers, AppShell, RoleNav, MobileTabBar, route guards
  brand/          Logo, Wordmark, favicon + PWA manifest
  ui/             Button, IconButton, Input, Select, Combobox, Textarea, Field, Card, Badge, Chip,
                  Avatar, Tabs, Dialog, Sheet, Menu, Toast, Tooltip, Skeleton, EmptyState,
                  ErrorState, Pagination, ProgressBar, Switch, Segmented, Stepper, Confirm, TextSizeControl
  motion/         presets, PageTransition, Reveal, Stagger, CountUp, Confetti, Particles, useReducedMotion
  features/
    auth/         SignIn, SignupChooser, TeacherSignup, StudentSignup, UsernameField, JoinPage
    buddies/      registry.ts, rigs/{kiko,bolt,ollie,momo,rimau}.tsx, BuddyStage, useBuddyMood, tips/
    classes/      ClassesPage, ClassCard, ClassPage, InvitePanel, MemberList, Requests, GroupBoard
    learning/     registry.ts, LearnTiles, CreateSheet, GenerationPanel, SetEditor, Library, ShareDialog
      kinds/quiz/       QuizEditor, QuizCard, QuizScene
      kinds/flashcard/  FlashcardEditor, FlashcardCard, FlashcardScene
    play/         PlayStage, QuizPlayer, OptionTile, FeedbackBurst, ExplanationCard, StreakFlame,
                  FlashcardPlayer, FlipCard, SwipeDeck, SegmentedProgress, Celebration, ScoreReveal, Review
    results/      AssignmentResults, ScoreDistribution, QuestionBreakdown, SkillHeatmap, StudentDrilldown,
                  Gradebook, MyResults, AttemptResult, SkillBars
    leaderboard/  Leaderboard, Podium, RankRow, useLiveLeaderboard
    badges/       BadgeMedal, BadgeShelf, BadgeToast, atlas.ts
    home/         StudentHome, TodoCard, TeacherStudio
    notifications/ Bell, NotificationPanel, NotificationItem, useNotifications (SSE + poll)
    admin/        AdminDashboard, StatTile, UsersTable, ModerationQueue, ArtifactBrowser
    chat/ artifacts/ make/   (Pelita, restyled; artifacts panel gains TextSizeControl)
  lib/            api.ts, sse.ts, auth.tsx, theme.tsx, prefs.tsx (text scale / font style / sound)
```

**Routes**

| Audience | Routes |
|---|---|
| Public | `/signin` · `/signup` (I'm a teacher / I'm a student) · `/signup/teacher` · `/signup/student` · `/join/:token` |
| Teacher / admin | `/` Studio · `/c/:id` · `/classes` · `/classes/:id/:tab` · `/library` · `/library/:setId` · `/assignments/:id` (results + leaderboard) |
| Student | `/` Home · `/chat` · `/chat/:id` · `/play/:assignmentId` · `/results` · `/results/:attemptId` · `/badges` · `/classes` |
| Admin | `/admin` · `/admin/users` · `/admin/moderation` · `/admin/artifacts` |
| Everyone | `/settings` (theme, text size, font style, sound, motion, buddy) · `/profile` |

Also on the frontend:

- **Onboarding tour**: a coach-mark component. Teacher: create a class → share the invite → make a quiz. Student: pick a buddy → your to-do → join a class. Completion is stored in `onboarded_at`.
- **Every list** has an animated empty state featuring a buddy or the logo, a skeleton loader, an error state with retry, and pagination.

---

## 14. Build phases

Every phase runs the same loop:

- TDD
- `make lint && make test`
- `make up`
- a browser check of the flows at desktop and phone width, with the console clean
- a Playwright E2E for that phase's critical path
- feature docs in `docs/features/`
- commits (conventional, several per phase)
- push
- a short summary to you
- **wait for your go** (Q14)

| # | Phase | Delivers | Key checks |
|---|---|---|---|
| **1** | **Fork, rename, repo** | Copy (excluding `.git`, `.env`, `node_modules`, `.venv`, caches) → fork commit → **remove News** (backend, MCP venv, table, UI, docs, tests) → rename everything (packages, `MentoraError`, cookie `mentora_session`, `data-mentora` protocol on both sides, storage keys, keyframes, compose project/containers/volume, ports 8300–8303, `.env.example`, docs) → **grep test: zero "pelita"** (except the Q17 credit) → GitHub repo → push | All Pelita tests green after the rename; app boots on :8300 |
| **2** | **Auth, roles, schema + design foundation** | Role migration; teacher/student signup; `require_role` + policies; role-gated Pelita artifacts; role-scoped `/config`. Design tokens, fonts, Phosphor, logo, `motion` presets, UI primitives, `TextSizeControl`, prefs. New sign-in/sign-up screens | Route-walk RBAC test; contrast tests; signup E2E |
| **3** | **Classes, groups, invites, notifications** | Domain event bus; the class, invite, membership and group services; join flow (new and existing student); notifications + SSE hub + bell; class screens | IDOR tests per endpoint; invite → approve → group E2E |
| **4** | **Generation + sharing** | `learning/` package, quiz + flashcard kinds, grounded pipeline with safe sources + item screening, chat `make` path, `learning.*` events, animated generation panel, editor, library, share dialog, assignments | Pipeline stage tests with a fake provider/search; eval set; generate → edit → share E2E |
| **5** | **Taking, results, insights, leaderboard, badges, buddies** | Attempt engine (server-side grading, no answer key before answering, resume), both players, celebration, results (teacher + student), strengths/weaknesses, live leaderboard, badge rules, the 5 buddies + tips, student Home | Grading and badge-rule tests; take → celebrate → teacher sees result E2E; reduced-motion pass |
| **6** | **Guardrails + admin** | Persona contributor, scope classifier, refusals + self-harm path, output screen + retract, moderation log; admin stats, users (suspend, delete, reset), moderation queue, artifact browser | Attack **and** benign corpora (EN + MS); admin E2E |
| **7** | **Full redesign + motion polish** | Restyle every remaining Pelita screen (chat, artifact panel, sidebar, settings, profile, share pages); layout moves; onboarding tours; responsive pass (phone/tablet); a11y + Lighthouse pass | Zero literal colours (lint rule); Lighthouse a11y ≥ 95 |
| **8** | **README, cleanup, final push** | New README (features, roles, setup, env, screenshot placeholders); `CLAUDE.md` with extension recipes; dead-code sweep; coverage report | Coverage ≥ 80%; clean `make up` from a fresh clone |

> **Deviations from your suggested order, flagged:**
> - The design foundation moves into Phase 2, so new screens are built once in the new design rather than restyled later. Phase 7 still does the full redesign of Pelita's existing screens.
> - Source filtering and item screening land in Phase 4, because generation needs them. The full guardrail layer is still Phase 6.
> - News removal happens in Phase 1, which saves renaming files we're about to delete.

---

## 15. Testing strategy

- **Backend** (pytest; rollback-per-test Postgres; fakes, not mocks):
  - policy matrix (role × resource × action)
  - a route-walk RBAC test
  - IDOR tests (teacher A vs class B, student vs another class's assignment)
  - each generator stage with `FakeProvider` + `FakeSearch`
  - grading per kind
  - leaderboard ranking and ties
  - badge rules (incl. finalization at close)
  - event subscribers
  - moderation corpora
  - migrations up and down
- **Frontend** (vitest + Testing Library):
  - players (keyboard, instant/end modes, resume)
  - flip/swipe fallbacks
  - `TextSizeControl`, prefs, notification reducer, buddy state machine
  - contrast tokens
- **E2E** (Playwright, new): the teacher → student → results journey against a **scripted LLM provider** (`providers/scripted.py`, enabled only when `APP_ENV=test`), at desktop and phone viewports, plus reduced-motion emulation.
- **Target: ≥ 80% coverage** on both sides (Pelita is at 85% backend).

---

## 16. Extras — yes/no? (Q18)

| Extra | Why | Default |
|---|---|---|
| **6-character class code** as well as the link | Kids type codes on tablets | ✅ |
| **QR code** for the invite (projector-friendly) | One dependency (`qrcode`) | ✅ |
| **PWA install** (manifest, icons, offline shell) | Tablets on a home screen; cheap once there's one icon | ✅ |
| **CSV export** of results and gradebook | Teachers live in spreadsheets | ✅ |
| **Sound effects** (off by default) | Delight | ✅ |
| **AI coach note** in student insights (2 sentences, screened) | Warmer insights; costs 1 call per completion | ❌ |
| **Drag-and-drop** students into groups (desktop) | Nice, but multi-select covers it | ❌ |
| **Chat-based quiz edits** ("make Q3 easier") | Regenerate-with-instruction covers it | ❌ |

---

## 17. Defaults I chose (flagged — overturn any)

| Topic | Default |
|---|---|
| Student credentials | No email. Username is globally unique, with an availability check + suggestions. Password min 8 |
| Student password reset | Admin **and** any teacher where the student is an *approved* member can issue a reset |
| Invite links | Per class, one live link; the teacher can rotate, disable, or set an optional expiry. Revoked, expired and unknown links answer identically |
| Rejected / left students | Can re-request via the link (it becomes pending again) |
| Student leaves a class | Allowed ("Leave class"); history kept |
| Audience | Resolved **live**: late joiners see whole-class work; students removed from a group lose not-started work |
| Retakes | Quizzes: off by default (the teacher can allow them, optional max). Flashcards: unlimited practice |
| Teacher view of retakes | Latest + best shown; **first** attempt counts for leaderboard and rank badges |
| Due dates | Optional; late submissions allowed and marked "late" |
| Shuffle | Options shuffled per student by default; question order fixed by default |
| Answer key | Never sent to the client before an answer is submitted |
| Hints | Buddies give strategy tips only, **never answer hints** during a quiz |
| Strength / weakness | Per skill tag: ≥ 80% = strength, < 50% = keep practising, minimum 2 answers. Aggregated by subject → topic → skill |
| Editing a shared set | Forks a new version; existing assignments keep theirs |
| Deleting | Sets and assignments with attempts are archived/closed, not deleted. Admin deleting a user is a **hard delete** (cascade) behind a typed confirmation |
| Pelita features for students | Chat, web search (safe), file attach, memory: on. Share links, cost/usage UI, Pelita artifacts: off |
| Font size on Pelita HTML artifacts | Zoom, not reflow (fixed-canvas designs break under reflow) |
| Token quotas | Admin-set per user (Pelita). Optional `STUDENT_DAILY_TOKEN_LIMIT` default; empty = unlimited |
| Notification retention | 90 days |
| Pagination | 25 per page (50 for admin tables) |
| Buddy names & look | Kiko, Bolt, Ollie, Momo, Rimau — proposals, easy to rename (registry) |
| Children's privacy | Minimal PII, self-hosted fonts, no third-party trackers. Parental consent flows are **out of scope** (flag if you need them) |

---

## 18. Risks

| Risk | Level | Mitigation |
|---|---|---|
| `ilmu-v3.1` JSON reliability for structured items | **High** | Tolerant parse + schema validation + one repair + the eval set. `LEARNING_MODEL` can point at a stronger model |
| Generation latency (search + verify ≈ 30–90 s) | Medium | Items stream in one by one; the animated panel makes the wait part of the show; the turn survives navigation (Pelita live turns) |
| Output check after streaming = brief exposure before retraction | Medium | Strict persona + input gate first; students get the LLM output screen; retraction logged. The alternative (buffering) costs the streaming UX, so your call if you prefer it |
| Classifier adds latency and cost per message | Medium | Rule fast-paths skip the LLM for clear cases; tiny `max_tokens` |
| Single API worker (SSE hub, cancellation) | Medium | Same constraint as Pelita, documented; the Postgres LISTEN/NOTIFY upgrade path is noted |
| Animation weight on low-end tablets | Medium | Transform/opacity only; lazy-load players and confetti; test with CPU throttling; reduced-motion honoured |
| Leaderboards can discourage low scorers | Medium | Top 10 + own rank, effort-first celebration, teacher toggle (Q12) |
| Scope — this is a large build | **High** | 8 gated phases, each shippable; nothing half-built crosses a phase boundary |
| SerpAPI quota | Low | Per-teacher generation rate limit; cached research per (topic, grade) for 24h |

---

**Approved 2026-09-24.** Phases 1–5 done and pushed. Phase 6 next.

---

## 19. Live AI group tutoring (approved 2026-09-26)

A teacher launches a live lesson for one group in one of their classes. An AI
tutor teaches it out loud with live captions, takes raised hands, runs quick
check-ins, and ends with a recap and a quiz shared to the group.

### 19.0 Redlines (from you — nothing ships that breaks one)

1. **The tutor sounds like a real teacher.** It should be smooth, warm, well paced and helpful. It must not sound robotic, leave gaps, or read slides aloud. If it sounds funny, the feature has failed (§19.2).
2. **It looks and moves like the rest of Mentora.** Same tokens, motion presets, buddies, celebration and icons; its own kind colour; `prefers-reduced-motion` honoured; no cut or overlapping text, checked at 4 widths (§19.8).
3. **English only for now.** `language` stays in the settings with one allowed value, so adding BM later is data, not surgery.
4. **Teacher-controlled and safe.**
   - **A session a teacher creates goes onto each group member's schedule**, with reminders to join on time (added 2026-09-26, §19.8a).
   - Only teachers create sessions, and only members of the chosen group can join.
   - **Students see each other but cannot talk to each other** (added 2026-09-26). Each classmate in the room shows as their buddy and first name, with whether they are here. There is no chat, no messages, no reactions and no voice between students. The only thing a student can do toward the room is raise a hand to the tutor.
   - A student's mic works only while the tutor has called on them.
   - Transcripts are stored; student audio never is.

### 19.1 What we reuse (checked in the code)

| Need | Existing piece |
|---|---|
| Class, group, members-only | `ClassGroup`, `GroupMember` (`db/models/classroom.py`), policies + `Capabilities` |
| Work that outlives a request; replay to late joiners | `services/jobs.py` (`JobRunner.follow` replays from event 1, then live), `live_turns.py` |
| Push to an open browser | `services/realtime.py` (`RealtimeHub`, push after commit), `lib/sse.ts` |
| Grounded writing: check → research → skills → write ⟲ verify ⟲ repair | `learning/generator.py`, `learning/research.py` (SafeSearch, blocked hosts, `pictures()`), `learning/prompts.py` |
| Document text | `services/document_extract.py` (PDF, DOCX, text, images) + `document_excerpts.py` (budgeted keyword chunking). Chat documents are conversation-scoped and chat-gated, so sessions get their own table |
| Post-session quiz, skill-tagged, shared to a group | Quiz `LearningKind`, `GenerationService`, `AssignmentService.share` (class + groups + due date) → `AssignmentShared` → notifications. Skills feed strengths/weaknesses (`results_service`) |
| Notifications | `NotificationService` + event subscribers |
| Guardrails | `moderation/gate.py` (`check_input`, `check_output`), `guards/prompt_injection.py`, `StudentNeedsSupport` event, `moderation_service` queue |
| Speech | ILMU on the **same base URL and key** as the LLM. `ilmu-tts-v2.1` returns MP3 in about 0.7 s per sentence; `speed` works (0.85 gives about 150 wpm). `ilmu-asr-v4.2` transcribed English word for word in about 0.3 s. Neither returns word timings |
| UI | Buddies (rigs, choreography, speech bubble), auth `sky.ts` scene, `StepStones`, celebration + confetti, `useReadAloud`, `useCalmMotion`, `spring` presets, `make-tile`/`make-stage` |

### 19.2 Making the tutor sound like a person (the redline, engineered)

Natural speech comes from **six layers**. Each one is testable on its own.

| # | Layer | What it does |
|---|---|---|
| 1 | **Written to be spoken** | Every segment has two tracks: `say` (what the tutor speaks) and `show` (key points, an example, a picture on screen). The tutor never reads the screen. Prompt rules: talk to *this* group at *this* grade; use contractions; mix short and long sentences; put questions to the room ("Hands up if…"); signpost ("Here's the tricky bit"); one idea per beat; examples from a Malaysian student's life; callbacks ("Remember the leaf?"); no lists read aloud; no markdown |
| 2 | **Speakability check** | A verify stage in the existing verify ⟲ repair loop rejects: sentences over about 25 words, list-reading, unexpanded symbols, and pace outside 130–160 wpm for the segment's target time. The teacher approves every segment, and can listen to it in the preview |
| 3 | **Speech normaliser** (code, not the model) | Strips markup and expands what TTS stumbles on: `°C` → "degrees Celsius", `H₂O` → "H two O", `x²` → "x squared", `e.g.` → "for example", `1/2` → "a half", `%` → "per cent". Unit-tested with a corpus |
| 4 | **Beats, pre-recorded** | A segment (1–2 min) is split into **beats** of 2–4 sentences, one breath group each, synthesised whole so the intonation flows. All lesson audio is made **when the teacher approves**, so there's no waiting during the live lesson, and the teacher hears exactly what students will hear |
| 5 | **Gapless playback** | Web Audio API: the next beat is fetched ahead and scheduled on the audio clock. The pauses (`short` 0.3 s, `breath` 0.6 s, `think` 1.5 s after a question to the room) come from the script, never from the network |
| 6 | **Q&A that feels live** | When a hand is taken, a short line plays **instantly**, pre-recorded per student when they join the lobby ("Yes, Aisha?" / "Ooh, good question, Aisha"). The answer streams from the LLM; each sentence is screened, then synthesised as soon as it ends, so the tutor starts speaking about 1.5–2.5 s after the question. Answers are short (20–40 s spoken) and end with a bridge back ("Right — back to chlorophyll"). Similar questions merge: "A couple of you asked about…" |

- **Pausing for a hand.** The tutor finishes its **current beat** (≤ about 15 s) and then calls on the student, as a real teacher finishes the thought.
  - *Flagged:* your spec says "current sentence". Cutting a beat at a guessed sentence boundary risks clipping a word. If the Phase 0 choice gives us per-sentence clips with exact timings, it becomes the sentence.
- **Captions.** Word-by-word highlight runs on the audio clock. Within a beat, word times are estimated from syllable counts, which is close enough to look right.
- **The voice is a Protocol**, so the provider can be swapped:
  - `SpeechProvider` (`synthesize(text, voice, speed) → audio + optional timings`) and `Transcriber` (`transcribe(clip) → text`) sit in `providers/`, beside the LLM adapter.
  - ILMU is the default.
  - An ElevenLabs adapter is optional. It has character timings, `previous_text` stitching and very natural delivery, and ILMUchat's voice mode uses it. It needs an `ELEVENLABS_API_KEY`. Everything else is untouched.
- **Phase 0 gate.** No building until **you** say the voice sounds like a person (§19.9).

### 19.3 Real-time architecture

```
teacher dashboard ─┐                     ┌─ student A ─ SSE /stream + GET /audio/{beat}
                   │  POST /control       │─ student B
                   ▼                      │─ …
     ┌────────── SessionConductor (one asyncio task per live session) ─────────┐
     │ state: lobby → teaching(segment, beat) → holding → answering(hand)       │
     │        → checkin → recap → ended       (+ paused overlay)                │
     │ persists position after every beat → a restart resumes, never restarts  │
     └──────── SessionRoom: per-session fan-out, seq-numbered, replayable ─────┘
```

- **The server owns the timeline.**
  - Each `beat` event carries `starts_at` in server time.
  - Clients measure their clock offset with three `/live/time` pings (NTP-style) and schedule playback so everyone hears the same beat within about 200 ms.
- **Late joiners and reconnects.** `Last-Event-ID` replay plus a snapshot on join (transcript so far, the current beat, the offset into it). They start mid-beat at the right moment.
- **One TTS per beat, for everyone.** `GET /audio/{beat}` serves the same cached MP3 to every member, with auth checked.
- **Why not LiveKit.**
  - Lesson audio is one-to-many and pre-recorded, and questions are push-to-talk clips, so nothing needs a live two-way call.
  - LiveKit would add a media server, an agent worker, TURN and ports to the stack for latency we don't use.
  - Revisit it if we later want open-mic discussion.
- **Autoplay.** The **Join** tap unlocks the `AudioContext`. This is tested on iPad Safari.
- **Single worker.** Same constraint as today's hubs, and the same upgrade path (Postgres LISTEN/NOTIFY), kept in `SessionRoom` only.

### 19.4 Data model (new tables, one migration per phase)

| Table | Key columns |
|---|---|
| `live_sessions` | `teacher_id`, `class_id`, `group_id`, `template_id?`, `title`, `settings` JSONB (frozen copy of the setup), `status` (`draft · planning · ready · scheduled · lobby · live · ended · cancelled`), `position` JSONB (segment, beat), `scheduled_at`, `reminders_sent` JSONB, `started_at`, `ended_at`, `quiz_set_id?` → `learning_sets`, `assignment_id?` → `assignments`, `flagged_at` |
| `live_session_documents` | `session_id`, `filename`, `mime`, `size_bytes`, `text` (extracted; original bytes not kept, like chat documents) |
| `live_segments` | `session_id`, `position`, `subtopic`, `skill`, `title`, `beats` JSONB `[{id, say, show, pause}]`, `key_points`, `example`, `image`, `checkin` JSONB?, `target_seconds`, `status` (`draft · approved · played · skipped`) |
| `live_audio` | `beat_id`, `session_id`, `path`, `seconds`, `voice`, `model`. Files on a volume; **deleted 7 days after the session ends** |
| `live_participants` | PK (`session_id`, `student_id`), `first_joined_at`, `last_seen_at`, `seconds_present`, `removed_at` |
| `live_hands` | `session_id`, `student_id`, `status` (`queued · called · asked · answered · merged · redirected · dismissed`), `via` (`text · voice`), `question`, `merged_into?`, `answer`, `raised_at`, `called_at`, `answered_at` |
| `live_transcript` | `session_id`, `seq`, `segment_id?`, `speaker` (`tutor · student · system`), `student_id?`, `text`, `at` |
| `live_checkins` / `live_checkin_answers` | question + options + answer / `student_id`, `choice`, `correct` |
| `live_session_templates` | `teacher_id`, `name`, `settings` JSONB |
| Reports | A student's report becomes a `moderation_events` row (`source=live_session`), so admins see it in the queue they already have, and `live_sessions.flagged_at` is set for the teacher |

**Settings JSONB:**
- `subject`, `topic`, `grade_level`, `breakdown[]`, `difficulty`, `approach`, `custom_instruction`, `language` (`en`), `duration_minutes`
- `qa`: `anytime` or `pauses`, `max_per_student`
- `quiz`: `on`, `count`, `difficulty`, `due_at`
- `voice`, `start`

It's validated by a Pydantic model at the boundary.

### 19.5 API (all under `/api`)

**Teacher** (`run_live_sessions` capability):

| Method | Path | Does |
|---|---|---|
| POST · GET · PATCH | `/live-sessions`, `/live-sessions/{id}` | Draft from settings; list; edit settings |
| POST · DELETE | `/live-sessions/{id}/documents` | Upload and extract / remove |
| POST | `/live-sessions/breakdown` | "AI suggest breakdown" (editable list back) |
| POST | `/live-sessions/{id}/plan` | Generate the lesson (a job, streamed like guides) |
| PATCH · POST | `/live-sessions/{id}/segments/{sid}`, `…/regenerate` | Edit, or regenerate one segment |
| POST | `/live-sessions/{id}/approve` | Freeze the plan, record the audio (a job with progress) |
| POST | `/live-sessions/{id}/launch`, `/schedule`, `/cancel` | Go live now, later, or not at all |
| POST | `/live-sessions/{id}/control` | `pause · resume · skip · end` |
| POST | `/live-sessions/{id}/participants/{student}/remove`, `/hands/{hid}/dismiss` | Moderation in the room |
| GET | `/live-sessions/{id}/summary` | Attendance, questions by student, check-ins, quiz results |
| CRUD | `/live-templates` | Reusable setups |

**Student** (`join_live_sessions`, members of the group only):

| Method | Path | Does |
|---|---|---|
| GET | `/me/live-sessions` | The student's schedule: upcoming · live · past |
| GET | `/live-sessions/{id}/calendar.ics` | Add to calendar |
| POST | `/live-sessions/{id}/join` | A snapshot to start from |
| GET | `/live-sessions/{id}/stream` | SSE timeline (also used by the teacher dashboard) |
| GET | `/live-sessions/{id}/audio/{beat}` | The beat's MP3 |
| POST · DELETE | `/live-sessions/{id}/hand` | Raise / lower |
| POST | `/live-sessions/{id}/question` | A typed question (only while called on) |
| POST | `/live-sessions/{id}/question/voice` | A push-to-talk clip → STT → text; the clip is discarded. Refused unless this student is called on right now |
| POST | `/live-sessions/{id}/checkins/{cid}/answer` · `/report` | Check-in vote · report |
| GET | `/live-sessions/{id}/notes` | Recap and transcript |

Plus `GET /live/time` for clock sync.

Every route checks ownership and membership **as lookup parameters** (the repository rule in §3), and IDOR tests cover each one.

### 19.6 Lesson plan and quiz generation

- **`live/planner.py`** reuses the generator's stages and its Researcher, rather than becoming a `LearningKind`, because a lesson is not a set of gradable items.
  - check (scope, grade) → **documents** → research (gaps only) → write segments ⟲ verify (facts + speakability) ⟲ repair.
  - Segments are written in batches, with streamed progress.
- **Documents first.** Excerpts from the teacher's files become sources `D1…Dn`, ranked ahead of the web. Web research runs only for subtopics the documents don't cover, aligned to subject + topic + grade.
- **Approach and difficulty** are prompt contracts. Each one (storytelling, step-by-step, Socratic, example-heavy, exam-focused) is a small strategy object with its own writing rules, and the custom instruction is appended after the guardrail rules, never before.
- **Quiz.**
  - `GenerationRequest` gains optional `documents` (sources) and `notes` (a recap of what was taught, plus the questions students asked). The quiz kind itself is unchanged.
  - Skills are **fixed to the breakdown's subtopics**, so results land in strengths/weaknesses under the names the teacher chose.
  - It's shared with `AssignmentService.share(class, [group], due_at)`, so the notifications, results and leaderboard all come for free.

### 19.7 Guardrails

| Point | Rule |
|---|---|
| Student question in | `prompt_injection` + `ModerationGate.check_input`. Unsafe or off-topic: the tutor redirects with a **pre-written** kind line (no LLM, no echoing the question aloud); the event is logged. Self-harm: never spoken in the room. The existing `StudentNeedsSupport` alerts the teacher privately, and the student gets the support message on their screen only |
| Tutor answer out | Speech can't be retracted, so **each sentence is screened before it is synthesised**; a flagged sentence is dropped and replaced by a bridge |
| Scope | Answers are restricted to the session topic and grade; the teacher's documents are cited when used |
| Names | Only first names are spoken |
| Audio | Clips live in memory for STT only and are never written to disk |
| Reports | Go to the admin moderation queue and flag the session for the teacher |

### 19.8 Design (Mentora's look, its own colour)

- **Kind colour: Galaxy** (indigo, about 245°, between Blueberry and Orchid), as `--kind-live` and `--kind-live-vivid`, with dark-mode pairs. It has a night-sky theme that reuses the auth scene's `sky.ts` stars.
- **Student screens:**
  - **Lobby:** the sky drifts; each classmate who joins floats in as **their own buddy**; a countdown ring for scheduled starts; "Tap to join" (which unlocks audio).
  - **Live stage:**
    - **The tutor is a new character drawn in the buddies' style.** Its mouth and glow are driven by the *actual* voice (an `AnalyserNode` reading amplitude), so it moves when it speaks and breathes when it doesn't.
    - The `show` card animates in beside it: key points, a picture, a worked example.
    - Captions sit underneath with word-by-word highlight.
    - A segment progress bar of glowing stars runs along the top.
  - **Raise hand:** the hand waves as it goes up. A queue chip says "You're next" / "2nd in line". When called on: a push-to-talk ring (Phase 4) or a type box; the tutor's "Yes, Aisha?" plays.
  - **Check-in:** a poll card pops up, with a live bar of the group's answers after voting.
  - **End:** the recap, then the celebration (confetti, buddy cheer), then "Your quiz is ready", which opens the player.
  - **Session notes:** key points plus the full transcript, in the student's history.
- **Teacher screens:**
  - **Setup wizard:** `StepStones`, with templates to start from.
  - **Plan preview:** segment cards with ▶ listen, edit, regenerate, approve.
  - **Live dashboard:** stage mirror, attendance, hand queue, transcript, controls.
  - **Summary page.**
- **Reduced motion:** a still avatar with a soft glow, captions still highlighted, no confetti burst.
- **The text audit sweep** runs at 1440, 1024, 768 and 390 before each phase is called done.

### 19.8a The student's schedule and reminders (added 2026-09-26)

- **On the schedule the moment it exists.** When a teacher schedules a session, or launches one now, it appears for every member of the group:
  - an **"Up next" card on Student Home**: title, Astra, the start time and a live countdown. It turns into a glowing **Join** button 10 minutes before the start;
  - a **My schedule** page: upcoming sessions by day, then past ones with their notes and quiz;
  - an **Add to calendar** button (an `.ics` file), so it can sit in the family calendar too.
- **Reminders**, as notifications through the existing bell and toast, each linking straight to the lobby:

| When | Says |
|---|---|
| When it is scheduled | "New live lesson with Astra: *Photosynthesis*, Tuesday 10:00" |
| 1 day before (if it was scheduled further out) | "Tomorrow at 10:00: *Photosynthesis*" |
| 15 minutes before | "Starting in 15 minutes — get ready!" |
| At the start | "Astra is starting now — join!" (only to those not yet in the room) |
| Moved or cancelled | "*Photosynthesis* has moved to Wednesday 11:00" / "…has been cancelled" |

- **How:** a small scheduler loop in the app's lifespan checks for due reminders every 30 s. Each one sent is recorded on the session (`reminders_sent`), so a restart never sends one twice, and a late loop never sends a stale one (a reminder more than 5 minutes past due is skipped). The single-worker note in §19.3 applies.
- **Changes are real time:** scheduling, moving or cancelling pushes to open browsers through the existing realtime hub, so the card and the schedule update without a reload.
- **Seeing classmates, never talking to them:**
  - The lobby and the stage show who is here: each classmate's buddy and first name, arriving and leaving with the buddies' animations.
  - No text box, no reactions and no mic reach another student.
  - The server has no endpoint that sends anything from one student to another, and a test asserts that.

### 19.9 Build phases (your order, with a voice gate added and one change flagged)

Each phase: TDD → lint + tests → `make up` → a browser check (desktop + phone) → feature doc → commit + push → a short summary → **wait for your go**.

| # | Phase | Delivers |
|---|---|---|
| **0** | **Voice gate** | One real 90-second lesson segment plus one Q&A exchange, in the candidate voices and speeds, with the beat chunking and gapless playback on a test page. **You pick the voice, or say none is good enough and we add ElevenLabs.** Nothing else starts before this |
| **1** | **Setup, plan, preview, templates, scheduling** | Tables for sessions, documents, segments and templates; setup wizard; suggested breakdown; documents-first planner with the speakability check; preview with edit, regenerate and listen; approve (records the audio); **schedule or start now → it appears on each student's "Up next" card and My schedule, with the "new live lesson" notification** |
| **2** | **Live core, with voice** | Conductor + room + clock sync; **reminders (1 day, 15 min, at start)**; lobby **with classmates shown as their buddies (presence only, no talking)**; narrated beats + captions; typed raise-hand queue; spoken AI answers with instant acknowledgements; recap; quiz handoff. *Flagged change:* narration moves here from your Phase 4. Whether it feels natural can only be judged with the voice on, and the timeline has to be built on real audio durations, so text first would mean building the conductor twice |
| **3** | **Teacher controls + summary** | Pause, resume, skip, end, remove, dismiss; dashboard; summary; student notes |
| **4** | **Voice questions** | Push-to-talk (mic only while called on) → `ilmu-asr-v4.2` → the same answer path |
| **5** | **Check-ins, visuals, polish** | Moving and cancelling with their notices; add to calendar; check-in polls; pictures in the `show` card; the celebration; reduced-motion pass; iPad Safari pass |

### 19.10 Risks

| Risk | Level | Mitigation |
|---|---|---|
| The voice sounds synthetic (**redline**) | **High** | The Phase 0 gate; the script is written for speech; the normaliser; paced at 0.85; ElevenLabs adapter as the fallback |
| Q&A pause feels awkward | Medium | Instant pre-recorded acknowledgement; sentence-by-sentence streaming TTS; "thinking" animation on the avatar |
| Students drift out of sync | Medium | Server-time `starts_at`, clock offset, audio-clock scheduling; tolerance 200 ms |
| Autoplay blocked (iOS) | Medium | The Join gesture unlocks audio; a visible "Tap for sound" fallback |
| Server restart during a lesson | Medium | Position persisted per beat; the conductor resumes on boot |
| Lesson plan generation time (30 min ≈ 15–20 segments) | Medium | Batched, streamed progress like guides; recording is a background job with a progress bar |
| Mispronounced names or terms | Low | The teacher hears every beat in the preview; a per-student "say my name as" field later if needed |
| TTS cost | Low | One synthesis per beat for the whole group; about 4,500 words for a 30-minute lesson |

**Defaults I chose (overturn any):**
- up to 3 questions per student
- a check-in is open for 20 s
- the teacher watches from the dashboard by default
- segments of 150–300 words
- audio kept 7 days
- the tutor gets a friendly name you can change, set per template

---

## 20. Parents (approved 2026-09-26)

A new kind of account for a child's parent or carer. The parent is linked to
their child, and through the child to the child's classes and teachers. They
see everything the child does, make learning material to share with them,
use the chat, and hear straight away when the child misses work.

### 20.0 Your decisions (asked 2026-09-26)

1. **Signing up.** A parent signs up on their own, or through an invitation
   their child sends. Either way it is the **child's invitation that links
   them**: a parent who signed up alone connects by opening the child's link
   or typing the child's 6-letter code.
2. **Teachers.** A parent is connected to the child's teachers automatically,
   for as long as the child is in the class. **They see each other, nothing
   more:**
   - The parent sees the child's classes, teachers and schedule.
   - The teacher sees which students have a parent connected, and who.
   - No messages, no notices.
3. **"Missed" means past-due work.** Work passes its due date unfinished,
   whether a teacher's quiz, deck or guide or one the parent shared. The
   parent gets an instant notification: in the bell, live, and once per piece.
4. **Chat only.** Parents get the AI chat as adults supporting a child. There
   is no studio (posters, slides, sites, games, apps).
5. **Only the parent can break the link.** The child starts it, but cannot
   quietly cut their parent off.

### 20.1 Roles and access (enforced on the backend, like every role)

- `Role.PARENT` joins `admin | teacher | student`. It needs a migration to
  widen `ck_users_role`.
- New capabilities in `policies/capabilities.py`:
  - `see_children`: a parent's view of their own children.
  - `make_family_sets`: make material and share it with a linked child.
- Parents also get `use_chat=True`, and **no** `studio_artifacts`,
  `manage_classes`, `share_learning_sets` or `join_classes`.
- **Ownership is the lookup.** Every child read goes through
  `FamilyService.child(parent_id, student_id)`. A child who is not linked is
  *not found*, never *forbidden*, the same rule the classes use.

### 20.2 Linking a parent to a child

| Step | What happens |
|---|---|
| Child invites | Settings → **My family** → *Invite a parent*. It gives a link (`/family/<token>`) and a 6-letter code, like a class invite. It can be turned off and made anew, and expires after 14 days. |
| New parent | The link opens parent sign-up with the child named ("Aina has invited you"). The account and the link are made together. |
| Existing parent | Signed in, the link asks *"Connect to Aina?"* and links on yes. On their home, *Connect a child* takes the code. |
| Limits | A child can have up to 4 parents; a parent up to 8 children. The child is told ("Your mum is connected") in the bell. |
| Unlinking | Only the parent: *Disconnect* on the child's page, with a confirmation. |

Tables: `family_links` (parent, student, created; unique pair) and
`family_invites` (student, token, code, enabled, expires).

### 20.3 What the parent sees — everything the child does

- **Parent home**, one card per child:
  - Their buddy and first name, streak and badges.
  - What is waiting, with anything past due in coral.
  - The latest results with scores, and what is coming up live.
- **Child page** (`/children/:id`), in tabs:
  - **Overview**: this week's work, done and to do; the latest attempts with
    scores; skills they are strong at and those to practise.
  - **Work**: everything shared with them (teacher and family) with its
    status, due date and best score, and the attempt reviews they can open.
  - **Results**: strengths and weaknesses by skill, and the history.
  - **Practice**: the child's own practice sets, and the "Made for you"
    practice.
  - **Schedule**: live lessons coming up and done, with the notes.
  - **Classes and teachers**: each class, its teacher and the class's
    coverage map, read-only.
- It reuses what exists: `StudentHomeService`, `ResultsService.insights`,
  `LiveSessionService.for_student`, `ClassPulseService.for_student` and the
  coverage map, all called **for the child**, behind the family lookup.
- **Teachers**: the class's Students tab shows a small family icon on each
  student with a parent connected, and the parent's name on hover.

### 20.4 Parents make and share material

- A parent makes a quiz, flashcards or a study guide with the same Create
  sheet and grounded generator. The set is `purpose = "family"`, a new value
  in the purpose check.
- **Share with my child**, optionally with a due date:
  - A `family_shares` row (parent, child, set, version, due).
  - The child's home gets a **From home** section, with *"Mum sent you a
    quiz"* in the bell.
  - The child takes it like practice (`AttemptService` accepts a set shared
    with them by a linked parent). It counts for badges and skills like any
    other work.
- **Results come back.** The parent sees the attempt and its score on the
  child's page, and gets *"Aina finished your quiz — 80%"* in the bell.
- Parents get the background tray and bell note when a set is ready, as
  teachers do (§ background work).

### 20.5 Past-due alerts (instant)

- A **due watcher** runs on the existing scheduler loop every minute:
  - It finds shared work (class assignments and family shares) whose
    `due_at` has passed with no completed attempt by the student.
  - For each linked parent it sends one notification per work per child:
    *"Aina hasn't finished The Water Cycle — it was due today at 5 pm"*,
    linked to the child's Work tab.
  - A unique key (`overdue:<work>:<child>`) means it is never sent twice.
- A closed assignment, a child who left the class, or work finished late
  before the watcher runs sends nothing.
- The kind is `child_overdue`. It is realtime, like every bell note.

### 20.6 Chat for parents

- `use_chat=True`, with a **parent persona**: a new `context/persona.py`
  case, "an adult supporting their child's learning at home".
  - It has plain language and practical tips.
  - It is aware of Malaysian school years.
  - It never names the child's classmates or scores unless the parent asks
    about their own child.
- The adult guardrails apply, not the student ones. The injection guard and
  the output screen run as for teachers.
- There is no studio: the Create menu in chat shows only quiz, flashcards and
  study guide.

### 20.7 Look and feel

- **Parent theme**: the same design system, with a warm family accent (its own
  kind colour) and the child's buddy on every child card.
- **Sign-up**: a third door on the sign-up chooser, *"I'm a parent"*, with the
  buddies watching as on the other two.
- The same bar as everything else:
  - Animation throughout.
  - No cut or squeezed text, checked by the two sweeps at 4 widths.
  - No lone cards (the §12 layout rules).

### 20.8 Phases

| # | Phase | Done when |
|---|---|---|
| P0 | **Role and linking** | Parent sign-up (alone or by invite), the child's invite (link and code), connect by code, disconnect (parent only), limits. The teacher sees the family icon, and the parent sees the child's classes and teachers. |
| P1 | **Seeing the child** | Parent home and the child page, all six tabs, with live updates as the child works. |
| P2 | **Make and share** | Family sets, share with due date, *From home* for the child, results and notifications both ways. |
| P3 | **Past-due alerts** | The due watcher, deduped instant notes, tested with a clock. |
| P4 | **Chat** | The parent persona, adult guardrails, chat without studio. |
| P5 | **Polish** | Design pass, docs (042–044), both layout sweeps at 4 widths, a demo parent in `make demo`. |

Each phase ends with tests, a deploy, a browser check and a local commit (no
push until you say).

### 20.9 Defaults I chose (overturn any)

- **Relationship label**: the parent picks *Mum, Dad, Guardian* or types one.
  It is used in the child's notes ("Mum sent you a quiz").
- **What the parent sees**: everything the child does in Mentora, including
  their own practice. The child is told a parent is connected, in their bell
  and under My family, so nothing is hidden from them.
- **No parent–parent visibility.** Two parents of one child do not see each
  other's shared material unless they share it with the child. Both see
  everything the child does.
- **A child with no class** can still link a parent. They get the family
  features and nothing from school.
- **Demo data**: `make demo` adds `parent.demo` (Aina's mum) with a shared
  quiz and one past-due item, so every screen has something to show.

---

## 21. My materials — a teacher's own files, reused (requested 2026-09-26)

A teacher's worksheets, textbook chapters and notes, uploaded once and kept.
Any quiz, flashcard deck, study guide or live lesson can then be made from
them.

- **The library.** Library → **Materials**. Upload PDF, Word, PowerPoint or
  text files, up to 10 MB each and 100 files per teacher.
  - Each file is read once into text (`document_extract`, as live lessons and
    chat already do) and kept with its title, type, size and pages.
  - A file can be renamed or removed. Searching looks at titles and text.
- **Making from them.** The Create sheet gets **Use my materials**: pick one
  or more files, or upload a new one on the spot.
  - The generator is grounded in the teacher's files first: the chosen files
    become the sources, the way a live lesson's quiz uses its transcript.
  - *Also search trusted sources* (on by default) fills gaps from the web.
    Turned off, only the files are used.
  - Items cite the file and page they came from.
- **Live lessons** can attach files from the library instead of uploading
  them again.
- **Defaults I chose (overturn any):**
  - Materials are private to the teacher who uploaded them.
  - Parents get the same library when they make material (§20 P2).
  - Scanned PDFs with no text layer are read by the vision model when one is
    set. Otherwise the file is refused with a clear message.

---

## 22. Changes requested 2026-09-27

1. **Students practise; they do not make sets.** Quizzes and flashcards come
   from teachers and parents, or from Mentora's *Made for you* practice built
   on each student's weak spots.
   - `make_practice_sets` is off for students, and `auto_practice` now checks
     `take_assignments`.
   - A student *Practice* page (`/practice`) lists practice made for them, work
     from home, and any sets made earlier (kept playable).
2. **Preview as a student** for quizzes and flashcards
   (`/library/:id/try`). It runs the real players, marked locally, and saves
   nothing.
3. **Three looks by year** for quizzes and flashcards, picked from the
   student's year:
   - Year 1–3: engaging, most animation;
   - Year 4–6: less animation, with points;
   - Form 1–5: the look as it was.
4. **Studio creation revoked for everyone.** No posters, slides, games,
   websites or apps via the chat or anywhere. Existing ones stay viewable
   (`view_artifacts`). `/studio` goes to `/chat`.

Docs: `044-play-looks.md`, plus notes in `024`, `025`, `029`, `030` and `035`.


---

## 23. Play and Learn — story games (approved 2026-10-08)

Teachers and parents make a **game** on any topic; students play it, learn
the topic while they play, earn points and stars, and replay to beat their
best.

### 23.0 Your decisions (asked 2026-10-08)

- **Mentora's own engine, AI content.** The AI writes the story, the world,
  the characters, the narration and the challenges — checked for accuracy and
  pitched to the year and level like every quiz. Mentora's game engine, built
  once and polished, turns them into the game. No model-written code runs on a
  student's device, scores are marked on the server, and a build takes about a
  minute. The old AI-coded studio "games" stay off (§22.4).
- **Four styles, plus "Let Mentora decide":** Quest Map, Lane Runner, Bubble
  Catch, Match & Build.
- **Leaderboard: opt-in when sharing**, ranking each student's best score.

### 23.1 Making a game (teacher or parent)

1. **Make a game** — teacher home, parent home, Library, chat. Topic,
   subject, year, **level (Beginner / Intermediate / Advanced)**, language,
   optional My materials.
2. **Story** — *Surprise me* (written during the build), *Draft with AI*
   (a draft in seconds, edited before building) or *Write my own*
   (safety-checked; the game is built around it).
3. **Style and world** — the four styles or *Let Mentora decide*; Malaysian
   worlds: Taman Negara rainforest, Sipadan reef, kampung festival, KL city,
   space.
4. **Watch it build** — story → challenges → checking answers → world. It
   keeps going in the background; the bell says when it is ready.
5. **Play it first** — the real game, nothing recorded. Edit story lines and
   challenges; switch style or world instantly, no rebuild.
6. **Share** — class, group or child. Replays unlimited by default.

### 23.2 Playing (student)

- A game card on their home; full-screen play. Astra narrates the story with
  subtitles; **the student's own buddy is the sidekick**.
- Three chapters of challenges, the last one a boss. A wrong answer shows a
  hint and a short explanation, then the story goes on.
- **Points** for each right answer, with combo and speed bonuses worked out on
  the server; **1–3 stars per chapter**; best score kept; *Beat your best!*
- **Tricky ones** — a calm round of the challenges missed, after the finish.
- **Sound** — music for each world and effects, made in the browser (no audio
  files). On for students from the first tap; a mute button.
- The year looks of §22.3; timers 30 / 20 / 15 s by year band, none on
  Beginner. Text size, reduced motion, keyboard and touch respected.
- New badges: **Game Hero** (finish a game), **Three-Star Star** (three stars
  in every chapter), **Never Give Up** (win after a hard try).

### 23.3 Teachers see

Results per challenge (first try counts, best beside it, as quizzes), stars,
points and who finished. Topic coverage takes game scores automatically.

### 23.4 How it is built

- **A learning kind, `game`** (`learning/game.py`, one registry line). Its
  items are challenges (prompt, 2–4 short options, answer, hint, explanation,
  skill); the story and world are set-level `extras`, written by the finish
  step. Sharing, attempts, results, coverage, the bell and the work tray come
  with the kind.
- **Level** is a column on `learning_sets` (any kind may use it); **points** a
  column on `attempts`. One migration.
- `POST /learning-sets/story-draft` drafts a story. The teacher's own story is
  screened like a topic.
- **Engine** — `frontend/src/features/game/`: scenes (story, map, challenge,
  boss, finish), the four styles, drawn worlds with the student's buddy, Web
  Audio music and effects, full screen. It plugs into `/play/:id` and the
  preview at `/library/:id/try`.

### 23.5 Phases

1. Backend — kind, level, story, style and world, story draft, points,
   badges, best-score leaderboard, narration, tests.
2. Engine — four styles, sound, narration, buddy sidekick.
3. Make, edit, preview and share; homes, Library, chat.
4. Docs (`docs/features/050-play-and-learn.md`), README, checks at four
   widths, full test run. Push and deploy when you say.

**Status (2026-10-08):** phases 1–4 built and committed locally, not pushed
or deployed. Built as planned, plus: story-mode, style and world pickers
that wrap rather than scroll on a phone; style and world picked before a
story is drafted, so the draft is set there; the buddy kept the only animal
friend in a story. Known limits are in the feature doc.

### 23.6 Defaults I chose (overturn any)

- Nine challenges by default (three to fifteen — one a chapter at least),
  three chapters, easiest first.
- A wrong answer never ends the game: the score drops, the story goes on.
- Astra's voice is English only; other languages get subtitles and the
  browser's voice.
- Parents' games count toward `PARENT_SETS_PER_DAY`.

## 24. Play and Learn, revised — AI-coded simulation games (approved 2026-10-08)

**Why:** the games of §23 are multiple-choice questions dressed as a map, a
road, bubbles and a build. *"Those are not games. Those are like quiz with
game vibe."* A real game makes the topic the thing you play: you change the
sunlight and the plant grows or wilts.

### 24.0 Your decisions (asked 2026-10-08)

- **The AI codes a new game each time** — one HTML/CSS/JS document per game,
  built by the studio's game builder (`artifacts/games.py`, switched off
  since §22.4), locked down for students. This **reverses §23.0** ("no
  model-written code runs on a student's device"); §24.4 is what makes that
  safe enough.
- **Simulations:** the student experiments and watches what happens.
- **Scores come from the game.** A clever student could fake them; accepted.

### 24.1 What a game is now

- **A simulation with missions** — 4 by default, 3 to 6. Each mission is a
  goal the student reaches by experimenting, and what it teaches:
  - *Photosynthesis, Year 5:* sliders for sunlight, water and carbon
    dioxide; the padi plant grows, its leaves green or yellow, a sugar meter
    fills. Mission 1: *"Grow it to full height before sunset."* Mission 2:
    *"Keep it alive through a cloudy day."*
  - *Fractions, Year 3:* pour sirap and water into a jug marked in parts.
    Mission: *"Mix exactly 3/4 of a jug for Pak Ali's stall."*
  - *Water cycle, Year 4:* heat the sea, cool the air, move the wind; clouds
    form and rain falls. Mission: *"Make it rain on the dry padi field."*
- **Missions are written and checked first**, like quiz questions — grounded
  in sources (or the maker's files), pitched to the year and level. Then the
  AI codes the simulation around them, and the game must report each one.
- **"What you discovered"** after each mission is the checked explanation,
  shown by Mentora outside the game — the learning text a student reads is
  never the model's code.
- **Kept from §23:** level, story (*Surprise me* / *Draft with AI* / *Write
  my own*), the buddy named in the story, the five Malaysian settings (now a
  hint for the art, or *Let Mentora decide*), sharing, best-points
  leaderboard (opt-in), badges, homes, Library, chat.
- **Level:** *Beginner* — guided, wide targets, an on-screen nudge;
  *Intermediate*; *Advanced* — more variables, tighter targets. No timers
  unless a mission needs one.
- **Removed:** the four quiz styles (Quest Map, Lane Runner, Bubble Catch,
  Match & Build), the drawn worlds and the engine that played them. A build
  that fails is *"Couldn't make it — Try again"*, never a quiz in costume.

### 24.2 Making a game (teacher or parent)

1. **Make a game**, from the same places. Topic, subject, year, level,
   language, how many missions, optional My materials, setting, story.
2. **Watch it build, about 2–4 minutes:** check the topic → research →
   skills → write and check the missions → design the simulation → code it
   → playtest it on a phone and a laptop → screen its words. The bell rings
   when it is ready.
3. **Play it first** — the real game, nothing recorded.
4. **Change it:** edit a mission's words directly, or type a change — *"make
   the sun slider bigger"*, *"add a rain button"* — and the AI rewrites and
   retests it as a new version.
5. **Share** with a class or send it home, as today.

### 24.3 Playing (student)

- Full screen. The story's opening is told (read aloud) by Mentora, then the
  game starts. Around the game, Mentora's own bar: the missions with ticks,
  points, a hint button (costs points, as today), mute, full screen, exit;
  the buddy beside it, cheering each mission.
- **Points:** worked out on the server from what the game reports — 100 a
  mission, +25/+50 for medium/hard, +25 for reaching it on the first go,
  −40 for a hint. Best score kept; *Play again* to beat it.
- **Finish:** points, best, missions done, *Try the missions you missed*
  (the game restarts at those), and what each mission taught.

### 24.4 Safety — what was missing when it was switched off

- **One way in:** the game is served from its own address with a strict
  content policy — no network, no web fonts or images, no forms, no popups —
  in a frame that may run scripts and nothing else. (Today's panel loads it
  inline, where the network rule never applies.) The same policy is also
  written inside the document as a second lock.
- **Works offline:** everything drawn in code; nothing is fetched from a
  child's device.
- **No broken game ships:** network calls, `eval`, outside scripts and
  endless loops must be fixed or the build fails. A game that errors,
  freezes, does not fit a phone, or cannot complete its own first mission
  (each game includes a demo that plays mission 1, run by the robot) fails
  after two fixes — today such games ship anyway.
- **Its words are screened** by the student safety rules before anyone sees
  it.
- **A narrow channel out:** the host listens only to that frame, only for
  `mission`, `hint-shown` and `finished` messages naming real missions;
  everything else is ignored.
- **Only teachers and parents build;** students only play. The studio stays
  off.
- **Every model call counts** toward the maker's daily quota (today only one
  of them does).

### 24.5 How it is built

- **Kind:** `game` keeps its name and everything around it; its items become
  missions `{id, goal, win (the condition in words), explanation, hint,
  skill, difficulty}`, checked like quiz items.
- **Builder:** `learning/sim/` — prompts (design, write, fix, change), the
  `Mentora` runtime injected into every game (`ready`, `mission(id,
  result)`, `finish`, buddy name, level, language, calm motion, sound on or
  off, and a few sound effects), and the build steps, reusing
  `artifacts/model.py` and the playtest browser.
- **Playtest, upgraded:** two sizes (390×844 touch, 1280×800 keys), errors,
  freezes, the demo completing mission 1, the mission message arriving.
- **Storage:** a new `game_documents` table (set, version, html, playtest
  report, tokens). One migration.
- **Routes:** the document for the maker's preview and for a student's
  attempt (authorised by the attempt), both with the content policy; a
  mission report; the hint as today; *Change it*.
- **Frontend:** `features/game/` rewritten as a host (frame, bridge, bar,
  discoveries, buddy, finish); the create sheet loses style; the editor
  gains *Change it*.

### 24.6 Phases

1. This plan — your yes, or changes.
2. Backend: missions, builder, runtime, storage, routes, safety, playtest,
   tests. Build three real games locally (photosynthesis, fractions, water
   cycle) and show them to you before going further.
3. Frontend: host, bar, discoveries, finish, make and change; remove the old
   engine; the three demo games remade.
4. Docs, README, screenshots, four widths, full tests. Push and deploy on
   your word.

### 24.7 Defaults I chose (overturn any)

- Four missions by default (three to six).
- A failed build fails — no fallback to the quiz-style game.
- The quiz-style game code is deleted, not kept as an option.
- In-game words in the set's language; the design prompt is English, so
  English games will be the best.
- Must work on a phone, portrait and landscape.

### 24.8 Risks, plainly

- **Quality varies.** Some games will be dull or awkward; a robot can test
  that a game runs and its first mission can be done, not that it is fun.
  *Play it first* and *Change it* are the answer.
- **Time and cost:** about 3–5 model calls of up to 16k tokens each on the
  artifact model, 2–4 minutes a build; every *Change it* is another full
  rewrite. I'll measure real numbers in phase 2.
- **Faked scores** (accepted), so a leaderboard can be gamed.
- Builds run in the one API process, as every set does.

## 25. Games that teach, easily — Learn it, Try it, Do it (approved 2026-10-08)

**Why:** *"I feel like games are difficult for student. Story is poor."* The
§24 games put a child in front of every control at once with a goal like
"make the leaves darker green" and leave them to find the rule by trial and
error. The story is one paragraph at the start that never moves.

### 25.1 Every mission is a little lesson in three beats

1. **Learn it** (Mentora, outside the game). A story panel, comic-style: a
   character says the one idea in a sentence a child can read, with a big
   picture-word — *"Leaves are tiny kitchens. They cook food from sunlight!"*
   — read aloud. One idea per mission, never more.
2. **Try it with help** (the game). The one control that idea is about
   glows, an arrow points at it, and the buddy says what to do — *"Slide the
   sun up!"*. Only that control works. The scene reacts big: the leaves turn
   green, a sparkle, a sound. It cannot be got wrong.
3. **Do it yourself** (the game). A small problem that uses the idea —
   *"Clouds are coming! Keep the plant green."* The target shows as a green
   zone on the control; feedback is warmer/colder (*"Almost — a bit more
   sun!"*). Two misses and **Show me** appears: the buddy plays it while the
   child watches, then it is their turn again.

Then **What you discovered** — the checked explanation and its picture-word —
and the story moves on.

### 25.2 One thing at a time

- Controls arrive one per mission: mission 1 only the sun; mission 2 adds
  water; mission 3 uses both. The last mission is a **big finish** that puts
  them together.
- **Picture first:** icons and meters instead of numbers for Years 1–3;
  numbers with units from Year 4; a simple graph for the Forms.
- **You cannot lose.** No lives, no game over. A wilted plant springs back
  with *"Try again!"*. Stars per mission: first go, after help, after
  Show me.
- By level: *Beginner*, all three beats every time. *Intermediate*, Try it
  is shorter. *Advanced*, straight to Do it, with Learn it a tap away.

### 25.3 A story worth following

- Written first, as a **story plan**: a main character with a name and a
  problem (*Atuk Hassan's padi is turning yellow before the harvest
  festival*), the buddy as the child's sidekick, one **story beat per
  mission** — each one moved forward by what the mission taught — a
  cliffhanger between missions (*"…but the sky is getting dark!"*), and an
  ending that celebrates what the child did.
- Mentora shows the story, not the game's code: speech-bubble panels with
  the character and the buddy, read aloud, before and after each mission —
  so its words and look are always good, whoever wrote the game.
- The game draws the same character and place, named in the code, so the
  story and the play are one world.

### 25.4 How it changes what is built

- **Missions** gain `learn` (the idea, one sentence), `icon` (a
  picture-word), `before` and `after` (the story beats), and `try` (the one
  control and the guided action). Checked as now.
- **Story plan** replaces the story paragraph: title, character, problem,
  beats, ending — in the set's extras, editable.
- **The game's code** must: unlock controls one mission at a time; run a
  guided Try it for each mission (glow, arrow, only that control live);
  show the target zone on Beginner; give warmer/colder feedback; never end
  the game; and provide `Mentora.demo(missionId)` for **every** mission
  (Show me — the robot still checks mission 1 with it).
- **The runtime** adds `Mentora.phase(id, "try" | "do")` so Mentora knows
  which beat the child is on, and `Mentora.showMe(id)`.
- **Mentora's screen** adds the story panels (character avatar, buddy, read
  aloud), Show me after two misses, and stars per mission.
- **Points:** a star for each beat done without help; Show me still
  completes the mission, with fewer stars — never zero.

### 25.5 Phases

1. This plan.
2. Missions, story plan and prompts (backend); rebuild the three demo
   games and show them.
3. Mentora's story panels, Show me, stars (frontend); four widths.
4. Docs, tests. Push and deploy on your word.

**Built** (2026-10-08/09), not committed: phases 1–4. Of about nine builds,
three passed; each took 4–6 minutes, and the ones that passed still had
flaws (a tiny plant, repeated missions). **Superseded by §26.**

## 26. Play and Learn from Mentora's own game templates (approved 2026-10-09)

**Why:** *"Mentora could not create the game gracefully. The game is too much
for Mentora."* A teacher makes a game, plays it, and shares it with the
class, so it must be **built every time**, be **clear and easy to learn
from**, and fit the student's **year** (Year 1–6, Form 1–5). In §24/§25 the
AI wrote each game's code from scratch: about one build in three passed,
after 4–6 minutes, and the games that passed were not ready to share.

**The idea:** Mentora owns a set of game **templates**. We build each one
once, as part of the app, and test it in the browser like any screen. The AI
writes only the **content**: it picks the template that fits each idea and
fills in its cards, steps, pairs or sliders for the year. Content is checked
like quiz items, so there is no code to fail.

### 26.1 What a game is

A game is a **treasure map** of 3–5 islands, set in one of the five
Malaysian worlds (rainforest, reef, kampung, Kuala Lumpur, space). Each
island is one idea, simplest first.

1. **The story**: a short comic with a character and the student's own
   buddy, read aloud (from §25).
2. **On each island**:
   - **Learn it**: the idea, big, with a picture, read aloud (from §25).
   - **Play it**: one round of a template. Every move is answered at once,
     and a wrong move says *why* ("Vinegar is an acid: it tastes sour").
     **Show me** plays one correct move.
   - **What you discovered**: the explanation, stars, and the story moves
     on. The fog lifts from the next island.
3. **The ending**: stars and points. Islands not cleared stay **foggy** and
   can be replayed on their own.

The teacher's results show the map for each student (*who is stuck where*),
and the moves most often wrong ("12 students put *whale* under *fish*").

### 26.2 The templates

**Learning templates**: the move is the lesson.

| Template | The student… | Fits | Years |
|---|---|---|---|
| **Sort It Out** | drags cards into 2–4 baskets | classifying: acids/bases, living/non-living, simile/metaphor | all |
| **Line Up** | puts steps, events or words in order; right ones lock | processes, timelines, proofs, karangan, sentence building | all |
| **Match Up** | joins pairs | word↔meaning, cause↔effect, formula↔use, BM↔English | all |
| **The Lab** | moves 1–3 sliders and watches a scene or graph change, to reach a target | variables: light and plants, circuits, projectiles, supply and demand, graphs | Year 3 up |
| **Spot the Mistake** | taps the wrong line in a worked answer or paragraph and picks the fix | maths working, grammar, science explanations (SPM) | Year 4 up |
| **Detective Case** | reads clue cards (text, a table, a chart) and picks who or what, and the clue that proves it | sources (Sejarah), science reasoning | Year 5 up |
| **Escape Room** | opens 3 doors; each puzzle's answer is the code (a number, an order, a word) | multi-step problems | Year 4 up |

**Revision templates**: fast recall on a topic already learnt. These are
answer-driven by nature, so they are offered for revision, never as the way
to learn a topic.

| Template | How it plays |
|---|---|
| **Boss Battle** | each right answer hits the boss; a wrong one, the boss hits back. On the class screen, the class shares one health bar. |
| **Tug-of-War** | two teams on the teacher's screen; each right answer pulls the rope. Questions get harder near the edge. |
| **Streak Ladder** | climb until the first slip; the teacher sees where each student breaks. |

From Wordwall: *Group sort* is Sort It Out, *Rank order* and *Unjumble* are
Line Up, *Match up* is Match Up.

**Not in this plan:**

- **Role-Play Debate and Teach the Bot**: these need students to chat with
  the AI, which Mentora does not allow students.
- **Labelled diagrams**: these need a picture with known positions, which we
  can't draw reliably.

### 26.3 By year

| | Year 1–3 | Year 4–6 | Form 1–5 |
|---|---|---|---|
| Words | a picture and 3–6 words on each card; everything read aloud | short sentences | the subject's terms, equations, sources |
| Size | 4–6 cards, 2 baskets, 3–4 steps | 6–9 cards, 3 baskets, 5–6 steps | 8–12 cards, 3–4 baskets, 6–8 steps |
| Help | Show me after one miss; no timer | after two misses | after two misses; timer and combos if wanted |
| The Lab | one slider in stops (low, medium, high) | two sliders, numbers with units | real formulas and a graph |

Within each band, the level (Beginner, Intermediate, Advanced) moves the
size and the help a step.

### 26.4 How a game is made, every time

1. The teacher picks the topic, subject, year and level, and how it plays:
   *Let Mentora choose* (the default) or particular templates.
2. Mentora checks the topic, researches it and writes 3–5 ideas, simplest
   first (the existing pipeline).
3. For each idea, it picks the template that fits and writes its content to
   that template's form, at the year's size. Each card carries its own
   *why*.
4. **Checks**: the facts are checked against sources, as for quizzes. Each
   template also has its own rules:
   - Sort It Out: each card belongs in exactly one basket.
   - Line Up: no two steps are the same.
   - Match Up: the pairs are one to one.
   - Spot the Mistake: a mistake really differs from its fix.
   - Escape Room: the code is worked out where it can be.
   - The Lab: each target can be reached. Mentora finds the slider settings
     that reach it, and Show me plays them.
5. **No dead end:** a round that breaks its rules is written again. If it
   fails a second time, that idea becomes a Match Up, which fits any idea.
   A game is always built, in about a minute, with no code written.
6. The story is written as in §25: the character, the opening, a beat for
   each island, the ending.

After that, the teacher can:

- **Play it first.**
- **Edit any card, step, pair or *why*** in a form.
- **Change one island's template** ("make this a Line Up"). Only that island
  is rewritten, in seconds.
- **Share** with retakes and a leaderboard, as today.

### 26.5 What stays and what goes

- **Stays**:
  - From §25: the story comic, Learn it, What you discovered, the ending,
    the buddy, read-aloud, stars and points, the game bar, Play it first,
    the editor, sharing and the leaderboard, results.
  - The learning-kind pipeline and its checks.
- **Goes**:
  - The AI game writer (`learning/sim/`: writing, fixing, the robot
    playtest), the game frame and its runtime, `game_documents` (a
    migration drops it), Change it, and games' need for `ARTIFACT_MODEL`.
  - The two AI-coded demo games are rebuilt from templates.
  - The §25 work is committed first, so git history keeps it.

### 26.6 Phases

1. This plan.
2. **The map and the first three templates**:
   - The map hub, islands and fog, and the round host with its year bands.
   - Sort It Out, Line Up and Match Up.
   - Picking and filling templates, their checks, the Match Up fallback,
     and the editor forms.
   - Results with foggy islands and the moves most often wrong.
   - The AI game writer retired.
   - Four demo games: Year 2 water cycle, Year 3 fractions, Year 5
     photosynthesis, Form 4 acids and bases. Checked at four widths.
3. **The Lab and Spot the Mistake.**
4. **Detective Case and Escape Room.**
5. **Revision**: Boss Battle, Streak Ladder, and Tug-of-War on the class
   screen.
6. Docs, README, tests at each phase. Push and deploy on your word.

### 26.7 Known limits

- **Less surprise than an AI-coded game.** Every Sort It Out plays like a
  Sort It Out. The variety comes from seven templates, five worlds and the
  story.
- **The Lab's scenes are generic**: meters, emoji, sizes and a graph, not a
  bespoke animation for each topic.
- **Revision templates are question-and-answer by nature.**
- **Diagrams and conversations are out** (see 26.2).

**Built** (2026-10-09), committed locally, not pushed:

- **Phase 2** is done: the map, Sort It Out, Line Up and Match Up, the
  Match Up fallback, editors, slips in results, and the AI game writer
  retired.
- **The four demo games** all built on the first try, in 80–134 seconds
  (research, writing, checking, story): a Year 2 water cycle, Year 3
  fractions, Year 5 photosynthesis and Form 4 acids and bases.
- Two islands (one in photosynthesis, one in acids) failed the fact check
  and were dropped. The games were built with the rest.
- Phases 3–5 wait for your word.


### 26.8 Feedback on phase 2 (2026-10-09), built with phases 3–5

*"The start is always same, which is boring. Matching is not user friendly.
Where are the other type of games that we agreed on? Start should be unique."*

- **Every game starts its own way.** The story writer picks one of five
  openings to suit the story:
  - a comic (as now);
  - a **video call** from the character (it rings, you answer);
  - a **letter in a bottle** that washes up and unrolls;
  - a **news flash** with a headline and a ticker;
  - a **postcard** that flips over.

  The maker can change it. The map's stops also look like their world:
  islands on the reef, tree camps in the rainforest, houses in the kampung,
  stations in KL, planets in space.
- **Match Up, rebuilt.** Each left card has an empty slot beside it, and the
  answers wait in a tray. The child drags one into its slot, or taps one
  then the slot. A right one snaps in and turns green with its why; a wrong
  one bounces back.
- **The other templates** (phases 3–5), each the app's own code with its
  rules kept on the server:
  - **The Lab** (Year 3 up): 1–3 sliders drive a formula Mentora evaluates
    itself, never `eval`. The output is a meter with the target zone, a
    growing picture and, for Forms, a graph. Each goal is proven reachable
    on the server, and Show me slides to that answer.
  - **Spot the Mistake** (Year 4 up): a worked answer or paragraph, line by
    line. The child taps the wrong line, then picks its fix.
  - **Detective Case** (Year 5 up): clue cards (with small tables). The
    child picks who or what, then the clue that proves it.
  - **Escape Room** (Year 4 up): 2–4 locked doors, each opened by a code: a
    number on a keypad, a word from letter tiles, or a symbol.
  - **Boss Battle**: the last island of a game (from Year 3, or when
    picked). Each right answer hits the boss; a wrong one costs a heart and
    the question comes back later. On the class screen, the class shares
    the hearts.
  - **Streak Ladder** (any game, after it is played) and **Tug-of-War**
    (the teacher's class screen, two teams on one screen), using the
    game's pairs and boss questions. Practice only: nothing is kept yet.

**Built** (2026-10-09), committed locally, not pushed:

- All of 26.8 is built.
- More feedback, also built:
  - **How to play**: an animated demo with three steps for every template,
    on Learn it and behind the game bar's **?**.
  - **Games from the chat**: the chat can name templates, the chat has a
    game starter, the card says Play it and lists the templates inside, and
    a game opened from the chat leads back to it.
  - The chat's four make tiles are aligned.
  - The revision games are in a "Revise with your class" card beside the
    game, not in its header.
- **What the server now guarantees:** a Boss Battle at the end (made from
  the pairs when the writer left it out), a random opening, varied names,
  and no repeated ideas.


## 27. Langfuse: seeing every model call (approved 2026-10-13)

**Why:** when a game came back with no story, or a quiz dropped two
questions, we found out by reading logs line by line ("reply was not JSON",
"3 of 4 passed checks"). Langfuse records every model call:

- what was asked and what came back;
- how long it took and what it cost;
- which build or chat turn it belonged to.

It also lets us re-run a fixed set of cases whenever a prompt changes, so a
regression like "every character is called Amir" is caught before a teacher
sees it.

### 27.1 Decisions

> **Decided 2026-10-13:** local first (`make langfuse` on the developer's
> machine), then Langfuse Cloud's free plan for production. Not on
> `mentora-prod`: Langfuse 3+ needs ClickHouse, Redis and object storage,
> about 1.5–2 GB at rest on a 2 GB server, and an out-of-memory kill could
> take Mentora's own Postgres or API with it. Content: builds in full, chats
> and play as counts (`LANGFUSE_CONTENT=builds`); `all` locally.

1. **Where Langfuse runs.**
   - *Recommended:* on your own machine for development, and **Langfuse
     Cloud** (the free Hobby plan) for production.
   - Self-hosting it in production needs its own server: Langfuse 3 needs
     ClickHouse, Redis and object storage, more than the 2 GB `mentora-prod`
     can carry. That means about $20–40 a month more, against the $10 budget.
2. **What production sends.** *Recommended:*
   - the full text of **building** quizzes, guides and games, which is
     curriculum content;
   - only **counts and timings** for chats and play: no text from students,
     who are children, nor from teachers' chats, which can name them.

   One setting (`LANGFUSE_CONTENT=builds|all|none`) changes it later.

### 27.2 How it works

- **One wrapper, every call.** Every model call goes through one interface
  (`providers/base.py`, `LLMProvider`). `providers/traced.py` wraps any
  provider and records each call as a *generation*: the model, the messages
  (masked as 27.1 says), the reply, tokens, latency, finish reason and
  errors. It is applied where providers are built:
  - `providers/registry.py` (chat);
  - `learning/factory.py` (sets and games);
  - `artifacts/registry.py` (the studio);
  - the live-lesson providers in `api/deps.py`.
- **Traces in context.** `app/observability/` (logic only, no FastAPI)
  holds the current trace in a context variable. A trace is opened by:
  - a **chat turn** (`ChatService.stream_turn`): session = the
    conversation;
  - a **set or game build** (`LearningGenerator.run`): one span per stage —
    check, research, skills, write, verify, repair, finish — and the
    generations inside them named by stage;
  - a **live lesson**, a **story draft** and a **studio build**.

  The user is a pseudonym (a hash of their id) and their role; the release
  is the git commit, and the environment is dev or prod.
- **Events worth seeing**, recorded on the span where they happen:
  - a reply that was not JSON;
  - an item that failed the fact check, and why;
  - a round that fell back to Match Up;
  - an island dropped as a repeat;
  - a Boss Battle added from pairs;
  - a guard or safety-screen decision;
  - a refused topic.
- **Scores**, which tell us whether a build was good:
  - the items kept out of those asked for;
  - how many rounds fell back;
  - whether the build finished;
  - later, how much the teacher edited it, and Rewrite with AI.
- **Never breaks a turn** (rule 3 in CLAUDE.md):
  - with no keys, it does nothing;
  - the SDK sends in the background;
  - any error inside tracing is logged and swallowed.
- **Costs** stay where they are (`usage_source`, quotas); Langfuse shows
  them per feature and per model beside them.

### 27.3 Evals

- **A dataset of cases in Langfuse**, about 24 to start: topic × year ×
  kind, games weighted. For example "Fractions, Year 3", "Electricity,
  Form 3" and "The Melaka Sultanate, Form 2".
- **`make eval-games`** builds each case through the real pipeline and
  records a run with these measures:
  - built or not, and the time it took;
  - items kept;
  - the fallback rate;
  - the template mix;
  - a Boss Battle present;
  - repeats dropped;
  - openings and names varied;
  - cost.

  An optional model-as-judge score asks whether each island suits its
  year.
- Run it before and after a prompt change, and compare the runs side by
  side in Langfuse.
- A run spends model tokens: **capped by a setting**, and each run's cost
  is printed.

### 27.4 Configuration

- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`: none set
  means off.
- `LANGFUSE_CONTENT`: `builds` (the default), `all` or `none`.
- `LANGFUSE_SAMPLE_RATE`, for chat turns once traffic grows.
- For development, a `docker compose --profile observability` with Langfuse
  and its stores, on your machine only.

### 27.5 Phases

1. This plan, and your two decisions (27.1).
2. **Tracing**:
   - the wrapper, the trace context, chat turns and set and game builds,
     masking, and the local Langfuse;
   - tests with a fake client, including "Langfuse down — the turn still
     answers";
   - a feature doc (`docs/features/051-observability.md`).
3. **Events and scores** across the pipeline.
4. **Evals**: the dataset, `make eval-games`, the first baseline run.
5. **Production**: keys in the server's `.env`, deployed on your word.

### 27.5.1 Built (phase 2, 2026-10-13)

- `app/observability/` (Protocol, context, Langfuse adapter, registry) and
  `providers/traced.py`; every model client is built by
  `providers/registry.make_provider`, and each call says its `purpose`.
- Traces: `chat turn` (opened in `live_turns`, session = conversation) and
  `build <kind>` (opened in `GenerationService.events`, stages as steps,
  session = set). Calls outside both are traces of their own.
- One event already: "reply was not JSON", on the stage that got it.
- `docker-compose.langfuse.yml` (profile `langfuse`), `make langfuse`,
  `make langfuse-down`; Langfuse 4 server, SDK 4.17. Tests clear the keys.
- Feature doc `docs/features/051-observability.md`.

### 27.5.2 Built (phase 3, 2026-10-13): events and scores

- `note()` and `count()` (`observability/context.py`): an event on the step
  running now, counted in the trace's `tally`; words only where allowed.
- Build events: item rejected, duplicate, repeat, failed the check, dropped
  after repair, fell back to Match Up, story from the title, Boss Battle
  added, pictures or wrap failed, topic refused. Chat events from the turn's
  own event stream: guard fired, tool done or failed, answer withdrawn.
- Build scores (`services/build_trace.build_scores`): outcome, items_kept,
  passed_first_check, and for games fallback_rate and repeats_dropped.
- Teacher-edit scores are left for later: they need the editor to report.

### 27.6 Known limits

- **Chat stays text-free in production** (27.1): its traces show timing,
  tokens and errors, not words. So a bad chat answer is found from the
  conversation itself, not from Langfuse.
- **Langfuse Cloud keeps data outside Malaysia** (its EU or US region), for
  30 days on the free plan.
- **A streamed chat reply is recorded when it finishes**, not as it streams.
- **Speech and web search are not traced**: they are not language-model
  calls.
- **The image reader and the picture check** call vision models through
  their own clients. They come in phase 3, not with the first wrapper.

## 28. Mentora, wow: a learning friend children come back to (proposed 2026-10-13)

**Why:** an expert reviewed Mentora in detail. They loved the buddies, the
confetti and stars, the grounding, skill tracking, the parent view, teacher
onboarding, and above all the study guides with their three levels. They
asked for:
- emotes to unlock as rewards;
- voice storytelling, drag and spoken answers, not mostly quizzes;
- a reason to come back when no work is due;
- one tap from a parent's red skill to practice.

We take these as starting points and aim higher: Mentora should be the
learning friend a child **wants** to open every day, and the partner a
parent and teacher **trust**. Children learn by playing and speaking, at
their level, a few minutes every day.

Out of scope here: pictures in live lessons, a Malaysian curriculum
catalogue, and Cikgu ILMU (separate decisions).

### 28.1 What must not break

What the expert loved stays as it is, and every phase is checked against it:
- the buddy in the corner who comments while the child works;
- confetti, three stars and badges;
- "grounded in" on every set;
- skills carried into quizzes, flashcards and results;
- the parent's at-a-glance progress;
- the first-time teacher screen;
- study guides with Simpler, Just right and Challenge.

### 28.2 Principles

1. **Learning is the engine of every reward.** A buddy grows, a move is
   unlocked, a streak goes on because the child learned something. Never
   because of time spent, and never for money.
2. **Never shame, never guilt.**
   - A buddy never gets sick, sad or smaller when a child is away; it says
     it missed them.
   - No child is shown at the bottom of a ranking: competition is between
     teams, or the whole class against a boss.
3. **A daily goal, then done.** Five good minutes, then "done for today"
   and a teaser for tomorrow. No endless feed.
4. **Voice first for the youngest.** A Year 1 child who cannot read yet can
   play everything by listening and tapping.
5. **Alive, but calm on request.** Every change on screen moves with
   meaning, with sound where it helps. Reduced motion is always respected.
   Existing animations are kept (except 28.3.1's decision).
6. **Fast on a cheap phone.** A mid-range Android phone on 4G is the
   reference device (28.4).
7. **Every AI word grounded, checked and watched.** Cost and quality of
   each new feature are visible in Langfuse (§27) before it ships.

### 28.3 The features

#### 28.3.1 A buddy that grows with you

**What the child sees:** their buddy arrives as a **tiny baby animal**:
- a kancil fawn, a kitten, an owlet, a baby orangutan or a tiger cub;
- big head, sleepy eyes, wobbly legs.

It grows as the child learns, in four stages:

| Stage | Looks | Moves it can show off |
|---|---|---|
| **0. Newborn** | tiny, wobbly, sleepy | blink, yawn, wiggle, nap |
| **1. Little one** | steadier, curious | + wave, hop, happy |
| **2. Young** | bouncy, confident | + cheer, dance, stretch, bounce |
| **3. Grown** | proud, full of energy | + tricks and its **signature move** |

Signature moves: each buddy's **own trick**, already drawn and loved, is
what growing up earns last: Kiko's backflip, Tompok's tail chase, Ollie's
flutter, Momo's leaf umbrella, Rimau's roar. (Changed while building: new
signature moves can come later; the existing tricks are the reward now.)

**Growing up is a celebration.** A full-screen moment shows:
- the buddy glowing, stretching and growing, with sound and sparkles;
- the reason: "Momo grew up! You mastered 3 skills this week.";
- the new move, played once.

The buddy page shows **a growth bar** and **a move collection**. Locked
moves are silhouettes, each with how to unlock it.

**What makes it grow** (points, tuned in one place):

| Learning moment | Growth |
|---|---|
| Finish a quiz, deck, study guide or game | +2 |
| Three stars | +2 |
| A badge | +3 |
| Daily Quest done (28.3.4) | +3 |
| A day of the streak | +1 |
| Right on a second chance (28.3.7) | +1 |
| A skill mastered (≥80% across 3 sets, as the Skill Master badge) | +10 |

**Stage thresholds:**
- stage 1 at 10 points: the first day of work;
- stage 2 at 60 points: about three weeks of regular use;
- stage 3 at 200 points: about a term.

**Rules:**
- **Decided (2026-10-13): every student starts at stage 0, existing
  accounts too.**
  - On first sign-in after release, an *arrival* scene introduces the baby
    buddy: "Momo is tiny! Learn with Momo and watch it grow."
  - Stage 1 comes within the first day's work, so the reset is felt as a
    fresh start, not a loss.
- **Growth belongs to the child, not the animal.** Switching buddy keeps the
  stage and moves.
- **New buddy friends are earned (decided 2026-10-13).**
  - The first buddy is free, and free to change until anything is learned.
  - Then one new buddy for every 3 badges (2nd at 3, then 6, 9, 12), with
    the child picking who to meet. Buddies met are free to switch between.
  - Unmet buddies are silhouettes with "3 more badges"; the server enforces
    it.
  - The point: a reason to come back and do the work.
- **It never shrinks.** Points are never taken away.
- **Function before show.** The reactions that help a child learn stay at
  every stage: thinking while they answer, *oops* on a wrong answer, *cheer*
  on a right one. Only the show-off moves and dances are earned. This
  narrows "keep animations" for antics only, by decision.
- **Students only.** Teachers and parents see grown buddies.
- **Parents see it:** "Momo is a young orangutan now: 12 skills mastered."

**How it works:**
- **A growth ledger.**
  - Table `buddy_growth (student_id, source, source_id, points, created_at)`,
    unique on `(source, source_id)`, so a retake or a replayed event never
    counts twice.
  - The stage is computed from the sum.
- **Fed by domain-event reactions** (`events/registry.py`): attempt
  completed, badge awarded, skill mastered, quest done. Each reaction is a
  new file plus one registry line.
- **API.** `GET /me/buddy` returns:
  - stage, points, and the next stage's threshold;
  - unlocked moves;
  - unseen unlocks.

  `POST /me/buddy/seen` marks the unlocks celebrated.
- **Rigs take a `stage`.**
  - Each rig (`buddies/rigs/*`) sets its proportions per stage: head-to-body
    ratio, limb length, eye size, fluff, stripes or feathers.
  - Choreography gates the show-off moves by stage.
  - No new drawings per stage, just parameters, so the art stays one rig
    per animal.
- **Celebrations go in a queue** (28.4), so a growth scene never interrupts
  a question.

#### 28.3.2 Every game told aloud

**What the child sees:** a game's story opens like an audiobook in the
tutor's warm voice. Each of the five openings is performed its own way:
- the **phone call** rings, then a voice answers;
- the **letter** is read by its writer;
- the **news** sounds like a newsreader;
- the **postcard** sounds like a friend on holiday;
- the **comic** has a narrator between panels.

The rest of the game:
- The buddy says the hints.
- Each island's idea and task are spoken as they appear.
- **Words light up as they are spoken** (karaoke captions), so listening
  also teaches reading.
- It plays by itself after the first tap, with one-tap mute. The choice is
  remembered per device.
- It is on for every year, with Year 1–3 relying on it most.

**How it works:**
- Narration is the existing read-aloud by reference (`services/read_aloud`,
  tutor voice), now with a **sequence player**.
- Clips are **recorded once when the game is built**, in the background,
  and cached (`live/audio` cache). Playing costs nothing, and the first
  player hears it at once.
- Word timing is estimated per clip, the way live lessons already time
  captions (`live/timing`).
- Browsers allow sound only after a tap. The story's "Start" button is that
  tap.

**Decision proposed:**
- Name the **buddy**, never the child, in narration. Then a clip is shared
  by every child with that buddy, and no child's name goes to the speech
  provider.
- Narration is in the game's own language.

#### 28.3.2.1 Built (phase 2, 2026-10-14)

Built as a mission, at the user's word: dramatic, not loud.

- A mission briefing, whose tap lets sound play.
- A quiet synthesised music bed that ducks under the voice and rests during
  rounds, and a sting per opening and moment.
- "Accept the mission" with a stamp, and "Your mission:" on the goal.
- Every card told aloud as it appears, words lighting up as they are said
  (`mission/narration.tsx`, `wordTimings`).
- One remembered sound switch.
- Narration recorded when a game is built (`services/narration_warmup.py`,
  through `GenerationService(on_built=…)`), with a narrator shared per
  process.
- Doc: `docs/features/053-mission-narration.md`.

#### 28.3.3 Help at home (parents) and practice for these students (teachers)

**What a parent sees:** tapping a red skill on their child's page opens
*Help at home*, with three things:
1. **What it means:** the skill in plain words for the parent, in English or
   Malay, with one example.
2. **A five-minute activity, no screen:** something to do at the kitchen
   table with things at home ("Cut a roti canai into quarters…").
3. **Send a challenge:**
   - a short practice set on exactly that skill, at the child's year;
   - the child's buddy delivers it: "Ibu sent you a challenge! 💪";
   - when the child finishes, the parent is told how it went.

Parents can also send **cheers**: a sticker and a short preset line ("So
proud of you!"). The buddy acts it out on the child's screen. Preset only,
so there is nothing to moderate.

**What a teacher sees:** on the class skill heatmap, a red skill offers
**"Practice for these 6 students"**. One tap makes the set and shares it with
exactly those students, as a group.

**How it works:**
- The explainer and the activity are written once per (skill, year,
  language) and cached. They are short, checked like any generation, and
  traced.
- The challenge is an ordinary family set (`SendHomeDialog` path,
  `PARENT_SETS_PER_DAY`) with the skill given (`GenerationRequest.skills`).
- The parent link to practice is switched on (`OverviewTab.tsx`,
  `practiseLink`).
- Cheers are a new notification kind that the buddy companion plays.

#### 28.3.3.1 Built (phase 3, 2026-10-14)

- Help at home, from each "Worth practising" skill on the parent's child
  page:
  - meaning, example and a five-minute activity, EN or MS
    (`SkillHelpService`, kept in `skill_help`);
  - Send a challenge (`skill_practice.py`), built after the request and sent
    home when made.
- Cheers: preset, a `cheer` notification the child's buddy announces.
- Practice for N under each red skill on an assignment's heatmap:
  - one group per skill ("Practise: X");
  - the quiz from the assignment's sources, shared with that group when
    made.
- Doc: `docs/features/054-help-at-home.md`.

#### 28.3.4 Daily Quest and the skill garden

**What the child sees:**
- **Today's Quest**, every day, about five minutes:
  - 2 **review** questions on skills starting to fade;
  - 1 **new** challenge a little above their level;
  - 1 **game round** from a template.
- Done means **"Done for today!"**: confetti, growth points, and a peek at
  tomorrow.
- **The skill garden:**
  - Every skill the child has met is a plant that grows with mastery.
  - A plant *droops* (never dies) when it is due for review, and a review
    waters it.
  - It shows the forgetting curve without saying the words.
- **The streak** counts days with a quest or any finished work.
  - Every 7 days earns a **streak freeze** (hold up to 2). A freeze covers a
    missed day by itself: a flu day doesn't wipe a month.
- **The weekly class quest:** the class's quests add up to one goal ("150
  quests this week!"). Reaching it throws a **buddy party** on the class
  screen, with every child's buddy dancing together. Nobody is ranked.

**How it works:**
- **Questions come from what already exists.** The quest uses items from
  sets the child can see and their class's sets, on the skill chosen.
  Generation runs only when there are not enough items, small and capped
  per day, like `auto_practice`.
- **Spaced review per skill:**
  - Each (student, skill) gets a strength and a due date, updated after
    every answer on that skill: right pushes the due date out, wrong pulls
    it in, Leitner-style.
  - The garden draws these.
- **Days are Malaysian days.** Today's streak counts UTC days, so "today"
  starts at 8 am in Malaysia. Quests and streaks use `DEFAULT_TIMEZONE` /
  the browser's zone (fix included).
- **The buddy announces the quest.**
  - It is in-app today.
  - Phone notifications for parents (PWA push) can come later.

#### 28.3.4.1 Built (phase 4, 2026-10-14)

- **My day** at the top of the student home:
  - Today's Quest: 5 questions from work the student can see, review first;
    a practice set, played in the quiz player;
  - a streak in the school's day with freezes;
  - the skill garden (Leitner boxes in `skill_memory`);
  - the class quest, ending in a once-a-week buddy party.
- Every finished attempt moves its skills through their boxes. A quest done
  grows the buddy (+3).
- Not yet: a game round in the quest, and generated questions for students
  with too few. See `docs/features/055-daily-quest.md`.

#### 28.3.5 Play with hands and voice

- **Drag everywhere.**
  - Sort It Out and Match Up already drag. Line Up gets drag-to-reorder,
    and Detective Case lets a clue be dragged onto a suspect.
  - Every drop snaps magnetically, with a sound and a short vibration on
    Android.
  - Tap-to-place stays everywhere, for accessibility.
- **Say it** (new template, Year 1–3, English and Malay):
  - The child reads a word or a sentence aloud, and each word lights green
    as it is heard.
  - A word missed gets a gentle "Listen, then try: *pe-ta-ni*", played in
    the tutor's voice.
  - It uses the existing speech-to-text (`build_transcriber`), with
    accent-tolerant matching.
  - Audio is not kept; only what was heard is stored, on the attempt.
- **Explain why** (Form 1–5):
  - After a right answer, sometimes: "Tell me why." The child speaks or
    types.
  - A model judges the **reasoning** against the item's own explanation,
    and gives one line of feedback.
  - The child's words pass the student safety gate first.
  - Capped per day and traced.

#### 28.3.6 Class Battle

The expert's favourite mechanic becomes live play on the class screen:
- **Tug-of-War, live:**
  - The teacher opens the battle on the projector. Students join on their
    own devices (signed in, in the class) and answer there.
  - Each team's right answers pull the rope on the big screen.
- **Class vs Boss (co-op):**
  - The whole class fights one Boss Battle together. Every right answer from
    anyone is a hit.
  - Nobody can let the team down alone. Best for mixed abilities.
- **At the end**, both teams are celebrated, with "team spirit" stats: most
  comebacks, most improved. No individual ranking.

**How it works:**
- The battle is a short-lived room, like a live lesson's.
- Answers are POSTed, and the projector follows the room by SSE.
- Questions come from the game's pairs and boss questions (`questionsOf`),
  or from a quiz.
- The single-screen Tug-of-War stays, for classes without devices.

#### 28.3.7 Second chance, at your level

**What the child sees** on a wrong answer:
- The buddy says "Let's look at it together", gently.
- The explanation, at the child's level, with a worked example:
  - Simpler, Just right or Challenge, the study guide's levels, now
    everywhere;
  - the default comes from the year, and the child can switch.
- **"Try one like it":** a question on the same skill.
- Right on the second try: the buddy cheers, it counts as a comeback (the
  Comeback and Never Give Up badges exist), and the buddy grows (+1).

**How it works:**
- **Levelled explanations** are written on demand, the first time a child
  asks, then **cached on the item**: one model call per item and level,
  ever.
- **"One like it"** is chosen from the same set or the bank on that skill.
  It is generated only if there is none, and capped.
- Applies to quizzes and the Daily Quest. Teachers' assessments can switch
  it off per assignment ("test mode").

#### 28.3.8 Learn → Practise → Play

The study guide, the expert's favourite, becomes the spine:
- Each part of a guide ends with a **one-minute game round**, built without
  extra model calls:
  - a Match Up from the part's words to know;
  - a Line Up from a process it describes;
  - then the part's check.
- A **trail** runs through the guide's parts, with the buddy walking along
  it and parts lighting up as they are finished.
- Finishing the guide unlocks **its Boss Battle**, made from the guide's own
  pairs (`game_finish`), and a short quiz. One guide becomes a whole
  learning journey.

#### 28.3.1.1 Built (phase 1, 2026-10-14)

- Server:
  - `app/growth/rules.py`;
  - `services/growth_service.py`;
  - `buddy_growth` (ledger) and `buddy_progress` (seen, arrived, met), in
    migration `2e03671504cc`;
  - reactions to `AttemptCompleted` and `BadgeAwarded`;
  - `GET /api/me/growth` and `POST /api/me/growth/seen`;
  - the buddy choice enforced on `PATCH /api/auth/me`;
  - the child's stage and growth for parents.
- Client:
  - `growth.ts` and `look.ts`; the stage in every rig (body, `Head`, eyes,
    wobble);
  - `GrowthProvider`, and the arrival and grow-up scenes;
  - `GrowthBar` and `GrowthGain` on the finish screen;
  - the buddy page: stages, how it grows, the move collection, buddy
    friends;
  - babies on the welcome screen;
  - the parent's child page.
- Wow groundwork (28.4): `CelebrationProvider` (a queue, held mid-task),
  `Scene`, sounds `grow` and `unlock`, `lib/haptics.ts`.
- Doc: `docs/features/052-growing-buddy.md`.

### 28.4 The wow layer (every screen)

- **One motion language.**
  - The spring tokens in `@/motion` are used for every state change.
  - Shared-element transitions: a card grows into its full page.
  - Lists stagger in, and the buddy reacts to everything.
- **Celebrations in three sizes, from one queue:**
  - small: a sparkle and a tick;
  - medium: confetti and stars;
  - big: a full-screen scene (growth, streak milestones, class party).

  The queue never interrupts a question, and plays at the next pause.
- **Sound design:**
  - One small set: tap, right, a soft "not quite", unlock, grow, streak.
  - Plus the buddies' existing voices (`buddies/sounds`).
  - On by default for students, off for teachers and parents, with one
    volume setting.
- **Haptics:** short vibrations on Android for a right answer, a drop that
  snaps, and unlocks.
- **A student home called "My day":**
  - the buddy, big and alive, in its den;
  - Today's Quest;
  - the streak flame;
  - a peek at the garden;
  - work due.
- **Budgets on the reference phone** (mid-range Android, 4G):
  - first screen under 2.5 s;
  - animations at 60 fps;
  - rigs, rounds and audio loaded lazily and prefetched one step ahead.
- **Accessibility:**
  - reduced motion respected everywhere;
  - captions on every voice;
  - tap alternatives to every drag;
  - text sizes (exist) and AA contrast.
- **Checked like every UI change:** at 1440, 1024, 768 and 390 px, with no
  cut or overlapping text, in both themes.

### 28.5 Knowing it works

- **AI cost and quality**, in Langfuse (§27): narration clips recorded,
  explanations written, quests generated, Explain-why judged. Each is traced
  with a cost per day.
- **Learning and habit:**
  - a small `product_events` table, and an admin card with: children
    returning the next day and the next week, quests done, streak lengths,
    time to stage 1, second-chance success, Help-at-home use;
  - no third-party analytics: children.

### 28.6 Phases

Each phase ships with:
- tests;
- a feature document;
- the 4-width audit and screenshots;
- a Langfuse cost check;
- deployment on your word.

1. **The wow groundwork and the growing buddy**: celebration queue, sounds,
   haptics, rig stages, growth ledger, arrival scene, move collection.
2. **Every game told aloud**: pre-recorded narration, karaoke captions,
   auto-play and mute.
3. **Help at home and practice for these students.**
4. **Daily Quest, skill garden, Malaysian-day streak and freezes, weekly
   class quest.**
5. **Second chance at your level.**
6. **Learn → Practise → Play** in study guides.
7. **Hands and voice**: drag everywhere, Say it, Explain why. Phase 7
   starts with a spike: does the speech-to-text hear children, in Malay
   and English, well enough?
8. **Class Battle**: live Tug-of-War and Class vs Boss.

### 28.7 Decisions

- **Made (2026-10-13):** every student's buddy starts at stage 0, existing
  accounts included (28.3.1).
- **Made (2026-10-13):** new buddies are earned with badges, one per 3
  (28.3.1).
- **Proposed:**
  - Narration names the buddy, not the child (28.3.2).
  - Parents' cheers are preset, not free text (28.3.3).
  - Explain why: at most 5 a day per student (28.3.5).
  - Second chance is on by default, with "test mode" per assignment
    (28.3.7).

### 28.8 Known limits and risks

- **Resetting buddies may disappoint** some children who liked a grown
  buddy. The arrival scene and a fast first stage are the answer; watch
  for complaints in the first week.
- **Narration costs speech** for every game built. It is recorded once and
  cached, but a busy week of games is a real speech bill: watch it.
- **Speech-to-text and children's voices** are untested, in Malay above
  all. Say it waits on the phase 7 spike.
- **Class Battle needs a device per student.** Without them it falls back to
  the single-screen Tug-of-War.
- **Spaced review needs answers to work from.** A new student's first
  quests lean on "new" questions until their skills have history.
- **Browsers play sound only after a tap.** Every voice starts from a
  button the child pressed.
- **The app's own words are in English.** Content is in the set's
  language. A Malay interface is a separate project.
