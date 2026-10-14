# 055 — Daily Quest, skill garden and class quest (§28.3.4, phase 4)

A reason to open Mentora every day, even with no work due. A student's home
now opens on **My day**: today's quest, their streak, their skill garden and
their class's quest for the week.

## What a student sees

- **Today's Quest:** "5 quick questions: 3 to water in your garden and 2
  new. About five minutes." **Start the quest** plays them in the ordinary
  quiz player. Finished, the home says **Done for today!**, and the finish
  screen adds "Quest complete! 8-day streak · Your plants are watered".
  A quest done grows the buddy (+3, §28.3.1).
- **The streak:** a flame that burns once today is done, the days in a row,
  and freezes held (❄️ × 2).
  - Seven days in a row earn a freeze, up to two.
  - A missed day spends one instead of ending the streak, so a flu day
    doesn't wipe a month.
- **The skill garden:** every skill the student has met is a plant in a pot.
  - It grows from a seedling to a bloom as the skill moves up its review
    boxes.
  - It **droops and asks for water** (a drop, "Needs water", a blue tile)
    when the skill is due for review. Today's quest waters it.
  - Nothing ever dies.
- **Class quest:** "Class quest · 5 Bestari: 12 of 75 quests". Every quest
  anyone in the class finishes counts towards a goal of three a student a
  week. Reaching it throws a **buddy party**: everyone's buddies dancing,
  once per class per week. No one is ranked.

## How it works

- **Questions from work the student already has.**
  - The quest picks from every quiz question the student can see: their
    classes' work, what was sent home, and practice made for them.
  - No model call, so it costs nothing and is always on their syllabus.
  - It is a practice set the student owns, marked `choices.daily_quest`,
    played at `/practice/{id}` and hidden from the practice list.
  - Made on the first ask each day (`GET /api/me/day`), one per student per
    day (`daily_quests`).
- **Picking** (`quest_service.pick`):
  - up to three **review** questions, one per skill that is due, weakest
    first, preferring one the student once got wrong;
  - then **new** questions on as many different skills as possible: skills
    not met yet, then questions not answered yet;
  - seeded by student and day, so the quest is stable all day;
  - fewer than three questions makes no quest ("Your first quest is on its
    way").
- **Spaced review** (`skill_memory`, Leitner boxes):
  - after **every** finished attempt, each skill it asked about moves: 80%
    or more right goes up a box, under 50% goes back to the first, and
    anything between stays;
  - a skill comes back after 1, 2, 4, 7, 14 or 30 days, by its box;
  - a student with history but no memory yet has it worked out from their
    answers on first ask, with skills they found hard due today, so review
    starts at once.
- **The streak** (`services/streaks.py`) counts days with anything finished
  **in the school's time zone** (`DEFAULT_TIMEZONE`). It's computed from the
  attempts, freezes included, so there is nothing to store and nothing to
  drift. The home stat and the parent's view use it too.
- **The class quest** counts the done quests of the class's approved members
  from Monday to Sunday, against members × 3.

## Configuration

`DEFAULT_TIMEZONE`: set `Asia/Kuala_Lumpur` for Malaysia. The numbers (5
questions, 3 review, boxes, freezes, 3 a student a week) are in
`app/quests/rules.py`.

## Extending it

- **A game round in the quest** (planned in §28.3.4): a quest step after the
  questions, from a game's pairs, needs the player to take mixed rounds.
- **Generated questions when a student has too few:** `skill_practice` can
  make a quiz on their weakest skill; not done, to keep quests free.
- **The buddy announcing the quest:** a line in the buddy's brief when it
  is ready and not done.

## Known limits

- **Quiz questions only:** flashcards, guides and games don't feed the quest
  yet.
- **No quest until a student has three quiz questions to draw from:**
  usually their first shared quiz.
- **Quests are kept as sets,** one a day per student who opens Mentora.
  Cheap, but they add up; old ones could be cleaned after a term.
- **Watering is practice, not mastery:** a skill answered wrong in the quest
  goes back to the first box but is not thirsty again until tomorrow.
- **The class party is remembered per device:** a student on a new device
  sees that week's party again.
