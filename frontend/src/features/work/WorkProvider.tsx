/**
 * What is being made for you in the background, kept live: fetched once,
 * then each push from the server replaces one item. While something is
 * running it also checks every so often, so a missed push only costs a
 * moment. Finished items stay until you open or clear them (or the server
 * forgets them, a quarter of an hour on).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useOn } from '@/lib/bus'
import { merge, workApi, workOf, type WorkItem } from './api'

const CHECK_MS = 20_000

interface WorkState {
  /** Newest first, without the ones you cleared. */
  items: WorkItem[]
  running: WorkItem[]
  finished: WorkItem[]
  clear: (item: WorkItem) => void
}

const WorkContext = createContext<WorkState | null>(null)

export function WorkProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [all, setAll] = useState<WorkItem[]>([])
  const [cleared, setCleared] = useState<ReadonlySet<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      setAll((await workApi.mine()).items)
    } catch {
      // The tray keeps what it had; the next push or check catches up.
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setAll([])
      return
    }
    void refresh()
    const onFocus = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [user, refresh])

  useOn('live', (message) => {
    const changed = workOf(message)
    if (changed) setAll((items) => merge(items, changed))
  })

  const anyRunning = all.some((item) => item.state === 'running')
  useEffect(() => {
    if (!anyRunning) return
    const timer = window.setInterval(() => void refresh(), CHECK_MS)
    return () => window.clearInterval(timer)
  }, [anyRunning, refresh])

  const clear = useCallback((item: WorkItem) => setCleared((now) => new Set([...now, runOf(item)])), [])

  const value = useMemo(() => {
    const items = all.filter((item) => item.state === 'running' || !cleared.has(runOf(item)))
    return {
      items,
      running: items.filter((item) => item.state === 'running'),
      finished: items.filter((item) => item.state !== 'running'),
      clear,
    }
  }, [all, cleared, clear])
  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>
}

/** One run of a piece of work: a lesson written again is a new run. */
function runOf(item: WorkItem): string {
  return `${item.id}:${item.started_at}`
}

export function useWork(): WorkState {
  const context = useContext(WorkContext)
  if (!context) throw new Error('useWork must be used inside <WorkProvider>')
  return context
}
