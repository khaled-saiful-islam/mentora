# 034 — Study guides

## What it does

A teacher makes a **study guide**: a topic taught part by part, from real
sources, with pictures, shared with a class or a group like any quiz.

Each part has:

- **The teaching at three reading levels** — *Simpler*, *Just right* and
  *Challenge*. The same ideas each time; only the words change, so a whole
  class reads the same lesson at a pace that fits each child. The level a
  student picks is remembered on their device.
- **A picture** from a SafeSearch image search, credited to its page. The
  teacher can swap it for one of the others the search found, or take it out.
- **Words to know**, dotted in the text. Tapping one shows its meaning and the
  word in Bahasa Melayu (or in English, for a guide written in Malay).
- **Remember** (key points), **Remember it like this** (a memory trick),
  **In real life** (a Malaysian example) and **Did you know?** (a surprising
  fact the student's buddy reacts to).
- **Read it to me** — the browser reads the part aloud and the sentence being
  spoken lights up.
- **Check yourself** — one multiple-choice question, graded like a quiz
  question, with the reason shown after.

Around the parts:

- **A cover** — a big question to read on for, an introduction, the pictures
  pinned like polaroids, and an **animated concept map**: the topic in the
  middle, the parts round it, the words to know beyond. A part on the map can
  be tapped to jump to it.
- **An ending** — the big ideas, every word to know as a card that flips, and
  a safe **Try this!** activity.

For teachers:

- **Generate** from the maker (Home → *Make a study guide*, or the chat's
  *Make something to learn*). It takes about a minute and is watched live.
- **Edit** every part: heading, the three levels, the helpers, the picture,
  the check; and the cover and ending.
- **Update with AI** — the wand on a part rewrites it ("make it simpler",
  "add a Malaysian example"), keeping the picture the teacher chose; and
  **Write it with AI** adds a new part on request ("a part about rainbows"),
  with its own picture. Both are shown for review and saved only when the
  teacher saves. *Write it with AI* works for quizzes and flashcards too.
- **Preview** as students will see it, and **Print handout**: every part on
  its own page, the checks as questions, and an answer key at the end.
- **Results** — a guide is played like a quiz, so its checks give progress
  live, per-student results, per-skill strengths and the finish screen.
  There is no leaderboard for a guide. Finishing with every check right earns
  the **Bookworm** badge.

Students cannot make study guides — their practice is quizzes and
flashcards. The server refuses it, and the maker never offers it.

## How it works

A study guide is a **learning kind** (`app/learning/study_guide.py`,
registered in `learning/registry.py`). Its items are sections. Each section
carries its check at the top level — `prompt`, `options`, `answer`,
`explanation` — so the attempt, results and live-progress code treat it
exactly as a quiz question: options are shuffled per student, answers are
graded by `grade()`, and `public()` hides the answer until it is given.

Generation is the same pipeline as every kind, plus a stage:

```
check → research → skills → write ⟲ verify ⟲ repair → finish → built
```

- The kind declares `batch = 2`, `draft_tokens` and `item_tokens`: a section
  is long, so two are written per call.
- **finish** runs only for a kind that is `Enriching`
  (`app/learning/enrich.py`) — found by shape, never by name. It runs two
  things side by side: `illustrate` (a picture search per section, through
  `Researcher.pictures`: SafeSearch on, blocked hosts dropped, https only,
  spares kept as `alternatives`) and `wrap` (one model call for the big
  question, introduction, summary and challenge). Either may fail; the guide
  is still made, and the log says which half is missing.
- Pictures arrive in the live panel as a `pictures` event after the sections.
- The opening and ending are stored in **`learning_set_versions.extras`**
  (JSONB, `'{}'` for every other kind), versioned with the items: editing a
  shared guide forks a new version and the class keeps the one it was given.
  `SetDetail.extras` and `AttemptResponse.extras` carry them.
- `POST /api/learning-sets/{id}/items` `{instruction}` writes one more item
  for any kind (`LearningGenerator.add`), illustrated if the kind illustrates.
  It is rate-limited with generation and its tokens count toward the quota.
- A rewrite keeps the fields a kind lists in `kept_on_rewrite` — for a guide,
  the picture and its spares.

In the browser, the reader is `features/play/GuidePlayer.tsx`, built from
`features/guide/`: `GuideCover`, `ConceptMapView` (layout in `map.ts`),
`SectionBody`, `TermText` (marking in `text.ts`), `CheckCard`, `GuideEnd`,
`PictureFrame`, `LevelSwitch` and `useReadAloud` (the Web Speech API — no
service, no key). The editor is `features/learning/editors/studyGuide.tsx`;
the preview and handout page is `features/guide/GuidePreviewPage.tsx` at
`/library/:id/preview`.

## Configuration

Nothing of its own. It uses the learning model (`LEARNING_*`), web and image
search (`SERPAPI_KEY`), and the generation rate limit. Without a search key a
guide is still written, ungrounded and without pictures, and says so.

## Extending it

- **Another kind with a finishing stage**: implement `illustrate`, `wrap` and
  `normalise_extras` (`Enriching`) and the generator runs it.
- **Another helper on a section** (say, a worked example): add it to the
  section rules in `prompts.guide_section_rules`, to `normalise` in
  `study_guide.py`, to `GuideSection` in `features/learning/api.ts`, to the
  editor's *Helpers* tab and to `SectionBody`.
- **Another reading level**: add it to `LEVELS` on both sides and to
  `LEVEL_LOOKS`; the prompt must ask for it.

## Known limits

- **Pictures are hot-linked**, not copied. A site that later removes or
  blocks an image breaks it; the frame falls back to the search's own small
  copy, then steps aside rather than show a broken image. Copying images would
  need object storage and a licence check this project has neither of.
- **Picture relevance is the search's.** SafeSearch and the blocked-host list
  apply, but a search can still return a poor match; that is why the teacher
  sees the spares and can swap or remove.
- **Read aloud depends on the device's voices.** A browser without a Malay
  voice reads a Malay guide with its default one. The button is hidden where
  speech synthesis does not exist.
- **The concept map is laid out, not understood**: parts round the centre,
  two words each. It does not draw links between parts.
- **Reading level is not reported to teachers**, on purpose — see
  `features/guide/level.ts`.
- **Printing uses the browser's print**, so page breaks and margins follow
  the browser's print settings.
