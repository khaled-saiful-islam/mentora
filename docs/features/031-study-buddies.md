# 031 — Study buddies

## What it does

Five companions keep a student company:

| Buddy | Species |
|---|---|
| Kiko | kancil |
| Bolt | robot |
| Ollie | owl |
| Momo | baby dragon |
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
  - fidgets when nothing is happening (a head tilt, a yawn, a wave, a
    stretch, a wiggle, a hop, a nod, a bounce, its trick)
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
  | Bolt | top-spin, with sparks from its antenna |
  | Ollie | wing flutter, with drifting feathers |
  | Momo | puff of flame, which comes out as sparks |
  | Rimau | roar, with shockwave rings |

  Five quick taps unlock a secret dance.
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
    pitch (Kiko quick and high, Bolt beeping, Ollie a low hoot, Momo soft,
    Rimau gruff)

  A buddy is quiet while it fidgets or sleeps. No sound plays until the
  person has tapped or pressed a key on the page, because browsers refuse
  sound before that.
- **Tips are about how to learn**, never about the question. The tip function
  is never given a question, so it has nothing it could give away. On the
  home page, a tip can name a skill the student could practise.

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
  particles.tsx     stars, hearts, notes, z's, flames, rings, leaves…
  hooks.ts          useBlink, useGaze (one shared pointer listener),
                    useBuddyMood (reactions, fidgets, dozing), useSpeech
  profiles.ts       the registry: name, rig, signature moves, anchors
  voices.ts         what each buddy says
  reactions.ts      game cue → mood + line + particles
  tips.ts           study tips, skill nudges, Malay greetings
  Buddy.tsx         the living buddy, with an imperative handle
  BuddyAvatar.tsx   a still face for lists
  BuddyStage.tsx    the glowing backdrop
```

- **A rig is a drawing wired to joints.** The joints are `spin`, `body`,
  `head`, `armL`, `armR`, `earL`, `earR`, `tail`, `extra` and `shadow`.
  `choreograph(mood, signature, calm)` returns an animation for every joint.
  - A joint the mood does not mention goes back to rest.
  - A momentary mood starts from wherever the joint already is (`null` as its
    first keyframe), so interruptions never jump.
  - A buddy's `signature` replaces the moods it does its own way. For
    example, Bolt hovers where the others breathe.
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
