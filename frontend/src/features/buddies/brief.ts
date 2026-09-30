/**
 * What a student's buddy knows about them (`GET /api/me/buddy`,
 * `backend/app/services/buddy_brief.py`): what is waiting and when it is
 * due, their streak and badges, strengths and what needs practice, how each
 * kind of set has gone lately, and their next live lesson. Kept fresh by the
 * same pushes that move their home page.
 */
import { useResource } from '@/hooks/useResource'
import { apiFetch } from '@/lib/api'
import { useLive } from '@/lib/bus'

export type BriefKind = 'quiz' | 'flashcard' | 'study_guide'

export interface BriefWaiting {
  title: string
  kind: string
  due_at: string | null
  overdue: boolean
}

export interface KindRecord {
  kind: BriefKind
  /** Average percent over the latest tries of this kind. */
  average: number
  count: number
}

export interface BuddyBrief {
  name: string
  streak: number
  badges: number
  waiting: BriefWaiting[]
  waiting_count: number
  overdue: number
  due_soon: number
  strengths: string[]
  practise: string[]
  recent: { title: string; kind: string; percent: number }[]
  kinds: KindRecord[]
  next_lesson: { id: string; title: string; status: string; scheduled_at: string | null } | null
}

export const briefApi = {
  mine: () => apiFetch<BuddyBrief>('/me/buddy'),
}

/** What changes the brief: work shared or finished, results, live lessons. */
const MOVES_IT = ['assignments', 'progress', 'live'] as const

export function useBuddyBrief(enabled: boolean): BuddyBrief | null {
  const brief = useResource(enabled ? 'buddy-brief' : null, () => briefApi.mine())
  useLive(MOVES_IT, () => {
    if (enabled) void brief.reload()
  })
  return brief.data
}
