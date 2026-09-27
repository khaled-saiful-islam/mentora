/**
 * Three looks for playing a quiz or flashcards, by school year:
 *
 * - **little** (Year 1–3): a playground — big bright tiles that bob, a star
 *   path for progress, confetti on every right answer, "read it to me", and
 *   words a six-year-old knows.
 * - **middle** (Year 4–6): a quest — tiles with a bold colour edge, the
 *   question in its own card, a rocket riding the progress bar, a sparkle
 *   and points for each right answer, and a rank at the end. Livelier than
 *   the Forms, calmer than the youngest.
 * - **senior** (Form 1–5 and up): the clean, focused look Mentora had.
 *
 * The look is picked for the student from their own year (the set's year
 * when theirs is unknown). A teacher or parent previewing a set can switch
 * between all three. Calm motion always wins: every look keeps still for a
 * child who asked for less movement.
 */
import { createContext, useContext } from 'react'
import { useCalmMotion } from '@/motion'

export type PlayLevel = 'little' | 'middle' | 'senior'

export const LEVELS: { key: PlayLevel; label: string; hint: string }[] = [
  { key: 'little', label: 'Year 1–3', hint: 'Big, bright and bouncy' },
  { key: 'middle', label: 'Year 4–6', hint: 'Lively, with points to win' },
  { key: 'senior', label: 'Form 1–5', hint: 'Clean and focused' },
]

/** "year_2" → little, "year_5" → middle, a Form or anything else → senior. */
export function levelForGrade(grade: string | null | undefined): PlayLevel {
  const year = /^year_(\d)$/.exec(grade ?? '')
  if (!year) return 'senior'
  return Number(year[1]) <= 3 ? 'little' : 'middle'
}

/** The student's own year first; the set's year when theirs is not known. */
export function levelFor(studentGrade: string | null | undefined, setGrade: string | null | undefined): PlayLevel {
  return levelForGrade(studentGrade || setGrade)
}

export interface PlayLook {
  level: PlayLevel
  /** The question or card text. */
  question: string
  /** Answer tiles: the usual white ones, each in its own bright colour, or
   *  white with a bold colour edge. */
  tiles: 'plain' | 'bright' | 'quest'
  /** The question sits in a card of its own. */
  questionCard: boolean
  /** A rocket rides the progress bar to the current question. */
  journey: boolean
  /** Stars burst from a right answer. */
  sparkle: boolean
  /** A title earned at the end: Explorer, Adventurer, Champion. */
  rank: boolean
  /** How tall a tile is, and how big its words. */
  tileSize: string
  tileText: string
  /** The shape on each tile bobs while it waits to be picked. */
  bob: boolean
  /** Confetti on every right answer, not only on a streak. */
  cheerEveryRight: boolean
  /** "+10" for a right answer, and a running score in the header. */
  points: boolean
  /** A path of stars for progress, instead of the bar. */
  starPath: boolean
  /** Behind the game: shapes drifting, a quiet dotted grid, or nothing. */
  backdrop: 'drift' | 'grid' | 'none'
  /** A button that reads the question or card aloud. */
  readAloud: boolean
  /** A photo beside each question or card, where one was found that fits. */
  pictures: boolean
  /** What the verdict says. */
  rightWords: string[]
  wrongWords: string[]
  /** The finish screen's fanfare: confetti from this many stars, this big. */
  confettiFrom: number
  confettiPower: number
}

const LOOKS: Record<PlayLevel, Omit<PlayLook, 'level'>> = {
  little: {
    question: 'font-celebrate text-3xl leading-snug md:text-4xl',
    tiles: 'bright',
    questionCard: false,
    journey: false,
    sparkle: false,
    rank: false,
    tileSize: 'min-h-24',
    tileText: 'text-xl',
    bob: true,
    cheerEveryRight: true,
    points: false,
    starPath: true,
    backdrop: 'drift',
    readAloud: true,
    pictures: true,
    rightWords: ['Yay! You got it!', 'Woohoo!', 'Super star!', 'You did it!'],
    wrongWords: ['Oops! Nice try!', 'Almost there!', 'Good try!'],
    confettiFrom: 1,
    confettiPower: 1.5,
  },
  middle: {
    question: 'font-display text-2xl leading-snug font-bold md:text-3xl',
    tiles: 'quest',
    questionCard: true,
    journey: true,
    sparkle: true,
    rank: true,
    tileSize: 'min-h-20',
    tileText: 'text-lg',
    bob: false,
    cheerEveryRight: false,
    points: true,
    starPath: false,
    backdrop: 'grid',
    readAloud: false,
    pictures: false,
    rightWords: ['Correct!', 'Nailed it!', 'Spot on!'],
    wrongWords: ['Not quite', 'So close!'],
    confettiFrom: 2,
    confettiPower: 1.1,
  },
  senior: {
    question: 'font-display text-2xl leading-snug font-semibold md:text-3xl',
    tiles: 'plain',
    questionCard: false,
    journey: false,
    sparkle: false,
    rank: false,
    tileSize: 'min-h-20',
    tileText: 'text-lg',
    bob: false,
    cheerEveryRight: false,
    points: false,
    starPath: false,
    backdrop: 'none',
    readAloud: false,
    pictures: false,
    rightWords: ['Correct!'],
    wrongWords: ['Not quite'],
    confettiFrom: 2,
    confettiPower: 1,
  },
}

export function lookFor(level: PlayLevel, calm = false): PlayLook {
  const look = { level, ...LOOKS[level] }
  // Asked for less movement: keep the colour and the words, drop the motion.
  const still = look.backdrop === 'drift' ? 'none' : look.backdrop
  return calm ? { ...look, bob: false, backdrop: still, cheerEveryRight: false, sparkle: false, journey: false } : look
}

/** Points for a first-try result: ten a right answer. */
export const POINTS_EACH = 10

/** The title a Year 4–6 player earns for a score. */
export function rankFor(percent: number): string {
  if (percent >= 90) return 'Champion'
  if (percent >= 70) return 'Adventurer'
  if (percent >= 40) return 'Explorer'
  return 'Rookie'
}

const LevelContext = createContext<PlayLevel>('senior')

export const PlayLevelProvider = LevelContext.Provider

export function usePlayLevel(): PlayLevel {
  return useContext(LevelContext)
}

export function usePlayLook(): PlayLook {
  return lookFor(usePlayLevel(), useCalmMotion())
}

/** One of `words`, the same one each time for the same `seed`. */
export function pick(words: string[], seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return words[Math.abs(hash) % words.length]
}
