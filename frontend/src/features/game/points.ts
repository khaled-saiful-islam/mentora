/**
 * A game's points (§23) — the same sums the server does in
 * `app/learning/game.py`, so the score a child watches climb is the score
 * they get. The server's is the one that counts; this one drives the live
 * counter and a teacher's preview, where nothing reaches the server.
 *
 * A right answer is worth more the harder it is; a run of them builds a
 * combo; a quick one earns a speed bonus when the game is timed; asking the
 * buddy for a hint costs a little. A wrong answer scores nothing, never less.
 */
import type { Level } from '@/features/learning/api'

export const POINTS = {
  right: 100,
  harder: { easy: 0, medium: 25, hard: 50 } as Record<string, number>,
  comboStep: 10,
  comboMost: 50,
  speedMost: 50,
  hint: 40,
  /** An answer quicker than this earns what a one-second answer does. */
  quickestMs: 1000,
} as const

export interface Answered {
  correct: boolean
  timeMs: number
  hinted: boolean
  difficulty: string
}

/** How long a challenge's timer runs: the year's quick-check time (30 / 20 /
 *  15 s, as in a live lesson) — none for beginners. Mirrors `check_size`. */
export function secondsFor(gradeLevel: string | null | undefined, level: Level | null | undefined): number | null {
  if (level === 'beginner') return null
  const code = gradeLevel ?? ''
  const year = /^year_(\d)$/.exec(code)
  if (year) return Number(year[1]) <= 3 ? 30 : 20
  if (/^(form_|lower_|upper_)/.test(code)) return 15
  return 20
}

/** What one right answer earns, given the run it extends. */
export function earned(answer: Answered, streak: number, seconds: number | null): number {
  if (!answer.correct) return 0
  let points = POINTS.right + (POINTS.harder[answer.difficulty] ?? 0)
  points += Math.min(POINTS.comboStep * (streak - 1), POINTS.comboMost)
  if (seconds) {
    const taken = Math.max(answer.timeMs, POINTS.quickestMs) / (seconds * 1000)
    // Halves round up, as the server's count does.
    points += Math.floor(POINTS.speedMost * Math.max(0, 1 - taken) + 0.5)
  }
  if (answer.hinted) points -= POINTS.hint
  return Math.max(points, 0)
}

export function pointsFor(answered: Answered[], seconds: number | null): number {
  let total = 0
  let streak = 0
  for (const answer of answered) {
    streak = answer.correct ? streak + 1 : 0
    total += earned(answer, streak, seconds)
  }
  return total
}
