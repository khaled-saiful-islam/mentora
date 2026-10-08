/**
 * A game's points (§24) — the same sums the server does in
 * `app/learning/game.py`, so the score a child watches climb is the score
 * they get. The server's is the one that counts; this one drives the live
 * counter and a maker's preview, where nothing reaches the server.
 *
 * A mission reached is worth more the harder it is, and more again on the
 * first go; asking the buddy for its hint costs a little. A mission not
 * reached scores nothing, never less.
 */

export const POINTS = {
  mission: 100,
  harder: { easy: 0, medium: 25, hard: 50 } as Record<string, number>,
  firstGo: 25,
  hint: 40,
} as const

export interface Answered {
  correct: boolean
  hinted: boolean
  difficulty: string
  /** Goes it took, the one that reached it included. */
  tries: number
}

/** What one mission earns. */
export function earned(answer: Answered): number {
  if (!answer.correct) return 0
  let points = POINTS.mission + (POINTS.harder[answer.difficulty] ?? 0)
  if (answer.tries <= 1) points += POINTS.firstGo
  if (answer.hinted) points -= POINTS.hint
  return Math.max(points, 0)
}

export function pointsFor(answered: Answered[]): number {
  return answered.reduce((total, answer) => total + earned(answer), 0)
}
