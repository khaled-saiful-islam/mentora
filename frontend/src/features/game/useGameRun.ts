/**
 * Playing a game: the run (`run.ts`) wired to wherever answers go — the
 * server for a student, the page for a teacher's preview (`PlayBackend`).
 *
 * Each challenge is "opened" as it appears, so the server can time its speed
 * bonus; a hint is asked for, never sent ahead, so asking is what costs
 * points; a timer that runs out sends that, so the answer is still revealed
 * and explained. The points shown as the game goes are worked out the
 * server's way (`points.ts`) — the finish screen shows the server's own.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { GameExtras } from '@/features/learning/api'
import type { Attempt, GameChallenge, Played } from '@/features/play/api'
import { usePlayBackend, type AnswerBody } from '@/features/play/backend'
import { chaptersOf, type Chapter } from './chapters'
import { earned, pointsFor } from './points'
import { advance, startRun, type Layout, type RunEvent, type RunState } from './run'

export interface GameRun {
  state: RunState
  dispatch: (event: RunEvent) => void
  layout: Layout
  chapters: Chapter<GameChallenge>[]
  items: GameChallenge[]
  extras: Partial<GameExtras>
  /** The challenge on screen (or just answered), if any. */
  current: GameChallenge | null
  /** What was played on it, once answered. */
  outcome: Played | null
  sending: boolean
  /** The buddy's hint for the current challenge, once asked for. */
  hint: string | null
  /** Points the last answer earned, for the "+120" that pops up. */
  lastEarned: number
  choose: (choice: number) => Promise<Played | null>
  timeUp: () => Promise<Played | null>
  askHint: () => Promise<string | null>
  /** The last challenge of the game: the boss. */
  isBoss: (index: number) => boolean
}

export const isGameChallenge = (item: unknown): item is GameChallenge =>
  typeof item === 'object' && item !== null && 'options' in item && 'prompt' in item

export function useGameRun(attempt: Attempt, onError: (error: unknown) => void): GameRun {
  const backend = usePlayBackend()
  const items = useMemo(() => attempt.items.filter(isGameChallenge), [attempt.items])
  const extras = attempt.extras as Partial<GameExtras>
  const chapters = useMemo(() => chaptersOf(items, extras), [items, extras])
  const layout = useMemo<Layout>(() => ({ ids: items.map((i) => i.id), chapters }), [items, chapters])
  const seconds = attempt.timer_seconds ?? null
  const [state, dispatch] = useReducer(
    (s: RunState, e: RunEvent) => advance(layout, s, e),
    undefined,
    () => startRun(layout, attempt.answered, resumedPoints(items, attempt.answered)),
  )
  const [sending, setSending] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [lastEarned, setLastEarned] = useState(0)
  const shownAt = useRef(Date.now())
  // One answer at a time, even when a drag and a tap land together.
  const inFlight = useRef(false)

  const { phase } = state
  const index = phase.name === 'challenge' || phase.name === 'reveal' ? phase.index : -1
  const current = index >= 0 ? items[index] ?? null : null
  const outcome = current ? state.played[current.id] ?? null : null

  // A new challenge on screen: its clock starts, here and on the server.
  const openId = phase.name === 'challenge' ? current?.id : undefined
  useEffect(() => {
    if (!openId) return
    shownAt.current = Date.now()
    setHint(null)
    backend.open(attempt.id, openId).catch(() => {
      // Only the speed bonus depends on it; the game plays on without.
    })
  }, [openId, attempt.id, backend])

  const send = useCallback(
    async (body: Omit<AnswerBody, 'item_id' | 'time_ms'>): Promise<Played | null> => {
      if (!current || phase.name !== 'challenge' || inFlight.current) return null
      inFlight.current = true
      setSending(true)
      try {
        const timeMs = Date.now() - shownAt.current
        const result = await backend.answer(attempt.id, { item_id: current.id, time_ms: timeMs, ...body })
        const gained = earned(
          { correct: result.played.correct === true, timeMs, hinted: state.hinted.includes(current.id), difficulty: current.difficulty },
          result.streak,
          seconds,
        )
        setLastEarned(gained)
        dispatch({ type: 'answered', played: result.played, earned: gained, streak: result.streak })
        return result.played
      } catch (error) {
        onError(error)
        return null
      } finally {
        inFlight.current = false
        setSending(false)
      }
    },
    [current, phase.name, backend, attempt.id, state.hinted, seconds, onError],
  )

  const choose = useCallback((choice: number) => send({ choice }), [send])
  const timeUp = useCallback(() => send({ timed_out: true }), [send])

  const askHint = useCallback(async () => {
    if (!current || !current.has_hint || phase.name !== 'challenge') return null
    try {
      const told = await backend.hint(attempt.id, current.id)
      setHint(told)
      dispatch({ type: 'hinted', itemId: current.id })
      return told
    } catch (error) {
      onError(error)
      return null
    }
  }, [current, phase.name, backend, attempt.id, onError])

  const isBoss = useCallback((i: number) => items.length > 2 && i === items.length - 1, [items.length])

  return { state, dispatch, layout, chapters, items, extras, current, outcome, sending, hint, lastEarned, choose, timeUp, askHint, isBoss }
}

/** Points so far for a game picked up again: what its right answers earned,
 *  without the speed bonus a reload cannot know about. */
function resumedPoints(items: GameChallenge[], answered: Played[]): number {
  const difficulty = Object.fromEntries(items.map((i) => [i.id, i.difficulty]))
  return pointsFor(
    answered.map((p) => ({ correct: p.correct === true, timeMs: 0, hinted: false, difficulty: difficulty[p.item_id] ?? 'medium' })),
    null,
  )
}
