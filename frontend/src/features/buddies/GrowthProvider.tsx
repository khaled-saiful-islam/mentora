/**
 * The signed-in student's buddy growth (§28.3.1): how grown, how far to the
 * next stage, what is not celebrated yet, and the buddies met so far.
 *
 * Loaded once and again whenever the student comes back to the tab, and on
 * `refresh()` after they finish something. The last stage seen is kept on
 * this device, so a buddy is drawn at its size from the first frame instead
 * of growing out of nothing on every page load.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/user'
import { isStage, type Stage } from './growth'

export interface Growth {
  points: number
  stage: number
  stage_at: number
  next_at: number | null
  seen_points: number
  arrived: boolean
  grew: boolean
  met: string[]
  badges: number
  badges_for_next: number | null
  may_meet: number
  skills_mastered: number
}

interface GrowthValue {
  /** Whether the signed-in person has a buddy that grows: a student. */
  student: boolean
  userId: string | undefined
  growth: Growth | null
  /** Ask again — after finishing something. Resolves with the new growth. */
  refresh: () => Promise<Growth | null>
  /** The arrival and the growth so far are celebrated: not shown again. */
  seen: () => Promise<void>
}

const GrowthContext = createContext<GrowthValue | null>(null)

// Coming back to the tab asks again, but not more often than this.
const REFRESH_EVERY_MS = 30_000

const KEY = (userId: string) => `mentora:buddy-stage:${userId}`

function remembered(userId: string | undefined): Stage | undefined {
  if (!userId) return undefined
  try {
    const stage = Number(window.localStorage.getItem(KEY(userId)))
    return isStage(stage) ? stage : undefined
  } catch {
    return undefined
  }
}

function remember(userId: string, stage: number): void {
  try {
    window.localStorage.setItem(KEY(userId), String(stage))
  } catch {
    // No storage: the buddy is drawn grown until the growth arrives.
  }
}

export function GrowthProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const student = can(user, 'take_assignments')
  const userId = user?.id
  const [growth, setGrowth] = useState<Growth | null>(null)
  const asked = useRef(0)

  const refresh = useCallback(async () => {
    if (!student || !userId) return null
    asked.current = Date.now()
    try {
      const found = await apiFetch<Growth>('/me/growth')
      setGrowth(found)
      remember(userId, found.stage)
      return found
    } catch {
      // Growth is a delight, not a need: the buddy stays as it was.
      return null
    }
  }, [student, userId])

  const seen = useCallback(async () => {
    if (!student || !userId) return
    try {
      const found = await apiFetch<Growth>('/me/growth/seen', { method: 'POST' })
      setGrowth(found)
    } catch {
      // Shown again next time, which is the kinder failure.
    }
  }, [student, userId])

  useEffect(() => {
    setGrowth(null)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!student) return
    const again = () => {
      if (document.visibilityState === 'visible' && Date.now() - asked.current > REFRESH_EVERY_MS) void refresh()
    }
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [student, refresh])

  const value = useMemo(() => ({ student, userId, growth, refresh, seen }), [student, userId, growth, refresh, seen])
  return <GrowthContext.Provider value={value}>{children}</GrowthContext.Provider>
}

export function useGrowth(): GrowthValue | null {
  return useContext(GrowthContext)
}

/** The stage to draw the signed-in student's own buddy at; undefined for
 *  anyone else, whose buddy is grown. */
export function useMyStage(): Stage | undefined {
  const context = useGrowth()
  if (!context?.student) return undefined
  const { growth, userId } = context
  if (growth && isStage(growth.stage)) return growth.stage
  // Before it arrives: as last seen here, or a newborn, as every buddy starts.
  return remembered(userId) ?? 0
}
