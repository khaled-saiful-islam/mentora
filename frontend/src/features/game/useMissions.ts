/**
 * A game's missions as they are played (§24): which are reached, in how many
 * goes, with which hints asked for — and the points that adds up to, counted
 * the way the server counts them.
 *
 * Each mission the game reports reached is sent on to be kept (`PlayBackend`:
 * the server for a student, the page itself for a maker's preview), and what
 * it taught comes back to be shown. A replay of the missed ones keeps nothing:
 * it is marked here, from what the finished attempt already revealed.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Attempt, GameMission } from '@/features/play/api'
import { usePlayBackend } from '@/features/play/backend'
import { pointsFor, starsOf } from './points'

export interface Outcome {
  reached: boolean
  tries: number
  /** Reached after "Show me" (§25). */
  shown: boolean
  /** What reaching it teaches — shown once it is reached, or the game ends. */
  explanation: string
}

export interface Missions {
  missions: GameMission[]
  outcomes: Record<string, Outcome>
  /** The first mission not yet reached or given up on; null when all are. */
  current: GameMission | null
  points: number
  /** Stars by mission, for those played (§25). */
  stars: Record<string, number>
  hints: Record<string, string>
  reach: (id: string, tries: number, shown?: boolean) => Promise<Outcome | null>
  hint: (id: string) => Promise<string>
  /** End early: every mission left is kept as not reached. */
  giveUp: () => Promise<void>
}

const isMission = (item: Attempt['items'][number]): item is GameMission => 'goal' in item

/** What the attempt already holds — a game picked up again. */
function startingOutcomes(attempt: Attempt): Record<string, Outcome> {
  return Object.fromEntries(
    attempt.answered.map((p) => [p.item_id, { reached: p.correct === true, tries: 1, shown: false, explanation: p.reveal?.explanation ?? '' }]),
  )
}

export function useMissions(attempt: Attempt, { only, practice }: { only?: string[]; practice?: boolean }): Missions {
  const backend = usePlayBackend()
  const missions = useMemo(
    () => attempt.items.filter(isMission).filter((m) => !only || only.includes(m.id)),
    [attempt.items, only],
  )
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(() => (practice ? {} : startingOutcomes(attempt)))
  const [hints, setHints] = useState<Record<string, string>>({})
  const sent = useRef(new Set<string>(Object.keys(outcomes)))
  // What a replay can show without asking anybody: the finished attempt's reveals.
  const known = useMemo(() => startingOutcomes(attempt), [attempt])

  const keep = useCallback((id: string, outcome: Outcome) => setOutcomes((all) => ({ ...all, [id]: outcome })), [])

  const reach = useCallback(
    async (id: string, tries: number, shown = false) => {
      if (sent.current.has(id) || !missions.some((m) => m.id === id)) return null
      sent.current.add(id)
      if (practice) {
        const outcome = { reached: true, tries, shown, explanation: known[id]?.explanation ?? '' }
        keep(id, outcome)
        return outcome
      }
      const result = await backend.answer(attempt.id, { item_id: id, done: true, tries, shown, time_ms: 0 })
      const outcome = { reached: result.played.correct === true, tries, shown, explanation: result.played.reveal?.explanation ?? '' }
      keep(id, outcome)
      return outcome
    },
    [attempt.id, backend, keep, known, missions, practice],
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
    for (const mission of missions) {
      if (sent.current.has(mission.id)) continue
      sent.current.add(mission.id)
      if (practice) {
        keep(mission.id, { reached: false, tries: 1, shown: false, explanation: known[mission.id]?.explanation ?? '' })
        continue
      }
      const result = await backend.answer(attempt.id, { item_id: mission.id, done: false, time_ms: 0 })
      keep(mission.id, { reached: false, tries: 1, shown: false, explanation: result.played.reveal?.explanation ?? '' })
    }
  }, [attempt.id, backend, keep, known, missions, practice])

  const counted = useMemo(
    () =>
      missions
        .filter((m) => outcomes[m.id])
        .map((m) => ({ id: m.id, correct: outcomes[m.id].reached, tries: outcomes[m.id].tries, shown: outcomes[m.id].shown, hinted: m.id in hints, difficulty: m.difficulty })),
    [hints, missions, outcomes],
  )
  const points = pointsFor(counted)
  const stars = Object.fromEntries(counted.map((answer) => [answer.id, starsOf(answer)]))
  const current = missions.find((m) => !outcomes[m.id]) ?? null
  return { missions, outcomes, current, points, stars, hints, reach, hint, giveUp }
}
