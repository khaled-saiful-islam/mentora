/**
 * A game's islands as they are played (§26): which are cleared, in how many
 * goes, with which hints asked for — and the points and stars that adds up
 * to, counted the way the server counts them.
 *
 * Each island its round reports cleared is sent on to be kept (`PlayBackend`:
 * the server for a student, the page itself for a maker's preview), with the
 * pieces slipped on the way, and what it taught comes back to be shown. A
 * replay of the missed ones keeps nothing: it is marked here, from what the
 * finished attempt already revealed.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Attempt, GameIsland } from '@/features/play/api'
import { usePlayBackend } from '@/features/play/backend'
import { pointsFor, starsOf } from './points'

export interface Outcome {
  reached: boolean
  tries: number
  /** Cleared after "Show me" (§25). */
  shown: boolean
  /** What clearing it teaches — shown once it is cleared, or the game ends. */
  explanation: string
}

export interface Islands {
  islands: GameIsland[]
  outcomes: Record<string, Outcome>
  /** The first island not yet cleared or given up on; null when all are. */
  current: GameIsland | null
  points: number
  /** Stars by island, for those played (§25). */
  stars: Record<string, number>
  hints: Record<string, string>
  reach: (id: string, tries: number, shown?: boolean, slips?: string[]) => Promise<Outcome | null>
  hint: (id: string) => Promise<string>
  /** End early: every island left is kept as not cleared. */
  giveUp: () => Promise<void>
}

const isIsland = (item: Attempt['items'][number]): item is GameIsland => 'play' in item

/** What the attempt already holds — a game picked up again. */
function startingOutcomes(attempt: Attempt): Record<string, Outcome> {
  return Object.fromEntries(
    attempt.answered.map((p) => [p.item_id, { reached: p.correct === true, tries: 1, shown: false, explanation: p.reveal?.explanation ?? '' }]),
  )
}

export function useIslands(attempt: Attempt, { only, practice }: { only?: string[]; practice?: boolean }): Islands {
  const backend = usePlayBackend()
  const islands = useMemo(
    () => attempt.items.filter(isIsland).filter((m) => !only || only.includes(m.id)),
    [attempt.items, only],
  )
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(() => (practice ? {} : startingOutcomes(attempt)))
  const [hints, setHints] = useState<Record<string, string>>({})
  const sent = useRef(new Set<string>(Object.keys(outcomes)))
  // What a replay can show without asking anybody: the finished attempt's reveals.
  const known = useMemo(() => startingOutcomes(attempt), [attempt])

  const keep = useCallback((id: string, outcome: Outcome) => setOutcomes((all) => ({ ...all, [id]: outcome })), [])

  const reach = useCallback(
    async (id: string, tries: number, shown = false, slips: string[] = []) => {
      if (sent.current.has(id) || !islands.some((m) => m.id === id)) return null
      sent.current.add(id)
      if (practice) {
        const outcome = { reached: true, tries, shown, explanation: known[id]?.explanation ?? '' }
        keep(id, outcome)
        return outcome
      }
      const result = await backend.answer(attempt.id, { item_id: id, done: true, tries, shown, slips, time_ms: 0 })
      const outcome = { reached: result.played.correct === true, tries, shown, explanation: result.played.reveal?.explanation ?? '' }
      keep(id, outcome)
      return outcome
    },
    [attempt.id, backend, keep, known, islands, practice],
  )

  const hint = useCallback(
    async (id: string) => {
      const told = hints[id] ?? (await backend.hint(attempt.id, id))
      setHints((all) => ({ ...all, [id]: told }))
      return told
    },
    [attempt.id, backend, hints],
  )

  const giveUp = useCallback(async () => {
    for (const island of islands) {
      if (sent.current.has(island.id)) continue
      sent.current.add(island.id)
      if (practice) {
        keep(island.id, { reached: false, tries: 1, shown: false, explanation: known[island.id]?.explanation ?? '' })
        continue
      }
      const result = await backend.answer(attempt.id, { item_id: island.id, done: false, time_ms: 0 })
      keep(island.id, { reached: false, tries: 1, shown: false, explanation: result.played.reveal?.explanation ?? '' })
    }
  }, [attempt.id, backend, keep, known, islands, practice])

  const counted = useMemo(
    () =>
      islands
        .filter((m) => outcomes[m.id])
        .map((m) => ({ id: m.id, correct: outcomes[m.id].reached, tries: outcomes[m.id].tries, shown: outcomes[m.id].shown, hinted: m.id in hints, difficulty: m.difficulty })),
    [hints, islands, outcomes],
  )
  const points = pointsFor(counted)
  const stars = Object.fromEntries(counted.map((answer) => [answer.id, starsOf(answer)]))
  const current = islands.find((m) => !outcomes[m.id]) ?? null
  return { islands, outcomes, current, points, stars, hints, reach, hint, giveUp }
}
