/**
 * How many messages are waiting, shared by everything that shows it — the
 * header's envelope and the sidebar — so one fetch serves them all. Asked
 * again whenever the live line says a thread changed.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { useLive } from '@/lib/bus'
import { messagesApi } from './api'

let count = 0
const listeners = new Set<() => void>()

function set(next: number) {
  if (next === count) return
  count = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let pending: Promise<void> | null = null

/** Ask again; callers at the same moment share one request. */
export function refreshUnread(): Promise<void> {
  pending ??= messagesApi
    .unread()
    .then((reply) => set(reply.unread))
    .catch(() => {
      // Signed out, or offline: keep the last count; the next push corrects it.
    })
    .finally(() => {
      pending = null
    })
  return pending
}

/** The server's own figure, from a reply that carried it. */
export const setUnread = set

export function useUnreadMessages(userId: string | null): number {
  const value = useSyncExternalStore(subscribe, () => count)
  useEffect(() => {
    if (userId) void refreshUnread()
    else set(0)
  }, [userId])
  useLive(['messages'], () => {
    if (userId) void refreshUnread()
  })
  return value
}
