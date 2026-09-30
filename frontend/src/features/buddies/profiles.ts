/**
 * The five study buddies. Adding a sixth is a rig in `rigs/`, a voice in
 * `voices.ts`, colours in theme.css and one entry here — and the backend's
 * list in `app/core/buddies.py`.
 */
import type { ComponentType } from 'react'
import { arms, loop, once, type Signature } from './choreography'
import type { MouthShape } from './parts'
import type { ParticleKind } from './particles'
import { KikoRig } from './rigs/Kiko'
import { MomoRig } from './rigs/Momo'
import { OllieRig } from './rigs/Ollie'
import { RimauRig } from './rigs/Rimau'
import { TompokRig } from './rigs/Tompok'
import type { BuddyKey, Mood, Point, RigProps } from './types'

export type Anchor = 'top' | 'side' | 'mouth' | 'body'

export interface BuddyProfile {
  key: BuddyKey
  name: string
  species: string
  /** One line for the picker: who they are. */
  tagline: string
  /** What their trick is called, for the button that asks for it. */
  trick: string
  Rig: ComponentType<RigProps>
  signature: Signature
  mouths: Partial<Record<Mood, MouthShape>>
  anchors: Record<Anchor, Point>
  trickBurst: { kind: ParticleKind; count: number; from: Anchor; delayMs: number }
  /** The head, as a viewBox — for an avatar in a list. */
  face: string
  /** How it fidgets when nothing is happening — its own habits. */
  antics: readonly Mood[]
}

const UMBRELLA = once(1.8, { times: [0, 0.2, 0.5, 0.85, 1] })
const ROAR = once(1.3, { times: [0, 0.2, 0.4, 0.8, 1] })
const NO_SPIN = { rotate: 0 }

export const BUDDIES: Record<BuddyKey, BuddyProfile> = {
  kiko: {
    key: 'kiko',
    name: 'Kiko',
    species: 'kancil',
    tagline: 'A quick, clever mouse-deer who loves a smart trick.',
    trick: 'Backflip',
    Rig: KikoRig,
    signature: {},
    mouths: {},
    anchors: { top: [100, 30], side: [138, 58], mouth: [100, 110], body: [100, 140] },
    trickBurst: { kind: 'leaf', count: 5, from: 'top', delayMs: 350 },
    face: '42 16 116 116',
    antics: ['lookaround', 'hop', 'wiggle', 'trick', 'twirl', 'nod', 'listen'],
  },
  tompok: {
    key: 'tompok',
    name: 'Tompok',
    species: 'cat',
    tagline: 'A curious kampung cat with a patch over one eye and a bell that jingles.',
    trick: 'Tail chase',
    Rig: TompokRig,
    signature: {
      // A cat's tail is never still, and the bell sways with her breathing.
      idle: {
        tail: { rotate: [0, 12, -4, 10, 0], transition: loop(3.2) },
        extra: { rotate: [0, 6, 0, -6, 0], transition: loop(2.4) },
      },
      // Round and round after her own tail: turned about, twice, with a hop.
      trick: {
        spin: NO_SPIN,
        body: {
          scaleX: [null, 0.15, -1, 0.15, 1, 0.15, -1, 0.15, 1],
          y: [null, -8, -12, -8, -12, -8, -12, -6, 0],
          transition: once(1.4),
        },
        tail: { rotate: [null, 40, -30, 40, -30, 0], transition: once(1.4) },
        extra: { rotate: [null, 30, -30, 30, 0], transition: once(1.4) },
      },
    },
    mouths: { trick: 'grin' },
    anchors: { top: [100, 30], side: [142, 58], mouth: [100, 110], body: [100, 142] },
    trickBurst: { kind: 'paw', count: 6, from: 'body', delayMs: 250 },
    face: '40 16 120 120',
    antics: ['stretch', 'lookaround', 'wiggle', 'yawn', 'twirl', 'giggle', 'listen'],
  },
  ollie: {
    key: 'ollie',
    name: 'Ollie',
    species: 'owl',
    tagline: 'A wise owl in round glasses who never minds a mistake.',
    trick: 'Flutter',
    Rig: OllieRig,
    signature: {
      idle: { extra: { rotate: 0 } },
      think: { extra: { y: 5 }, armL: { rotate: 0 }, armR: { rotate: -25 } },
      trick: {
        spin: NO_SPIN,
        body: { y: [null, -26, -32, -26, -32, -26, 0], transition: once(1.4) },
        ...arms([null, 70, 10, 70, 10, 70, 10, 70, 0], once(1.4)),
        extra: { y: [null, -3, 2, 0], transition: once(1.4) },
      },
    },
    mouths: {},
    anchors: { top: [100, 22], side: [142, 56], mouth: [100, 108], body: [100, 140] },
    trickBurst: { kind: 'feather', count: 6, from: 'body', delayMs: 200 },
    face: '38 18 124 124',
    antics: ['nod', 'think', 'lookaround', 'wave', 'hug', 'stretch', 'listen'],
  },
  momo: {
    key: 'momo',
    name: 'Momo',
    species: 'baby orangutan',
    tagline: 'A cheeky baby orangutan from Borneo, with long arms for big hugs.',
    trick: 'Leaf umbrella',
    Rig: MomoRig,
    signature: {
      // The tuft of hair never quite lies down.
      idle: { extra: { rotate: [0, -8, 0, 6, 0], transition: loop(2.6) } },
      // Up goes a big leaf, held high while the rain patters down.
      trick: {
        spin: NO_SPIN,
        body: { y: [null, -6, 0, -3, 0], transition: UMBRELLA },
        head: { rotate: [null, -8, -8, 6, 0], transition: UMBRELLA },
        armR: { rotate: [null, -140, -140, -140, 0], transition: UMBRELLA },
        armL: { rotate: [null, 20, 10, 20, 0], transition: UMBRELLA },
        extra: { rotate: [null, -12, 10, -8, 0], transition: UMBRELLA },
      },
    },
    mouths: { trick: 'grin' },
    anchors: { top: [100, 22], side: [142, 58], mouth: [100, 110], body: [100, 142] },
    trickBurst: { kind: 'drop', count: 9, from: 'top', delayMs: 300 },
    face: '42 14 116 116',
    antics: ['hug', 'stretch', 'lookaround', 'giggle', 'wave', 'bounce', 'think'],
  },
  rimau: {
    key: 'rimau',
    name: 'Rimau',
    species: 'tiger cub',
    tagline: 'A brave Malayan tiger cub with a very small roar.',
    trick: 'Roar',
    Rig: RimauRig,
    signature: {
      trick: {
        spin: NO_SPIN,
        body: {
          scaleY: [null, 0.88, 1.1, 1.06, 1],
          scaleX: [null, 1.1, 0.95, 0.97, 1],
          y: [null, 2, -6, -4, 0],
          transition: ROAR,
        },
        head: { scaleX: [null, 0.94, 1.14, 1.1, 1], scaleY: [null, 0.94, 1.14, 1.1, 1], transition: ROAR },
        ...arms([null, 40, 75, 75, 0], ROAR),
        tail: { rotate: [null, 40, 30, 0], transition: ROAR },
      },
    },
    mouths: { trick: 'roar' },
    anchors: { top: [100, 34], side: [144, 60], mouth: [100, 112], body: [100, 142] },
    trickBurst: { kind: 'ring', count: 3, from: 'mouth', delayMs: 380 },
    face: '40 18 120 120',
    antics: ['flex', 'starjump', 'hop', 'bounce', 'lookaround', 'trick', 'happy'],
  },
}

export function profileOf(key: string | null | undefined): BuddyProfile {
  return (key && key in BUDDIES ? BUDDIES[key as BuddyKey] : BUDDIES.kiko)
}
