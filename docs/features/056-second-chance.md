# 056 — Second chance, at your level (§28.3.7, phase 5)

A wrong answer becomes the moment a child learns, not just a red cross.

## What a student sees

- After a wrong answer in a quiz that marks each answer straight away
  (including Today's Quest), the verdict offers **Let's look at it
  together** beside **Next**.
- It opens a sheet over the quiz, with their buddy thinking beside the title:
  - the question again, and its answer;
  - **Simpler, Just right or Challenge**, the study guide's levels. "Just
    right" is written for the student's year; the choice is remembered on
    the device, like the guide's;
  - **why** the right answer is right, a **worked example** whose steps
    appear one by one, and one thing to **remember**.
- **Try one like it:** a question on the same skill, answered in the same
  four tiles.
  - Right: the buddy cheers, confetti, "You got it! What a comeback.", and
    "Momo grew a little!" (+1 growth, §28.3.1).
  - Wrong: an *oops*, a kind word, the answer and why.
- **Next question** (or **See my score**) goes on with the quiz; **Back**
  or Escape returns to the verdict.
- **The score never changes.** The first answer stands; the second try is
  for learning.

## What a teacher sees

The share dialog has **Test mode** for quizzes marked after each answer: on,
there is no second chance. A quiz marked at the end never has one, since
answers are not revealed until the finish.

## How it works

- **Where it is offered** (`attempt_service.second_chance_for`): a quiz,
  feedback "instant", and an assignment with `second_chance` on, or no
  assignment at all (practice, the Daily Quest, work sent home). The
  attempt says so (`second_chance` in the attempt response), and every
  endpoint checks it again, along with the answer being wrong.
- **Explanations** (`GET /api/me/attempts/{id}/items/{item}/explain?level=`):
  - written by the generation model the first time anyone asks for that
    question, year and level, then kept in `item_help`;
  - keyed by a hash of the question's words, options and answer
    (`item_key`), not its set, so a question copied into a Daily Quest or a
    new version is explained once;
  - checked for shape: a reason, a problem, 2–4 steps and an answer;
  - a model that will not answer gives the question's own note, marked
    `written: false` and not kept, so the next ask tries again.
- **One like it** (`POST …/twin`), found before it is made:
  1. another question in the same set on the same skill that this attempt
     won't ask;
  2. a question on the same skill from the student's other work (the Daily
     Quest's bank), unanswered ones first, never one worded like a
     question in this set;
  3. one the model made before for this question (`item_help`, kind
     `twin`);
  4. one made now: a new question on the skill with a different answer,
     kept for the next student, and at most 10 a day for each student.
  
  Options are shuffled, so a question met before is not answered from
  memory of where the answer sat. Asked again, it is the same question
  (`second_chances`, one per attempt and question).
- **The second try** (`POST …/twin/answer`) is kept once; asked again, it
  gives the same result. Right grows the buddy +1 (`second_chance`), at most
  5 times a day (`SECOND_CHANCES_A_DAY`), so missing on purpose doesn't pay.
- Both model calls go through the traced provider, as stages
  `second chance: explain` and `second chance: one like it` (Langfuse,
  `docs/features/051-observability.md`).

## Configuration

- `RATE_LIMIT_SECOND_CHANCE_PER_MINUTE` (default 20): second-chance asks per
  student per minute. Most cost no model call.
- The caps are in code: `MOST_MADE_A_DAY` in
  `services/second_chance_service.py`, `SECOND_CHANCES_A_DAY` in
  `growth/rules.py`.

## Extending it

- **Read it to me:** the explanation isn't voiced yet. It needs a spoken
  part for item help in `read_aloud`.
- **Teachers seeing comebacks:** `second_chances` has what's needed for "8
  students got it on a second try" in results.
- **Other kinds:** flashcards and guides have their own "not yet" paths; a
  game island already has hints and "Show me".

## Known limits

- **Quiz questions only**, and only where answers are marked straight away.
- **The Comeback and Never Give Up badges** still count retakes and games,
  not second chances; a second chance grows the buddy instead.
- **The first ask for a level waits on the model** (a few seconds, with
  "Writing it just for you…"). Later asks are instant.
- **A question from the bank can be easier than the one missed:** it
  matches on skill, not difficulty.
- **Test mode can't be changed after sharing:** share again to change it.
- **Written in English or Malay**, from the set's language. Explanations for
  other languages fall back to English.
