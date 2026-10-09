/**
 * A game's questions for revision (§26.8) — the Streak Ladder and
 * Tug-of-War — made from what every game already has: each island's pairs
 * (the left side asks, its right side answers, and other right sides from the
 * game are the wrong options) and its Boss Battle's questions. Nothing new is
 * written for them, so any game can be revised.
 */
import { shuffled, type Shuffler } from '../rounds/shuffle'
import type { BossContent, MatchContent } from '../rounds/types'

export interface Question {
  id: string
  ask: string
  options: string[]
  answer: number
  why: string
  /** How hard: 1 easy, 2 medium, 3 hard — the ladder and the rope climb it. */
  level: number
}

export interface Revisable {
  id: string
  match?: MatchContent
  boss?: BossContent
  difficulty?: string
}

const LEVELS: Record<string, number> = { easy: 1, medium: 2, hard: 3 }
// Wrong options beside the right one, at most.
const MOST_WRONG = 3

/** A level from the island's difficulty, a little higher in the second half of the game. */
function levelOf(island: Revisable, n: number, total: number): number {
  const base = LEVELS[island.difficulty ?? ''] ?? 2
  const later = total > 1 && n >= total / 2 ? 1 : 0
  return Math.min(3, base + later)
}

/** The right side first, then up to three other right sides, shuffled together. */
function withOptions(right: string, others: string[], shuffle: Shuffler): { options: string[]; answer: number } {
  const wrong = shuffle(others.filter((other) => other.toLowerCase() !== right.toLowerCase())).slice(0, MOST_WRONG)
  const options = shuffle([right, ...wrong])
  return { options, answer: options.indexOf(right) }
}

function fromPairs(islands: Revisable[], shuffle: Shuffler): Question[] {
  const rights = [...new Set(islands.flatMap((island) => island.match?.pairs.map((pair) => pair.right) ?? []))]
  return islands.flatMap((island, n) =>
    (island.match?.pairs ?? []).map((pair) => ({
      id: `${island.id}:${pair.id}`,
      ask: pair.left,
      ...withOptions(pair.right, rights, shuffle),
      why: pair.why,
      level: levelOf(island, n, islands.length),
    })),
  )
}

function fromBosses(islands: Revisable[]): Question[] {
  return islands.flatMap((island) =>
    (island.boss?.questions ?? [])
      .filter((q) => q.answer >= 0 && q.answer < q.options.length)
      .map((q) => ({ id: `${island.id}:${q.id}`, ask: q.ask, options: [...q.options], answer: q.answer, why: q.why, level: 3 })),
  )
}

/** Every question the game can ask, each `ask` once, easiest first. */
export function questionsOf(islands: Revisable[], shuffle: Shuffler = shuffled): Question[] {
  const seen = new Set<string>()
  const all = [...fromPairs(islands, shuffle), ...fromBosses(islands)].filter((q) => {
    const key = q.ask.trim().toLowerCase()
    if (q.options.length < 2 || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return [...all].sort((a, b) => a.level - b.level)
}
