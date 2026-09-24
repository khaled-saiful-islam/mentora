# Mentora — Implementation Plan

> **Status: APPROVED 2026-09-24 — Phase 1 done; Phase 2 waiting for your go.**
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
- **Text size control**: four steps, A− / A / A+ / A++ = 100 / 115 / 130 / 150%. It sits in the **artifact panel** and the players, and drives the CSS variable `--text-scale`. Students default to **A+** and teachers to **A**. It's saved in `users.preferences` so it follows the user across devices.
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

**Approved 2026-09-24.** Phase 1 done (fork, News removed, renamed, pushed).
