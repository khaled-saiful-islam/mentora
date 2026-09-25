# 036 — Live tutoring, Phase 0: the voice lab

## What it does

Before any live session is built, the tutor has to sound like a real teacher
(PLAN.md §19.0, a redline). The voice lab at **`/live/voice-lab`** (teachers
only) is where that is judged, using the same pieces a live session will use:

- a teacher picks a topic, a school level and a few student names;
- **Astra**, the tutor — a little ringed planet drawn with the buddies' parts —
  writes the opening of a lesson and teaches it out loud, with captions that
  light up word by word and a key idea on screen beside it;
- part-way, the teacher raises a hand *as* one of the students. Astra finishes
  its thought, calls on them by name, hears the typed question, thanks them,
  answers for the room, and brings everyone back to the lesson;
- the voice, the voice model and the pace can be changed and the same lesson
  played again to compare.

## How it works

**Written to be spoken** (`backend/app/live/`)

| File | Job |
|---|---|
| `prompts.py` | How the tutor talks: to the group, contractions, questions to the room, signposts, Malaysian examples; never lists, symbols or essay phrases. Students cannot answer out loud, so the tutor never questions one by name or reacts as if it heard an answer — it says "If you said…" |
| `speakable.py` | Turns written text into what a teacher would say: `H₂O` → "H two O", `25°C` → "25 degrees Celsius", `3 × 4 = 12`, `e.g.`, markdown, links, emoji |
| `beats.py` | Cuts the lesson into **beats** (2–4 sentences, ≤ 60 words, one breath group) with a scripted pause after each: `short` 0.3 s, `breath` 0.6 s, `think` 1.5 s. A question followed by "If you said…" is split so the pause falls between them |
| `speakability.py` | The checks that send a script back once to be rewritten: over-long sentences, unsayable symbols, stiff phrases, a pace far from the target, a named question, reacting to an answer nobody gave |
| `sentences.py` | Cuts a streamed answer into whole sentences as they finish (not at `3.5` or `Mr.`) |
| `audio.py` | `Narrator`: every clip keyed by model, voice, speed and words, recorded once and cached on disk; two requests for one clip share one recording |
| `voice_lab.py` | Writes the lesson (write → check → one repair) and streams answers sentence by sentence, each screened before it is voiced |

**The voice** is `providers/speech.py`: a `SpeechProvider` Protocol and an
OpenAI-style `/audio/speech` adapter. ILMU serves it at the chat base URL with
the same key, so there is nothing new to configure.

**Answers feel live.** The instant a hand is taken, a line pre-written per
student plays ("Okay, Aina, over to you."; then "Great thinking, Aina.").
While the hand is up the page calls `/live/voice-lab/warm`, which streams the
answer prompt for one token: measured on ILMU, a cold question waits about 3 s
for its first word and a warm one about 0.25 s. A one-token *non-streamed*
call returns at once and warms nothing, so the warm-up must stream. An opening
"What a brilliant question!" from the model is dropped — the student was
already thanked.

**Gapless playback** (`frontend/src/features/live/audio/`). `SpeechQueue`
schedules each clip on the Web Audio clock as soon as the one before is
scheduled, so the only silence is the script's. It has two lanes: the
**lesson** lane can be *held* (a hand is up — the beat being said finishes and
the next waits); the **tutor** lane (call-on lines, answers) plays even while
held. `timing.ts` holds the pure arithmetic: the next start, word timings
estimated from syllables and punctuation, and loudness from the analyser.

**Astra** (`TutorAvatar.tsx`) uses the buddies' `Frame`, `Joint`, `Eyes`,
`Cheeks` and choreography, so it breathes, blinks, waves and cheers like them.
Its mouth and glow are driven by the loudness of what is actually being heard.

## API

All under `/api/live`, `run_live_sessions` capability (teachers, admins).

| Method | Path | Does |
|---|---|---|
| GET | `/voices` | Voices, models, the defaults and the speed range |
| POST | `/voice-lab/lesson` | `{topic, grade_level?, students[]}` → beats, recap, remaining problems, and each student's lines. Counts against the generation limit |
| POST | `/speech` | `{text, voice?, model?, speed?}` → `audio/mpeg`. Only voices and models on offer; ≤ 900 characters; `RATE_LIMIT_SPEECH_PER_MINUTE` |
| POST | `/voice-lab/warm` | Warms the model for a question (204) |
| POST | `/voice-lab/answer` | SSE: `sentence` … `done`, or `redirect` for a question that cannot be answered in the room |

## Configuration

`SPEECH_MODEL`, `SPEECH_BASE_URL`, `SPEECH_API_KEY` (empty → `LLM_*`),
`SPEECH_VOICE`, `SPEECH_SPEED` (0.85 ≈ 150 words a minute), `SPEECH_VOICES`,
`SPEECH_MODELS`, `SPEECH_TIMEOUT_SECONDS`, `LIVE_AUDIO_DIR`,
`RATE_LIMIT_SPEECH_PER_MINUTE`. See `.env.example`.

## Extending it

- **Another voice vendor** (one with word timings, say ElevenLabs): a class in
  `providers/speech.py` implementing `SpeechProvider`, and a branch in
  `build_speech`. `Speech` can grow an optional timings field; `wordTimings`
  would then be used only when it is absent.
- **A new speakable rule**: a line in `speakable.py` and a case in
  `test_live_speech_text.py`.

## Known limits

- **Word timings are estimated**, not measured: the voice returns none. Close
  within a beat, exact at every beat's start.
- **The lesson takes 15–35 s to write** (one call, sometimes a repair). A live
  session's plan is made in advance and approved, so this is a preview cost.
- **The audio cache is inside the container** (`.cache/live-audio`) and is lost
  on rebuild. Live sessions (Phase 1) give it a volume and a retention rule.
- **English only** for now, by decision. ILMU's speech-to-text cannot do Tamil.
- **Questions are typed** here; push-to-talk arrives in Phase 4.
- **Rules-only screening** of the pretend student's question in the lab; a live
  session uses the full student gate.
