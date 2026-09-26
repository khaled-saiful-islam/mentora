/**
 * The bell's state: the first page of news, two counts, and a live line to
 * the server that says when either changed.
 *
 * `unseen` is what the badge shows — news since the bell was last opened —
 * so opening it clears the red dot. `unread` is per note: a note stays new
 * until it is opened or marked read.
 *
 * The stream carries no content — only "something changed" — so the table
 * stays the one source of truth and a missed push costs nothing: the next
 * one, the 60-second poll while disconnected, or coming back to the tab
 * catches up.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { emit, type LiveMessage } from '@/lib/bus'
import { notificationsApi, type Notification } from './api'

const POLL_MS = 60_000
const MAX_BACKOFF_MS = 30_000

interface NotificationsState {
  items: Notification[]
  unread: number
  unseen: number
  hasMore: boolean
  /** Bumps whenever new unread news arrives, for a wiggle or a toast. */
  arrivals: number
  latestArrival: Notification | null
  /** The live line is up: pages can say they are live. */
  live: boolean
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  /** The bell was opened: the badge clears, the notes stay new. */
  markSeen: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsState | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [unseen, setUnseen] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [arrivals, setArrivals] = useState(0)
  const [latestArrival, setLatestArrival] = useState<Notification | null>(null)
  const [live, setLive] = useState(false)
  const seen = useRef<Set<string> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const page = await notificationsApi.page()
      setItems(page.items)
      setUnread(page.unread)
      setUnseen(page.unseen)
      setCursor(page.next_cursor)
      const fresh = page.items.filter((n) => !n.read && seen.current && !seen.current.has(`${n.id}:${n.count}`))
      seen.current = new Set(page.items.map((n) => `${n.id}:${n.count}`))
      if (fresh.length > 0) {
        setLatestArrival(fresh[0])
        setArrivals((n) => n + 1)
      }
    } catch {
      // A bell that could not refresh keeps what it had; the next push retries.
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setItems([])
      setUnread(0)
      setUnseen(0)
      seen.current = null
      return
    }
    void refresh()
    return connect(refresh, setLive)
  }, [user, refresh])

  const loadMore = useCallback(async () => {
    if (!cursor) return
    const page = await notificationsApi.page(cursor)
    setItems((current) => [...current, ...page.items.filter((n) => !current.some((c) => c.id === n.id))])
    setCursor(page.next_cursor)
  }, [cursor])

  const markRead = useCallback(async (id: string) => {
    setItems((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((n) => Math.max(0, n - 1))
    try {
      await notificationsApi.read(id)
    } finally {
      void refresh()
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((n) => ({ ...n, read: true })))
    setUnread(0)
    setUnseen(0)
    await notificationsApi.readAll().catch(() => refresh())
  }, [refresh])

  const markSeen = useCallback(async () => {
    setUnseen(0)
    try {
      const counts = await notificationsApi.seen()
      setUnread(counts.unread)
    } catch {
      // The badge comes back on the next refresh; nothing else depends on it.
      void refresh()
    }
  }, [refresh])

  const value = useMemo(
    () => ({
      items,
      unread,
      unseen,
      hasMore: cursor !== null,
      arrivals,
      latestArrival,
      live,
      refresh,
      loadMore,
      markRead,
      markAllRead,
      markSeen,
    }),
    [items, unread, unseen, cursor, arrivals, latestArrival, live, refresh, loadMore, markRead, markAllRead, markSeen],
  )
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

/** The live line: SSE with backoff, polling while it is down, a refresh on
 *  coming back to the tab. Returns the cleanup. */
function connect(refresh: () => Promise<void>, setLive: (up: boolean) => void): () => void {
  let source: EventSource | null = null
  let retry: number | undefined
  let poll: number | undefined
  let backoff = 2_000
  let closed = false

  const startPolling = () => {
    if (poll === undefined) poll = window.setInterval(() => void refresh(), POLL_MS)
  }
  const stopPolling = () => {
    window.clearInterval(poll)
    poll = undefined
  }

  const open = () => {
    if (closed || typeof EventSource === 'undefined') {
      startPolling()
      return
    }
    source = new EventSource('/api/notifications/stream')
    source.addEventListener('ready', () => {
      setLive(true)
      backoff = 2_000
      stopPolling()
      void refresh()
    })
    source.addEventListener('notifications', () => void refresh())
    for (const topic of LIVE_TOPICS) {
      source.addEventListener(topic, (event) => {
        const message = liveOf((event as MessageEvent<string>).data)
        if (message) emit('live', message)
      })
    }
    source.onerror = () => {
      setLive(false)
      source?.close()
      startPolling()
      retry = window.setTimeout(open, backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
    }
  }

  const onFocus = () => {
    if (document.visibilityState === 'visible') void refresh()
  }
  document.addEventListener('visibilitychange', onFocus)
  open()

  return () => {
    closed = true
    setLive(false)
    source?.close()
    window.clearTimeout(retry)
    stopPolling()
    document.removeEventListener('visibilitychange', onFocus)
  }
}

/** The pushes that are about pages, not the bell. */
export const LIVE_TOPICS = ['classes', 'members', 'assignments', 'progress', 'leaderboard', 'moderation', 'live', 'work'] as const

/** A live push, or null for a garbled one. */
export function liveOf(data: string): LiveMessage | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (parsed && typeof parsed === 'object' && 'topic' in parsed && typeof parsed.topic === 'string') {
      return parsed as LiveMessage
    }
  } catch {
    // Not JSON: nothing to update.
  }
  return null
}

export function useNotifications(): NotificationsState {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return context
}
