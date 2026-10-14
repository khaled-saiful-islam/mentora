# 054 — Help at home, and practice for these students (§28.3.3, phase 3)

From a skill a child finds hard, one tap gets help. **Parents** learn what the
skill means and something to do together at home, can send a challenge their
child's buddy delivers, and can send cheers. **Teachers** make practice on a
red skill for just the students who found it hard.

## What a parent sees

On their child's page, each skill under **Worth practising** is a button
("Tap a skill to see how to help at home"). It opens **Help at home**:

1. **What it means:** the skill in two plain sentences, and one example
   from everyday Malaysian life ("a wet tuala drying in the sun").
2. **Five minutes at home, no screen:** a named activity, the real things it
   needs ("a cup of water, a plate, two 20 sen coins") and three or four
   steps.
3. **Send a challenge:** a short quiz on just that skill, at the child's
   year. The parent sees "On its way! Momo will bring it to Aina in about a
   minute".
   - The child is told "Mum sent you a quiz", with their buddy, and opens it
     from home.
   - The parent hears back how it went, as for anything sent home.

English or Bahasa Melayu, by a switch at the top.

**Cheer Aina on** (in the child's header) offers six preset cheers: 🌟 So
proud of you!, 💪 Keep going, 🎉 Well done today!, ❤️ Love you, superstar!,
🌱 Mistakes help us grow, 🙌 High five! The child's buddy announces it with
confetti: "Mum says: So proud of you! 🌟".

## What a teacher sees

On an assignment's **Skills** heatmap, each skill with students in the red
has **Practice for N** under its name. One tap:
- makes a short quiz on that skill, from the assignment's own sources;
- puts those students in a class group, "Practise: Light energy" (the same
  group if that skill was practised before, with its members refreshed);
- shares the quiz with just that group as soon as it is made. They are told
  as for any shared work.

## How it works

- **Help is written once and kept.**
  - `SkillHelpService` asks the generation model for meaning, example and
    activity, as JSON, then cleans it to lengths a parent reads. Too few
    steps or a missing meaning is refused, and "Help at home could not be
    written just now" is said plainly.
  - It's kept in `skill_help`, unique per subject, skill, year and language,
    so every parent of a Year 4 child stuck on the same skill reads the same
    words and the model is asked once.
  - It's traced in Langfuse as `help at home`.
- **Practice on one skill** (`services/skill_practice.py`) is shared by both
  parent and teacher:
  - a plan (topic "Light energy, from plants", subject, year, language, the
    one skill, sources), grounded in real work: the child's latest set with
    that skill, or the assignment's set;
  - `begin` creates the set row in the request, so the parent's daily limit
    (`PARENT_SETS_PER_DAY`) and refusals are said at once;
  - after the request commits, `build_then` runs the build in its own task
    and delivers only if it was made: `FamilyShareService.share` for a
    parent, `AssignmentService.share` with the new group for a teacher.
    Like "Made for you", a set that could not be made is logged, never
    raised.
- **Cheers** (`services/cheer_service.py`) are preset only. A notification
  of kind `cheer` carries the sticker, the line, the buddy's mood and what
  the child calls the parent. At most 10 an hour per parent and child.
- **Routes:**
  - `GET /api/me/children/{id}/skills/{slug}/help?subject=&label=&language=`
  - `POST /api/me/children/{id}/challenges {skill}`
  - `GET` and `POST /api/me/children/{id}/cheers`
  - `POST /api/assignments/{id}/practice {skill}`

  Only a linked parent reaches a child (`FamilyService.child`), only the
  owning teacher an assignment.

## Configuration

None new. Challenges count against `PARENT_SETS_PER_DAY`; both kinds of
practice against `RATE_LIMIT_GENERATE_PER_MINUTE`.

## Extending it

- **Another language for help:** add it to `LANGUAGES` in
  `skill_help_service.py` and to the switch in `HelpAtHome.tsx`.
- **Another cheer:** one line in `CHEERS`. The picker lists what the server
  offers.
- **Practice from somewhere else** (a student's own results page): build a
  `SkillPractice` and call `begin` and `build_then` with a `Deliver`.

## Known limits

- **Help is kept forever.** A bad answer stays until its `skill_help` row is
  deleted. There is no "this wasn't helpful" button yet.
- **A challenge takes about a minute** to arrive. The parent is told so; the
  child is told when it's there.
- **A teacher's practice keeps one group per skill.** Practising the same
  skill again reuses "Practise: X", with its members replaced by whoever is
  in the red now. Groups can be renamed or deleted in the class.
- **The red line is 50% right** (`WEAK`), the same as the heatmap's colours;
  a student with no answers on the skill is left out.
- **Cheers are one-way:** a child cannot reply yet.
