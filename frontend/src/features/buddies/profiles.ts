/**
 * The five study buddies. Adding a sixth is a rig in `rigs/`, a voice in
 * `voices.ts`, colours in theme.css and one entry here — and the backend's
 * list in `app/core/buddies.py`.
 */
import type { ComponentType } from 'react'
import { arms, loop, once, type Signature } from './choreography'
import type { MouthShape } from './parts'
import type { ParticleKind } from './particles'
import { BoltRig } from './rigs/Bolt'
import { KikoRig } from './rigs/Kiko'
import { MomoRig } from './rigs/Momo'
import { OllieRig } from './rigs/Ollie'
import { RimauRig } from './rigs/Rimau'
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
}

const PUFF = once(1.4, { times: [0, 0.3, 0.45, 0.85, 1] })
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
  },
  bolt: {
    key: 'bolt',
    name: 'Bolt',
    species: 'robot',
    tagline: 'A hovering robot who beeps with joy at every right answer.',
    trick: 'Top spin',
    Rig: BoltRig,
    signature: {
      idle: {
        body: { y: [0, -5, 0], transition: loop(2.4) },
        shadow: { scaleX: [1, 0.84, 1], transition: loop(2.4) },
      },
      sleepy: { body: { y: 7 }, shadow: { scaleX: 1.08 } },
      trick: {
        spin: NO_SPIN,
        body: {
          scaleX: [null, 0.1, -1, 0.1, 1, 0.1, -1, 0.1, 1],
          y: [null, -20, -24, -24, -24, -24, -24, -20, 0],
          transition: once(1.3),
        },
        extra: { rotate: [null, 25, -25, 25, 0], transition: once(1.3) },
      },
    },
    mouths: { trick: 'o' },
    anchors: { top: [100, 22], side: [142, 54], mouth: [100, 98], body: [100, 142] },
    trickBurst: { kind: 'bolt', count: 8, from: 'top', delayMs: 150 },
    face: '40 14 120 120',
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
  },
  momo: {
    key: 'momo',
    name: 'Momo',
    species: 'baby dragon',
    tagline: 'A baby dragon whose flames come out as sparkles.',
    trick: 'Puff',
    Rig: MomoRig,
    signature: {
      idle: { extra: { rotate: [0, -10, 0], transition: loop(1.8) } },
      trick: {
        spin: NO_SPIN,
        head: { rotate: [null, -14, 10, 10, 0], transition: PUFF },
        body: { scaleY: [null, 1.08, 0.94, 0.96, 1], scaleX: [null, 0.96, 1.05, 1.03, 1], transition: PUFF },
        ...arms([null, 30, 60, 60, 0], PUFF),
        extra: { rotate: [null, -30, 5, -30, 0], transition: PUFF },
      },
    },
    mouths: { trick: 'roar' },
    anchors: { top: [100, 28], side: [140, 56], mouth: [112, 112], body: [100, 142] },
    trickBurst: { kind: 'flame', count: 7, from: 'mouth', delayMs: 500 },
    face: '36 18 128 128',
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
  },
}

export function profileOf(key: string | null | undefined): BuddyProfile {
  return (key && key in BUDDIES ? BUDDIES[key as BuddyKey] : BUDDIES.kiko)
}
