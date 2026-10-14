# 057 — Learn → Practise → Play in study guides (§28.3.8, phase 6)

A study guide becomes a whole journey: read a part, play with it for a
minute, check it, and at the end beat the guide's boss and take its quiz.

## What a student sees

- **After each part's teaching, a "Practise" card** (about a minute) opens a
  game full screen:
  - a **Match Up** of the part's words to know, topped up with words from
    earlier parts when the part has fewer than three;
  - a **Line Up** of the process the part describes, when it describes one.
  
  The buddy says why a move was wrong; **Show me** appears after two wrong
  moves. "All done!" goes back to the guide, and the card says **Play
  again**. Then comes the part's check, as before.
- **The trail:** the buddy rides the progress bar at the top, hopping to the
  part being read. At the end, **Your journey** shows every part as a stop,
  lit gold with a tick once its check is answered, with the buddy standing
  at the last one.
- **Finishing every part unlocks:**
  - **Boss Battle:** "What does … mean?" for words from every part, against
    The Muddle Monster. Not for Year 1–2, as in games.
  - **Short quiz:** the guide's checks and its words as an 8-question quiz,
    played in the quiz player, with its second chance (056).
  
  Until then both are locked: "Finish every part to open it."

## What a teacher sees

- The guide editor's **Helpers** tab has **Steps in order, for a Line Up
  game**: 3 to 6 steps, or none.
- New guides are asked for `steps` when a part describes a process, and for
  2 to 4 words to know per part (was 1 to 4).
- The preview shows the games and the boss. The quiz is for students only.

## How it works

- **No model call.** The rounds and the boss are made in the browser from
  the guide's own words (`features/guide/journey.ts`), seeded by the guide,
  so they are the same on every visit and in the teacher's preview.
- **The quiz** (`POST /api/me/attempts/{id}/guide-quiz`,
  `services/guide_quiz.py`):
  - refused until every check is answered;
  - the checks, then each word once as "What does … mean?" with other
    meanings as options, up to 8, shuffled;
  - kept as the student's practice set (`choices.from_guide`), so asking
    again opens the same quiz. It also feeds the Daily Quest's bank.
- **Steps** are normalised like any field: 3 to 6 distinct steps under 120
  characters, or none (`study_guide._steps`).
- Full-screen sheets (this game, a second chance) quiet the buddies behind
  them, as celebrations do (`useCoversScreen`).

## Configuration

None. The sizes (3–4 pairs, 3–6 steps, 4–6 boss questions, an 8-question
quiz) are in `journey.ts` and `guide_quiz.py`.

## Known limits

- **Guides made before this have no steps**, so no Line Up until a teacher
  adds them in the editor or the guide is made again.
- **A part needs words to know for a Match Up:** the first part of a guide
  with one or two words has no game.
- **The games aren't marked or saved.** "Play again" and "boss beaten" are
  remembered on the device. The checks are what count.
- **The quiz is made once:** a guide edited afterwards keeps its old quiz.
- **Long meanings make tall tiles.** Meanings can be up to 240 characters.
