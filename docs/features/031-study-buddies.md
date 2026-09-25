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
- **The buddy stands on the home page**, rides along in the corner of every
  quiz and deck, and dances on the finish screen and the podium.
- **They are alive.** A buddy:
  - breathes, and blinks at random
  - follows the pointer with its eyes, and glances around when there is none
  - leans its head after its gaze
  - fidgets when nothing is happening (a head tilt, a yawn, a wave, its trick)
  - nods off after 45 seconds alone, and wakes with a start
- **They react to play.**
  - Right answer: a cheer and stars.
  - Every third in a row: a celebration.
  - Wrong answer: a dizzy wobble and a kind word.
  - The end: a line that fits the score.
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
  voice (`voices.ts`).
- **Tips are about how to learn**, never about the question. The tip function
  is never given a question, so it has nothing it could give away. On the
  home page, a tip can name a skill the student could practise.

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

None. The buddy is saved on the user (`PATCH /api/auth/me {buddy}`). Sound
follows the student's own setting.

## Extending

- **A new buddy** needs:
  - a rig in `rigs/`
  - its colours in `theme.css`
  - a voice in `voices.ts`
  - one entry in `BUDDIES` (`profiles.ts`)
  - its key in `app/core/buddies.py`
- **A new mood** needs an entry in `MOVES` and `HOLD_MS`, plus a mouth and
  eyes in `parts.tsx`. The choreography test checks that it gives every
  joint a move and settles at rest.
- **A new particle** needs a case in `flight()` and `Shape` in
  `particles.tsx`.

## Known limits

- **English only.** The voices and tips are in English, apart from the Malay
  greetings.
- **No phone tilt.** On a phone the eyes wander rather than follow anything,
  since there is no pointer and no gyroscope input.
- **The secret dance and the fidgets are random,** so a screenshot test
  cannot pin down a buddy's idle frame; the tests assert moves, not pixels.
- **Particles use SVG `<text>` for "z" and "?"**, so they follow the display
  font. Under the "easy read" font they change shape.
