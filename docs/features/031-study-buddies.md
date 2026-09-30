# 031 — Study buddies

## What it does

Five companions keep a student company:

| Buddy | Species |
|---|---|
| Kiko | kancil |
| Tompok | cat (a grey kampung cat with a patch over one eye, a red collar and a gold bell) |
| Ollie | owl |
| Momo | baby orangutan, from the rainforests of Borneo (updated 2026-09-30: Momo was a baby dragon, and is now a Malaysian animal) |
| Rimau | Malayan tiger cub |

- **A student picks one on their first visit** (`Welcome.tsx`) and can change
  it any time at `/buddy`.
- **The buddy stands on the home page**, keeps a child company in every quiz
  and deck, and dances on the finish screen and the podium. While playing
  (`features/play/BuddyDock.tsx`), it stands in a corner beside the game on
  screens 1280 px and wider. Narrower than that, a corner would sit on the
  answers, so it stands in the page under the game and talks to its left.
  Nothing it does covers a question.
- **They are alive.** A buddy:
  - breathes, and blinks at random
  - follows the pointer with its eyes, and glances around when there is none
  - leans its head after its gaze
  - fidgets when nothing is happening, **in its own way**
    (`BuddyProfile.antics`):
    - Kiko looks around, hops and peeks.
    - Tompok stretches, yawns and twirls.
    - Ollie nods, thinks and hugs.
    - Momo hugs, stretches and giggles, and the tuft of hair on top never lies down.
    - Rimau flexes and star-jumps.
  - has 25 moves: the six newest are twirl, star jump, hug, flex, look
    around and giggle, and all of them are on the *My buddy* page, with a
    *Fun fact* button
  - nods off after 45 seconds alone, and wakes with a start
- **They react to play.**
  - Right answer: a cheer and stars.
  - Every third in a row: a celebration.
  - Wrong answer: a dizzy wobble and a kind word.
  - The end: a line that fits the score.
- **They coach** (`features/play/coach.ts`), in their own voice:
  - **Halfway** (sets of six or more) gets a bounce, and **the last one** a
    clap. Both come a moment after the item appears, so the last answer's
    cheer is heard first.
  - **Stuck for 25 seconds** on one question or card, the buddy points up at
    it: *"Take your time…"*. In the Year 1–3 look it may suggest *Read it to
    me* instead.
  - **Right after a miss**, it hops and says *"You bounced right back!"*.
  - **Two misses in a row** get a nod, a kind word and a way to think, for
    example *"Rule out the answers you know are wrong."*
  - Like the tips, none of it is about the question, so it can't give an
    answer away.
- **Each has a signature trick**, played on a tap:

  | Buddy | Trick |
  |---|---|
  | Kiko | backflip, with falling leaves |
  | Tompok | chases her own tail, leaving paw prints |
  | Ollie | wing flutter, with drifting feathers |
  | Momo | leaf umbrella: a big leaf held up high while rain patters down, the way real orangutans shelter from the rain |
  | Rimau | roar, with shockwave rings |

  Five quick taps unlock a secret dance.
- **They keep a student company on Home** (`chatter.ts`). After the hello and
  the tip, the buddy says something every half a minute or so, and moves as it
  talks. The lines rotate:
  - **the child's own day**, first: what is waiting (*"You've got 'The
    Water Cycle' waiting — shall we start it together?"*), practice made for
    them, their streak, their badges, a skill to practise, a strength
  - **a fun fact of its own** (each buddy has five)
  - **a cheer** in its own voice
  - **a study tip**

  It says at most eight lines a visit and nothing while the tab is hidden. It
  never talks about a question's content.
- **They talk.** Speech bubbles say words one at a time, in each buddy's own
  voice (`voices.ts`). A bubble is drawn over the whole page next to its
  buddy (`bubblePlace.ts`), so no card that clips its contents and no screen
  edge can cut it off. It slides to stay 12 px inside the edges, moves below
  the buddy when there is no room above, is never wider than the screen, and
  wraps its words.
- **They make sounds** (`sounds.ts`), synthesised on the spot, with no audio
  files:
  - a trill for a trick
  - a happy *yay* for a cheer
  - a soft *aww* for a miss
  - a two-note hello
  - a babble under every bubble, about a syllable a word, in the buddy's own
    pitch (Kiko quick and high, Tompok mewing, Ollie a low hoot, Momo a round ooh-ooh,
    Rimau gruff)

  A buddy is quiet while it fidgets or sleeps. No sound plays until the
  person has tapped or pressed a key on the page, because browsers refuse
  sound before that.
- **Tips are about how to learn**, never about the question. The tip function
  is never given a question, so it has nothing it could give away. On the
  home page, a tip can name a skill the student could practise.

### On every page, knowing the student (added 2026-09-30)

A student's buddy goes with them to every page, as the one friend who
knows how they are doing (`BuddyCompanion.tsx`).

- **Where it stands.** In the sidebar on a screen at least 768 px wide and
  780 px tall, with *"Momo · tap me for a tip"* under it. On a phone or a
  short screen it stands small in the header, beside the bell. Home and *My
  buddy* already have a buddy, so it stays out of those.
- **Its words never cover the page.** What it says goes in the layout: a
  note above it in the sidebar, or a strip under the header on a phone that
  pushes the page down. Each line shows for about nine seconds, and × closes
  it sooner.
- **What it knows** (`GET /api/me/buddy`, `services/buddy_brief.py`):
  - what is waiting, overdue first, then the soonest due;
  - the streak and the badges;
  - two strengths and two skills to practise;
  - the last three scores, and the average of each kind (quiz, flashcards,
    study guide) over its latest ten tries;
  - the live lesson happening now, or else the next one.

  It is fetched once and kept fresh by the `assignments`, `progress` and
  `live` pushes.
- **What it says, page by page** (`companion.ts`), a line soon after
  arriving and then every 45 seconds or so, three a page at most:

  | Page | It says |
  |---|---|
  | Any page | What is overdue (*"'Fractions' is overdue. Shall we do it now? I'll help!"*), what is due soon (*"…is due today at 3:00 PM"*), the next live lesson, the streak |
  | Practice | The skill to grow (*"Let's practise 'Water'…"*), and a tip for any kind that has felt hard |
  | Results | The last score in words, a strength, what to practise, and how each kind has gone |
  | Badges | How many badges, and the streak |
  | Schedule | When the next live lesson is, and a live-lesson tip |
  | A live lesson | One tip, with no sound, since Astra is talking |
  | Leaderboard | That beating your own best is what counts |

- **Tips for doing better** (`HOW_TO`), for each kind of work:
  - **Quizzes:** read every answer before choosing, rule out the wrong ones,
    watch for NOT and ALWAYS.
  - **Flashcards:** say it out loud before flipping, be honest with *Not
    yet*.
  - **Study guides:** *Read it to me*, the dotted words, *Simpler*, the
    Remember box.
  - **Live lessons:** a quiet spot with sound on, *Ask Astra*, the key idea
    on screen, every option in a quick check.

  How a kind has gone decides the words: 85% or more is praised (*"Your
  quizzes are going brilliantly lately: 91% on average!"*), under 60% gets a
  tip (*"Quizzes have felt tricky lately. Try this: …"*).
- **In a quiz, deck or guide**, the tip a few seconds in fits the student:
  a skill in it that was tricky before (*"This one has 'Water' in it. It was
  tricky before, so take it slowly"*), one they are strong at, or how that
  kind has gone. Without any of those it is the usual study tip.
- **On the finish screen**, after the cheer: the skill to practise next
  (*"Next, let's practise 'Water'"*), or a tip for next time.
- **On Home**, its chatter also mentions what is overdue, the next live
  lesson, and how each kind has gone.
- **Tapped**, it does its trick and says the next useful line.

### On the signed-out screens

All five buddies stand on the hills behind sign-in, sign-up and invite pages
(`features/auth/scene/`). Their eyes follow the pointer, and they react to the
form through `crew.tsx`:

- a text field has focus → they lean in to listen (`listen`)
- the password field has focus → eyes shut, ears down (`shy`), and one says
  "No peeking — promise!" now and then
- the password is shown → one eye opens (`peek`)
- a wrong password → they wince (`oops`) and say so
- the account is accepted → they celebrate with confetti, and only then does
  the app move on: `signIn`, `signUpTeacher` and `signUpStudent` take an
  optional `before` step that runs after the server says yes and before the
  user is set, because the signed-out pages leave the moment there is a user.
  A failure in it never blocks the sign-in.

Student sign-up shows its four steps as stepping stones, with Kiko hopping to
the current one (`StepStones.tsx`).

## How it works

```
features/buddies/
  types.ts          BuddyKey, Mood, Joint, RigProps
  choreography.ts   mood → joint animations (pure; tested)
  parts.tsx         Eyes, Mouth (morphing path), Cheeks, Follow, Gloss
  rigs/             one SVG drawing per buddy, wired to named joints
  particles.tsx     stars, hearts, notes, z's, raindrops, rings, leaves…
  hooks.ts          useBlink, useGaze (one shared pointer listener),
                    useBuddyMood (reactions, fidgets, dozing), useSpeech
  profiles.ts       the registry: name, rig, signature moves, anchors
  voices.ts         what each buddy says
  reactions.ts      game cue → mood + line + particles
  tips.ts           study tips, skill nudges, Malay greetings
  Buddy.tsx         the living buddy, with an imperative handle
  BuddyAvatar.tsx   a still face for lists
  BuddyStage.tsx    the glowing backdrop
  brief.ts          what the buddy knows (GET /api/me/buddy), kept fresh
  companion.ts      what it says on each page, and tips (pure; tested)
  BuddyCompanion.tsx  the buddy on every student page, and its note
```

- **A rig is a drawing wired to joints.** The joints are `spin`, `body`,
  `head`, `armL`, `armR`, `earL`, `earR`, `tail`, `extra` and `shadow`.
  `choreograph(mood, signature, calm)` returns an animation for every joint.
  - A joint the mood does not mention goes back to rest.
  - A momentary mood starts from wherever the joint already is (`null` as its
    first keyframe), so interruptions never jump.
  - A buddy's `signature` replaces the moods it does its own way. For
    example, Tompok's tail and bell never stop swaying.
- **Pivots use `originX`/`originY` with `transform-box: view-box`**
  (`paint.pivot`). A plain `transformOrigin` is overwritten by Motion on SVG
  parts, and every joint would then turn about the centre of the drawing.
- **Colours are theme tokens** (`--buddy-*` in `theme.css`). They are the
  same in both themes, because a character is known by its colours.
- **Games talk to the buddy through its handle.** For example,
  `buddy.current.cue('correct', { streak })`. A player never needs to know
  what a cheer looks like.
- **Reduced motion.** Every joint holds at rest and particles are off; the
  face alone shows the mood. The `motion` preference overrides the system
  setting in either direction.
- **Small buddies (under 72 px) run light.** They skip particles, pointer
  tracking and fidgets, so a leaderboard of thirty stays cheap.

## Configuration

None. The buddy is saved on the user (`PATCH /api/auth/me {buddy}`).

**Sound** follows the person's `sound` preference. It is on by default for
students and off for teachers, parents and admins. A speaker button in every
game's header switches it (and saves it), and so does Settings. Turning it
on there plays a blip at once, which is also what lets the browser play
sound.

## Extending

- **A new buddy** needs:
  - a rig in `rigs/`
  - its colours in `theme.css`
  - a voice in `voices.ts`
  - one entry in `BUDDIES` (`profiles.ts`)
  - its key in `app/core/buddies.py`
- **A new mood** needs an entry in `MOVES` and `HOLD_MS` (and `MOOD_SOUND` if
  it should make one), plus a mouth and
  eyes in `parts.tsx`. The choreography test checks that it gives every
  joint a move and settles at rest.
- **A new particle** needs a case in `flight()` and `Shape` in
  `particles.tsx`.

## Known limits

- **Momo kept the key `momo`** when the dragon became an orangutan, so a
  student who had picked Momo still has Momo, now an orangutan, with nothing
  to migrate. Their buddy changed without them choosing it.

- **The companion's lines are rules, not a model.** It picks from what it
  knows with fixed wording. That keeps it safe and free, but it cannot hold
  a conversation or answer a question.
- **It knows results, not answers.** The brief has scores and skills, never
  a question, so it cannot say why a particular answer was wrong.
- **One line at a time.** A new line replaces the one showing.
- **A buddy babbles; it doesn't speak words.** Its lines are read on screen,
  with a babble under them. Speaking them in a recorded voice would put a
  second voice beside Astra's *Read it to me*, and would cost a clip per
  line.

- **English only.** The voices and tips are in English, apart from the Malay
  greetings.
- **No phone tilt.** On a phone the eyes wander rather than follow anything,
  since there is no pointer and no gyroscope input.
- **The secret dance and the fidgets are random,** so a screenshot test
  cannot pin down a buddy's idle frame; the tests assert moves, not pixels.
- **Particles use SVG `<text>` for "z" and "?"**, so they follow the display
  font. Under the "easy read" font they change shape.
