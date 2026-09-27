/**
 * The buddy as a coach while a child plays. It cheers them past halfway and
 * into the last one, points at the question when they have been on it a
 * while, bounces back with them after a miss, and after two misses in a row
 * offers a way to think about it.
 *
 * Everything it says is about *how* to learn, never about the question, so a
 * buddy can never give an answer away.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { BuddyHandle, Cue } from '@/features/buddies'
import { pick } from '@/features/buddies/voices'

/** On one question this long without an answer: a gentle nudge. */
export const NUDGE_AFTER_MS = 25_000
/** After a new question lands, so the last answer's cheer is heard first. */
export const MILESTONE_DELAY_MS = 1400

export const STRATEGIES = [
  'Rule out the answers you know are wrong.',
  'Read every choice before you pick.',
  'Say the question in your own words.',
  'Look for the most important word in the question.',
  'Picture it in your head first.',
] as const

/** Halfway (in a set of six or more) or the last one (of three or more). */
export function milestone(index: number, total: number): 'halfway' | 'last' | null {
  if (total >= 3 && index === total - 1) return 'last'
  if (total >= 6 && index === Math.floor(total / 2)) return 'halfway'
  return null
}

type BuddyRef = React.RefObject<BuddyHandle | null>

interface Coaching {
  index: number
  total: number
  /** The item on screen is still waiting for the child. */
  waiting: boolean
  readAloud?: boolean
}

/** Milestones as each item appears, and a nudge while one waits too long. */
export function useCoach(buddy: BuddyRef, { index, total, waiting, readAloud = false }: Coaching): void {
  useEffect(() => {
    const reached = milestone(index, total)
    if (!reached) return
    const timer = window.setTimeout(() => buddy.current?.cue(reached), MILESTONE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [buddy, index, total])

  useEffect(() => {
    if (!waiting) return
    const timer = window.setTimeout(() => buddy.current?.cue('nudge', { readAloud }), NUDGE_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [buddy, index, waiting, readAloud])
}

export interface Reply {
  cue: Cue
  strategy?: string
}

/** What to say to a marked answer, remembering the misses before it: a
 *  comeback after a miss, a strategy after two in a row. A streak keeps its
 *  own celebration. */
export function useAnswerCoach(): (correct: boolean, streak: number) => Reply {
  const misses = useRef(0)
  return useCallback((correct: boolean, streak: number): Reply => {
    if (correct) {
      const cameBack = misses.current > 0
      misses.current = 0
      return cameBack && streak < 3 ? { cue: 'comeback' } : { cue: 'correct' }
    }
    misses.current += 1
    return misses.current === 2 ? { cue: 'tough', strategy: pick(STRATEGIES) } : { cue: 'wrong' }
  }, [])
}
