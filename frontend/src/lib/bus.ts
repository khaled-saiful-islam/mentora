/**
 * Tiny typed events between parts of the page that do not share state — the
 * bell letting a student in and the class page showing the count, or the
 * live line saying something someone has open just changed.
 */
import { useEffect, useRef } from 'react'

export interface AppEvents {
  /** Something about this class's members or groups changed. */
  'class-changed': string
  /** Something a page might have open just changed on the server. */
  live: LiveMessage
}

/** A push from the server: a topic, and just enough to know if a page cares.
 *  See `backend/app/events/subscribers/realtime.py` for the topics. */
export interface LiveMessage {
  topic: string
  class_id?: string
  assignment_id?: string
  student_id?: string
  [key: string]: unknown
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

/** Run `handler` when the server says one of `topics` changed. */
export function useLive(topics: readonly string[], handler: (message: LiveMessage) => void): void {
  const key = topics.join(',')
  useOn('live', (message) => {
    if (key.split(',').includes(message.topic)) handler(message)
  })
}
