/**
 * How each mood moves — a table of joint animations, pure and testable.
 *
 * A rig is a drawing wired to named joints (`types.ts`); this decides what
 * those joints do. Every buddy shares the table, and a buddy's `signature`
 * overrides the moods it does its own way (Bolt hovers instead of breathing,
 * Ollie flutters for its trick).
 *
 * Two rules keep moods from fighting each other:
 *
 * - A joint a mood does not mention goes back to rest. Nothing is left
 *   tilted from the mood before.
 * - A mood that plays for a moment starts from wherever the joint already is
 *   (`null` as the first keyframe) and ends at rest. So a cheer that interrupts
 *   a hop never jumps.
 */

import type { TargetAndTransition, Transition } from 'motion/react'
import type { Joint, Mood, Moves } from './types'

export const JOINTS: readonly Joint[] = [
  'spin',
  'body',
  'head',
  'armL',
  'armR',
  'earL',
  'earR',
  'tail',
  'extra',
  'shadow',
]

export const REST = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 } as const

const SETTLE: Transition = { type: 'spring', stiffness: 210, damping: 19 }
// A full turn ends where it began, so the way back is instant and invisible.
const INSTANT: Transition = { duration: 0 }

type Frames = (number | null)[]
export type Dance = Partial<Record<Joint, TargetAndTransition>>
export type Signature = Partial<Record<Mood, Dance>>

export function loop(duration: number, extra: Transition = {}): Transition {
  return { duration, repeat: Infinity, ease: 'easeInOut', ...extra }
}

export function once(duration: number, extra: Transition = {}): Transition {
  return { duration, ease: 'easeInOut', ...extra }
}

/** Both arms together. The left arm lifts with a positive turn, the right
 *  with a negative one, so a mirrored list keeps them symmetrical. */
export function arms(left: Frames | number, transition: Transition): Dance {
  const right = Array.isArray(left) ? left.map((v) => (v === null ? null : -v)) : -left
  return { armL: { rotate: left, transition }, armR: { rotate: right, transition } }
}

function ears(left: Frames | number, transition: Transition): Dance {
  const right = Array.isArray(left) ? left.map((v) => (v === null ? null : -v)) : -left
  return { earL: { rotate: left, transition }, earR: { rotate: right, transition } }
}

const JUMP_TIMES = [0, 0.1, 0.3, 0.45, 0.55, 0.75, 1]
const FLIP_TIMES = [0, 0.15, 0.5, 0.85, 1]
const CELEBRATE = loop(0.95, { repeatDelay: 0.25, times: [0, 0.15, 0.45, 0.8, 1] })

export const MOVES: Record<Mood, Dance> = {
  idle: {
    body: { scaleY: [1, 1.03, 1], scaleX: [1, 0.99, 1], transition: loop(3.4) },
    head: { rotate: [0, 1.6, 0, -1.6, 0], y: [0, 0.8, 0, 0.8, 0], transition: loop(6.8) },
    ...arms([0, 4, 0], loop(3.4)),
    earL: { rotate: [0, -4, 0], transition: loop(4.4, { delay: 0.3 }) },
    earR: { rotate: [0, 4, 0], transition: loop(4.4) },
    tail: { rotate: [0, 10, 0, -6, 0], transition: loop(2.8) },
    extra: { rotate: [0, 5, 0, -5, 0], transition: loop(3.6) },
    shadow: { scaleX: [1, 1.03, 1], transition: loop(3.4) },
  },
  happy: {
    body: {
      y: [null, -16, 0, -6, 0],
      scaleY: [null, 1.08, 0.92, 1.03, 1],
      scaleX: [null, 0.95, 1.06, 0.99, 1],
      transition: once(0.75),
    },
    head: { rotate: [null, -4, 3, 0], transition: once(0.75) },
    ...arms([null, 50, 20, 0], once(0.75)),
    ...ears([null, -14, 4, 0], once(0.6)),
    tail: { rotate: [null, 24, -14, 20, 0], transition: once(0.7) },
    extra: { rotate: [null, 16, -10, 0], transition: once(0.7) },
    shadow: { scaleX: [null, 0.72, 1.05, 0.9, 1], transition: once(0.75) },
  },
  cheer: {
    body: {
      y: [null, 4, -44, 0, 4, -30, 0],
      scaleY: [null, 0.84, 1.12, 0.88, 0.86, 1.1, 1],
      scaleX: [null, 1.12, 0.92, 1.1, 1.1, 0.94, 1],
      transition: once(1.35, { times: JUMP_TIMES }),
    },
    head: { rotate: [null, -6, 6, -4, 0], transition: once(1.35) },
    ...arms([null, 150, 128, 150, 128, 0], once(1.5)),
    ...ears([null, -18, 0, -18, 0], once(1.3)),
    tail: { rotate: [null, 30, -20, 30, 0], transition: once(1.2) },
    extra: { rotate: [null, 20, -20, 15, 0], transition: once(1.3) },
    shadow: { scaleX: [null, 1.1, 0.5, 1.1, 1.1, 0.65, 1], transition: once(1.35, { times: JUMP_TIMES }) },
  },
  oops: {
    body: { x: [null, -6, 6, -4, 3, 0], scaleY: [null, 0.94, 0.98, 1], transition: once(0.6) },
    head: { rotate: -8, y: 2 },
    ...arms(28, SETTLE),
    ...ears(-22, SETTLE),
    tail: { rotate: -14 },
    extra: { rotate: -20 },
  },
  think: {
    body: { rotate: [-2, -3.5, -2], transition: loop(3) },
    head: { rotate: [-9, -11, -9], transition: loop(3) },
    armL: { rotate: -6 },
    armR: { rotate: 140 }, // across the body, hand to the chin
    earL: { rotate: -6 },
    earR: { rotate: 10 },
    tail: { rotate: [0, 8, 0], transition: loop(2) },
    extra: { rotate: [-6, 6, -6], transition: loop(3) },
  },
  dance: {
    body: { rotate: [0, 8, 0, -8, 0], y: [0, -10, 0, -10, 0], transition: loop(0.9) },
    head: { rotate: [0, -7, 0, 7, 0], transition: loop(0.9) },
    armL: { rotate: [20, 130, 20, 60, 20], transition: loop(0.9) },
    armR: { rotate: [-60, -20, -130, -20, -60], transition: loop(0.9) },
    ...ears([0, -12, 0, -12, 0], loop(0.9)),
    tail: { rotate: [-20, 25, -20], transition: loop(0.45) },
    extra: { rotate: [-15, 15, -15], transition: loop(0.45) },
    shadow: { scaleX: [1, 0.82, 1, 0.82, 1], transition: loop(0.9) },
  },
  celebrate: {
    body: {
      y: [0, 5, -52, 0, 0],
      scaleY: [1, 0.8, 1.14, 0.86, 1],
      scaleX: [1, 1.16, 0.9, 1.12, 1],
      transition: CELEBRATE,
    },
    head: { rotate: [0, -6, 6, 0], transition: loop(1.2) },
    ...arms([140, 165, 140], loop(0.4)),
    ...ears([0, -14, 0], loop(0.6)),
    tail: { rotate: [-25, 25, -25], transition: loop(0.35) },
    extra: { rotate: [-18, 18, -18], transition: loop(0.35) },
    shadow: { scaleX: [1, 1.12, 0.5, 1.1, 1], transition: CELEBRATE },
  },
  sleepy: {
    body: { scaleY: [1, 1.045, 1], transition: loop(4.4) },
    head: { rotate: [9, 12, 9], y: [4, 5, 4], transition: loop(4.4) },
    ...ears(-16, SETTLE),
    extra: { rotate: 14 },
    shadow: { scaleX: [1, 1.04, 1], transition: loop(4.4) },
  },
  wave: {
    body: { rotate: [null, -3, -3, 0], transition: once(1.8) },
    head: { rotate: [null, 6, 6, 0], transition: once(1.8) },
    armR: {
      rotate: [null, -150, -115, -150, -115, -150, 0],
      transition: once(1.8, { times: [0, 0.18, 0.34, 0.5, 0.66, 0.82, 1] }),
    },
    earR: { rotate: [null, 10, 10, 0], transition: once(1.8) },
    tail: { rotate: [null, 18, -10, 18, 0], transition: once(1.4) },
    extra: { rotate: [null, 12, -8, 0], transition: once(1.4) },
  },
  trick: {
    body: {
      y: [null, 6, -58, 0, 0],
      scaleY: [null, 0.8, 1.1, 0.88, 1],
      scaleX: [null, 1.14, 0.94, 1.1, 1],
      transition: once(1.1, { times: FLIP_TIMES }),
    },
    spin: { rotate: [null, 0, -360, -360], transition: once(1.1, { times: [0, 0.2, 0.75, 1] }) },
    ...arms([null, 150, 150, 0], once(1.1)),
    ...ears([null, 20, 20, 0], once(1.1)),
    tail: { rotate: [null, 40, -20, 0], transition: once(1.1) },
    extra: { rotate: [null, -30, 30, 0], transition: once(1.1) },
    shadow: { scaleX: [null, 1.1, 0.45, 1.1, 1], transition: once(1.1, { times: FLIP_TIMES }) },
  },
  listen: {
    body: { rotate: 2 },
    head: { rotate: 10 },
    earL: { rotate: -10 },
    earR: { rotate: 4 },
    tail: { rotate: [0, 14, 0], transition: loop(1.2) },
  },
  yawn: {
    body: {
      scaleY: [null, 1.1, 1.1, 0.96, 1],
      scaleX: [null, 0.95, 0.95, 1.03, 1],
      transition: once(2, { times: [0, 0.3, 0.7, 0.88, 1] }),
    },
    head: { rotate: [null, -6, -6, 0], y: [null, -3, -3, 0], transition: once(2) },
    ...arms([null, 160, 160, 0], once(2, { times: [0, 0.3, 0.7, 1] })),
    ...ears([null, -12, -12, 0], once(2)),
  },
}

/** How long a mood plays when it is a reaction rather than the screen's mood. */
export const HOLD_MS: Record<Mood, number> = {
  idle: 0,
  happy: 1100,
  cheer: 1600,
  oops: 1500,
  think: 2400,
  dance: 3600,
  celebrate: 3200,
  sleepy: 4000,
  wave: 1900,
  trick: 1500,
  listen: 1600,
  yawn: 2100,
}

/** The same move for the other side of the body: turns and sideways
 *  shifts reversed. For a part drawn twice, like a pair of wings. */
export function mirrored(move: TargetAndTransition): TargetAndTransition {
  const flip = (value: unknown) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'number' ? -v : v))
      : typeof value === 'number'
        ? -value
        : value
  const { rotate, x, ...rest } = move as TargetAndTransition & { rotate?: unknown; x?: unknown }
  return { ...rest, rotate: flip(rotate), x: flip(x) } as TargetAndTransition
}

function compose(joint: Joint, target: TargetAndTransition | undefined): TargetAndTransition {
  const settle = joint === 'spin' ? INSTANT : SETTLE
  if (!target) return { ...REST, transition: settle }
  const { transition, ...values } = target
  // Each value this mood moves gets the mood's timing; the rest settle home.
  // A held value in a looping mood settles too, or it would replay forever.
  const timing = (value: unknown) =>
    transition && (Array.isArray(value) || !transition.repeat) ? transition : settle
  const own = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, timing(value)]))
  return { ...REST, ...values, transition: { ...settle, ...own } }
}

/** Every joint's animation for a mood. Calm motion holds every joint at rest
 *  and lets the face alone say how the buddy feels. */
export function choreograph(mood: Mood, signature: Signature = {}, calm = false): Moves {
  const dance: Dance = calm ? {} : { ...MOVES[mood], ...signature[mood] }
  return Object.fromEntries(JOINTS.map((joint) => [joint, compose(joint, dance[joint])])) as Moves
}
