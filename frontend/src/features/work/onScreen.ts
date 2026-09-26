/**
 * What the person is looking at right now: a set's build panel, a lesson's
 * page. When that thing finishes, they saw it happen — so the bell keeps the
 * note but no pop-up flies in to announce it.
 */
import { useEffect } from 'react'

const showing = new Map<string, number>()

export function isShowing(id: string): boolean {
  return (showing.get(id) ?? 0) > 0
}

/** Mark `id` as on screen while the calling component is mounted and `active`. */
export function useShowing(id: string | null | undefined, active = true): void {
  useEffect(() => {
    if (!id || !active) return
    showing.set(id, (showing.get(id) ?? 0) + 1)
    return () => {
      const left = (showing.get(id) ?? 1) - 1
      if (left > 0) showing.set(id, left)
      else showing.delete(id)
    }
  }, [id, active])
}
