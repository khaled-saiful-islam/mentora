# 058 — Play with hands and voice (§28.3.5, phase 7)

Three ways to play beyond tapping: drag pieces where they go, read words
aloud, and explain an answer in your own words.

## The spike: can the ear hear?

Before building, short phrases were synthesized in the tutor's voice and
sent to the speech-to-text (`ilmu-asr-v4.2`), in English and Malay, at two
speeds, with and without a language hint:

- Every sentence came back word for word, in both languages, with or
  without the hint.
- A single Malay word, "rama-rama", came back as "ramo ramo".

So **Say It reads whole short lines, and matching forgives vowel slips**.
**A child's own voice has not been tried:** that is the next check, by a
person with a child (see Known limits).

## Drag everywhere

- **Match Up** and **Sort It Out** already dragged. **Line Up** now drags a
  step onto the line, and **Detective Case** drags a clue onto who it points
  to, once the culprit is named.
- **A magnet:** while a piece is dragged, the target under it lights up and
  grows a little. A drop lands with a knock (`snap`) and, on Android, a short
  buzz (with sound on).
- Tapping a piece and then its place still works everywhere.
- A dragged answer in Match Up no longer disappears behind the edge of its
  tray.

All of it is in `features/game/rounds/drag.ts` (`targetAt`, `useMagnet`,
`MAGNET`).

## Say It (Year 1–3, English and Malay)

- **A new game template.** A line of 1 to 8 words appears big, with its
  emoji. **Listen** plays it in the tutor's voice. Tap the microphone, read
  it, tap again: each word heard turns green, one after another.
- **A word missed** turns dashed coral. The buddy says "Listen, then try:
  me-na-nam" (Malay is split exactly by its syllables, English roughly), and
  the tutor's voice says the word. After three tries the round moves on.
- **No microphone, or not allowed:** the child taps each word as they say
  it, so the round can always be played.
- **The writer:** asked for `say` islands for Year 1–3 only: 2 to 4 lines,
  at most 8 words, no digits. A Say It made for an older year or another
  language is played as its Match Up (every island has pairs), so a game
  always builds.
- **Teachers** can pick Say It when making a game, edit its lines in the
  game editor, and preview it. The preview hears through `/voice/transcribe`
  and keeps nothing.

**How it hears** (`POST /api/me/attempts/{id}/items/{item}/hear`, a clip
and a line number):
- The clip is transcribed in the set's language (`language` is now passed
  to the transcriber) and dropped.
- Only the words heard are kept, on the attempt (`plan.heard`), the last try
  of each line.
- Matching is in the browser (`rounds/say.ts`): case and accent marks
  ignored; a short word within one letter (same first letter); a longer one
  within a third of its letters, or the same consonants with vowels slipped;
  a word heard as two halves; up to two words skipped, in order.
- One word in the tutor's voice: a new read-aloud part, `word` (counted
  across the lines), so the voice says only words of the round.

## Explain why (Form 1–5)

- After **every third right answer from the second** in a quiz with a second
  chance (not a teacher's test), **Tell me why** appears beside Next.
- The student says it (the mic) or types it, and taps **Check my thinking**.
  They get "Spot on!", "Nearly there!" or "Not quite yet", and one line on
  what is right and the one idea to add.
- **Safety:** their words pass the student safety screens first. Words held
  back never reach the model; they are logged for a person (a `held` or
  `support` moderation event) and answered "Let's keep to the question".
- **At most 5 a day** (`EXPLAIN_WHY_PER_DAY`), in the school's day, and one
  per question in an attempt: asked again, the same verdict
  (`why_given`, migration `8d2f61a0b4c3`).
- A model that will not answer gets a kind line, which is not counted.
- Traced as the stage `explain why: judge`.

Endpoints: `GET /api/me/why` (how many are left today: 0 outside Form 1–5)
and `POST /api/me/attempts/{id}/items/{item}/why` (`{words}`).

## Configuration

- `EXPLAIN_WHY_PER_DAY` (5) and `RATE_LIMIT_EXPLAIN_WHY_PER_MINUTE` (6).
- Say It uses the transcription limit (`RATE_LIMIT_TRANSCRIBE_PER_MINUTE`).

## Known limits

- **Children's voices are untested.** The spike used a synthesized adult
  voice. Before Say It reaches classes, try it with a Year 1–3 child in each
  language.
- **The words on the buttons are in English**, as everywhere in the app;
  the lines themselves are in the game's language.
- **A recording that can't be read gives no message:** the mic just goes
  back to waiting. This is shared with every voice box (`useRecorder`).
- **Say It doesn't show in results yet:** what was heard is kept, but a
  teacher's results show only the island cleared or not.
- **Explain why wasn't tried in a browser by a Form student:** the demo
  students are in Year 4. It is covered by tests end to end.
- **Explain why follows the second-chance switch:** a quiz shared in Test
  mode doesn't ask why either.
