/**
 * Three looks for playing a quiz or flashcards, by school year:
 *
 * - **little** (Year 1–3): a playground — big bright tiles that bob, a star
 *   path for progress, confetti on every right answer, "read it to me", and
 *   words a six-year-old knows.
 * - **middle** (Year 4–6): lively but calmer — points to win on each right
 *   answer, the usual tiles and progress bar.
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
  /** Answer tiles: the usual white ones, or each in its own bright colour. */
  tiles: 'plain' | 'bright'
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
  /** Shapes drifting behind the game. */
  backdrop: boolean
  /** A button that reads the question or card aloud. */
  readAloud: boolean
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
    tileSize: 'min-h-24',
    tileText: 'text-xl',
    bob: true,
    cheerEveryRight: true,
    points: false,
    starPath: true,
    backdrop: true,
    readAloud: true,
    rightWords: ['Yay! You got it!', 'Woohoo!', 'Super star!', 'You did it!'],
    wrongWords: ['Oops! Nice try!', 'Almost there!', 'Good try!'],
    confettiFrom: 1,
    confettiPower: 1.5,
  },
  middle: {
    question: 'font-display text-2xl leading-snug font-semibold md:text-3xl',
    tiles: 'plain',
    tileSize: 'min-h-20',
    tileText: 'text-lg',
    bob: false,
    cheerEveryRight: false,
    points: true,
    starPath: false,
    backdrop: false,
    readAloud: false,
    rightWords: ['Correct!', 'Nailed it!', 'Spot on!'],
    wrongWords: ['Not quite', 'So close!'],
    confettiFrom: 2,
    confettiPower: 1.1,
  },
  senior: {
    question: 'font-display text-2xl leading-snug font-semibold md:text-3xl',
    tiles: 'plain',
    tileSize: 'min-h-20',
    tileText: 'text-lg',
    bob: false,
    cheerEveryRight: false,
    points: false,
    starPath: false,
    backdrop: false,
    readAloud: false,
    rightWords: ['Correct!'],
    wrongWords: ['Not quite'],
    confettiFrom: 2,
    confettiPower: 1,
  },
}

export function lookFor(level: PlayLevel, calm = false): PlayLook {
  const look = { level, ...LOOKS[level] }
  // Asked for less movement: keep the colour and the words, drop the motion.
  return calm ? { ...look, bob: false, backdrop: false, cheerEveryRight: false } : look
}

/** Points for a first-try result: ten a right answer. */
export const POINTS_EACH = 10

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
