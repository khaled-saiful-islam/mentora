/**
 * Tiny typed events between parts of the page that do not share state — the
 * bell letting a student in, and the class page showing the count.
 */
import { useEffect, useRef } from 'react'

export interface AppEvents {
  /** Something about this class's members or groups changed. */
  'class-changed': string
}

const target = new EventTarget()

export function emit<K extends keyof AppEvents>(name: K, detail: AppEvents[K]): void {
  target.dispatchEvent(new CustomEvent(name, { detail }))
}

export function useOn<K extends keyof AppEvents>(name: K, handler: (detail: AppEvents[K]) => void): void {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => {
    const listener = (event: Event) => latest.current((event as CustomEvent<AppEvents[K]>).detail)
    target.addEventListener(name, listener)
    return () => target.removeEventListener(name, listener)
  }, [name])
}
