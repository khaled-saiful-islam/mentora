/**
 * A buddy that grows as its student learns (§28.3.1): a tiny baby animal at
 * first — big head, big eyes, wobbly — then a little one, a young one, and
 * grown. The server counts the growth; this says what each stage looks like
 * and which moves it can show off.
 *
 * Only the show-off moves are earned. The reactions that help a child learn —
 * thinking while they answer, an *oops* on a miss, a cheer on a right
 * answer — play at every stage.
 */
import type { BuddyKey, Mood } from './types'

export type Stage = 0 | 1 | 2 | 3
export const GROWN: Stage = 3
export const STAGES: readonly Stage[] = [0, 1, 2, 3]

/** The growth at which each stage begins — as `app/growth/rules.py`. */
export const STAGE_AT: Readonly<Record<Stage, number>> = { 0: 0, 1: 40, 2: 200, 3: 600 }

export const STAGE_NAMES: Readonly<Record<Stage, string>> = {
  0: 'Newborn',
  1: 'Little one',
  2: 'Young',
  3: 'Grown',
}

/** The stage a total of growth has reached. */
export function stageFor(points: number): Stage {
  return [...STAGES].reverse().find((stage) => points >= STAGE_AT[stage]) ?? 0
}

export function isStage(value: unknown): value is Stage {
  return value === 0 || value === 1 || value === 2 || value === 3
}

/** How a stage is drawn: the whole body, the head on it, and the eyes, as
 *  shares of the grown buddy. A baby is small with a big head and big eyes. */
export interface Look {
  body: number
  head: number
  eyes: number
  /** A baby's wobble, in degrees each way. */
  wobble: number
}

export const LOOK: Readonly<Record<Stage, Look>> = {
  0: { body: 0.62, head: 1.24, eyes: 1.16, wobble: 2.4 },
  1: { body: 0.74, head: 1.15, eyes: 1.1, wobble: 1.2 },
  2: { body: 0.87, head: 1.07, eyes: 1.04, wobble: 0 },
  3: { body: 1, head: 1, eyes: 1, wobble: 0 },
}

/** What each buddy is called as a baby and grown — "a tiny owlet". */
export const ANIMAL: Readonly<Record<BuddyKey, { baby: string; grown: string }>> = {
  kiko: { baby: 'kancil fawn', grown: 'kancil' },
  tompok: { baby: 'kitten', grown: 'cat' },
  ollie: { baby: 'owlet', grown: 'owl' },
  momo: { baby: 'baby orangutan', grown: 'orangutan' },
  rimau: { baby: 'tiger cub', grown: 'tiger' },
}

/** "a tiny owlet", "a young owl". */
export function described(buddy: BuddyKey, stage: Stage): string {
  const { baby, grown } = ANIMAL[buddy]
  return [`a tiny ${baby}`, `a little ${baby}`, `a young ${grown}`, `a grown-up ${grown}`][stage]
}

/** The stage each show-off move is learned at. A move not listed is a
 *  reaction, there from the start. */
export const LEARNED_AT: Readonly<Partial<Record<Mood, Stage>>> = {
  yawn: 0,
  wiggle: 0,
  nod: 0,
  giggle: 0,
  sleepy: 0,
  think: 0,
  wave: 1,
  hop: 1,
  lookaround: 1,
  listen: 1,
  hug: 1,
  happy: 1,
  dance: 2,
  bounce: 2,
  stretch: 2,
  twirl: 2,
  clap: 2,
  celebrate: 2,
  starjump: 3,
  flex: 3,
  trick: 3,
}

export function knows(mood: Mood, stage: Stage): boolean {
  return (LEARNED_AT[mood] ?? 0) <= stage
}

/** What each move is called, to a child. A buddy's own trick is its name. */
export const MOVE_NAMES: Readonly<Partial<Record<Mood, string>>> = {
  yawn: 'Yawn',
  wiggle: 'Wiggle',
  nod: 'Nod',
  giggle: 'Giggle',
  sleepy: 'Nap',
  think: 'Think',
  wave: 'Wave',
  hop: 'Hop',
  lookaround: 'Look around',
  listen: 'Listen',
  hug: 'Hug',
  happy: 'Smile',
  dance: 'Dance',
  bounce: 'Bounce',
  stretch: 'Stretch',
  twirl: 'Twirl',
  clap: 'Clap',
  celebrate: 'Cheer',
  starjump: 'Star jump',
  flex: 'Flex',
}

/** The moves learned after `from` up to `to` — what growing up unlocked. */
export function learnedBetween(from: Stage, to: Stage): Mood[] {
  return STAGES.filter((stage) => stage > from && stage <= to).flatMap(learnedAt)
}

/** The moves learned at exactly this stage — what growing up unlocks. */
export function learnedAt(stage: Stage): Mood[] {
  return (Object.keys(LEARNED_AT) as Mood[]).filter((mood) => LEARNED_AT[mood] === stage)
}

// A baby that knows none of its buddy's own habits still fidgets like a baby.
const BABY_ANTICS: readonly Mood[] = ['yawn', 'wiggle', 'nod', 'giggle']

/** A buddy's fidgets, as many as it has learned. */
export function anticsFor(antics: readonly Mood[], stage: Stage): readonly Mood[] {
  const known = antics.filter((mood) => knows(mood, stage))
  return known.length ? known : BABY_ANTICS
}

/** What a tap does before the signature trick is learned: the best move it
 *  knows so far. */
export const TAP_MOVE: Readonly<Record<Stage, Mood>> = {
  0: 'giggle',
  1: 'hop',
  2: 'dance',
  3: 'trick',
}

/** Where a point of a grown buddy's drawing is on a smaller one, shrunk
 *  about its feet — for sparkles that start at its head. */
export function shrunk([x, y]: readonly [number, number], stage: Stage, feet = 186): [number, number] {
  const s = LOOK[stage].body
  return [100 + (x - 100) * s, feet + (y - feet) * s]
}
