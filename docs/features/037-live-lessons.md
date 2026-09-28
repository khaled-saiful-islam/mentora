# 037 — Live lessons: setup, the lesson plan, and the schedule

## What it does

**Teachers** (*Live lessons* in the menu, `/live`):

1. **New live lesson** (`/live/new`) is four steps:
   - **Who:** a class, then the whole class or one of its groups.
   - **What:** subject, topic and school level, then the parts in teaching order. *Suggest parts* asks the model; the teacher edits, reorders, adds or removes them.
   - **How:** approach (storytelling, step by step, question-led, lots of examples, exam-focused), level, length (10–45 min), an optional instruction, how questions are taken (any time or at pauses, and how many per student), and Astra's voice (the warm or the bright female voice).
   - **After:** the quiz afterwards (on/off, number of questions, level, due date), and *save as a template*. Templates appear on the first step next time.
2. **The lesson's page** (`/live/:id`):
   - Add materials: PDF, Word, **PowerPoint** or text, at most 5. They are read into text. *From my materials* attaches a file already kept in the Library without uploading it again ([`043-my-materials.md`](043-my-materials.md)).
   - *Write the lesson*: parts appear as they are written.
   - Check every part: *Listen* plays it in the recorded voice, exactly as the group will hear it. *Edit* changes it by hand; *Rewrite* asks for a change in words.
   - *Approve & record the voice*: every sentence, plus Astra's lines to each student by name, is recorded once, with a progress bar.
   - *Put it on the schedule* or *Start now*, *Move it*, or *Cancel the lesson*.

**How Astra opens and closes** (`plan_prompts.part_user`):
- **The first part** opens like a kind teacher's first minute. She greets the
  group, introduces herself (*"I'm Astra, and I'll be teaching you today"*),
  says what they will learn, naming the parts, and invites questions: press
  *Ask Astra* at any time, and she answers at the next pause. Then the story
  or question that draws them in.
- **The last part** closes warmly after its check. She thanks the group,
  recaps the lesson in two or three points and praises their effort. When
  the lesson has a quiz, she tells them there's a short one waiting, that it
  helps them remember, and to give it their best. Then a cheerful goodbye.

**Students** (*Schedule* in the menu):
- The next lesson is an **Up next** card on Home, with a live countdown. Ten minutes before the start its button becomes a glowing *Join the lesson*.
- **My schedule** (`/schedule`) lists lessons by day, then past ones.
- Each lesson's page (`/room/:id`) has a countdown to the start.
- **Notifications:** new on the schedule, moved, cancelled. Everything updates live through the `live` push topic.

## How it works

- **Tables:** `live_sessions` (settings are a frozen JSONB copy), `live_session_documents`, `live_segments` (beats as JSON) and `live_session_templates`. Migration `3537259a196c`.
- **`live/settings.py`:** the settings, validated once. `segments_per_part()` shares the length out as ~90-second segments. Each approach is a small strategy with its own writing rules.
- **`live/planner.py`:**
  - Checks the topic, using the learning generator's own topic check.
  - Documents first: excerpts per part become sources `D1…`. The web is searched only when the files are thin (`W1…`).
  - Parts are written three at a time and handed on in order.
  - Each part is checked twice: the speakability rules from 036, plus a model check of the facts against its sources and of the check-in answer. It gets one repair.
  - The last segment of each part ends with a multiple-choice check.
- **`services/live_plan_service.py`:** planning and recording run as jobs (`services/jobs.py`), followed on `GET /live-sessions/:id/work/stream`. Each part is saved as it is written. Recording uses `Narrator`, so the preview and the live lesson use the same cached clips. A student's lines are chosen deterministically, per session and name.
- **`services/live_session_service.py`:**
  - Ownership is a lookup parameter (`owned`, `visible`).
  - The audience is always worked out *now*: approved class members, those in
    the group when the lesson is for one (`group_id`), all of them when it is
    for the whole class (`group_id` null, shown as *Whole class*). The quiz
    after it is shared the same way.
  - Scheduling publishes `LiveSessionScheduled`; cancelling publishes `LiveSessionCancelled`. Subscribers write the notifications and push the `live` topic.

## API

**Teachers** (`run_live_sessions`):
- `/live-sessions`: list, create, get, patch, delete
- `/live-sessions/breakdown`
- `/:id/documents`
- `/:id/plan` and `/:id/approve`: jobs, returning 202
- `/:id/work/stream`
- `/:id/segments/:sid` (PATCH) and `/:id/segments/:sid/rewrite`
- `/:id/schedule` with `{at | null}`, and `/:id/cancel`
- `/live-templates`: CRUD

**Students** (`join_live_sessions`):
- `/me/live-sessions`
- `/me/live-sessions/:id`

## Pictures

None. A lesson is spoken, with a key point or worked example on the screen
for each beat. Pictures are for study guides only, where each one is looked
at before it is kept (`JudgedPictures`, at the guide's higher bar of 8/10).

## Known limits

- **Students see a lesson only once it is scheduled**, and scheduling needs an approved (recorded) lesson. A draft is the teacher's alone.
- **Editing a part after approval sends the lesson back to review**, and it must be approved again. Unchanged sentences are already cached, so re-recording is quick.
- **Tokens spent writing a lesson are not counted in the teacher's daily quota yet.** Writing is rate-limited with `RATE_LIMIT_GENERATE_PER_MINUTE`.
- **A slide deck's pictures are not read**, only its text and speaker notes.
- **Only one lesson can be written at a time per session.** A second *Write* joins the one already running.
