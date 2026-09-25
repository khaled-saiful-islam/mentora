import type { MotionValue, TargetAndTransition } from 'motion/react'
import type { MouthShape } from './parts'

export type BuddyKey = 'kiko' | 'bolt' | 'ollie' | 'momo' | 'rimau'

export const BUDDY_KEYS: readonly BuddyKey[] = ['kiko', 'bolt', 'ollie', 'momo', 'rimau']

export function isBuddyKey(value: unknown): value is BuddyKey {
  return typeof value === 'string' && (BUDDY_KEYS as readonly string[]).includes(value)
}

/** How a buddy feels. The screen sets a lasting mood; reactions play a mood
 *  for a moment and it settles back (see `useBuddyMood`). */
export type Mood =
  | 'idle'
  | 'happy'
  | 'cheer'
  | 'oops'
  | 'think'
  | 'dance'
  | 'celebrate'
  | 'sleepy'
  | 'wave'
  | 'trick'
  | 'listen'
  | 'yawn'
  // Hands over the eyes — someone is typing a password.
  | 'shy'
  // The same, with one eye let through: the password is being shown.
  | 'peek'

/** The parts of a rig that move. Every rig wires its own drawing to these,
 *  so one choreography animates five very different bodies. */
export type Joint =
  | 'spin' // the whole character, turning about its middle
  | 'body' // the whole character, pivoting on its feet
  | 'head'
  | 'armL'
  | 'armR'
  | 'earL'
  | 'earR'
  | 'tail'
  | 'extra' // one per rig: a leaf, an antenna, glasses, wings, a crest
  | 'shadow'

export type Moves = Record<Joint, TargetAndTransition>

/** Where the eyes point, -1 … 1 on each axis, as springs. */
export interface Gaze {
  x: MotionValue<number>
  y: MotionValue<number>
}

export interface RigProps {
  mood: Mood
  mouth: MouthShape
  moves: Moves
  gaze: Gaze
  blinking: boolean
  /** Hold still: loops that are part of the drawing (a flame, a light) stop. */
  calm: boolean
}

export type Point = readonly [x: number, y: number]
