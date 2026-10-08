/**
 * The only way a game talks to Mentora (§24.4): `postMessage` from its
 * sandboxed frame, sent by the runtime the server put in front of the game's
 * own code (`backend/app/learning/sim/runtime.py`).
 *
 * The game is model-written code, so what it says is checked here, every
 * time: it must come from that frame's window, carry the runtime's mark, and
 * be one of a few shapes — a mission reached, a go that failed, a word for
 * the buddy, ready, finished. Anything else is ignored. What a mission is
 * worth is still decided by the server.
 */
import { useEffect, useRef } from 'react'

export type GameMessage =
  | { type: 'ready' }
  | { type: 'tried'; id: string; tries: number }
  | { type: 'done'; id: string; tries: number }
  | { type: 'say'; text: string }
  | { type: 'finished' }

/** As long as a buddy's line from a game may be (`SAY_LIMIT` on the server). */
export const SAY_LIMIT = 140
const MOST_TRIES = 99

const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 40

function goes(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, 1), MOST_TRIES) : 1
}

/** The message, if it is one a game may send; null for anything else. */
export function readMessage(data: unknown): GameMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const message = data as Record<string, unknown>
  if (message.source !== 'mentora-game') return null
  switch (message.type) {
    case 'ready':
    case 'finished':
      return { type: message.type }
    case 'tried':
    case 'done':
      return isId(message.id) ? { type: message.type, id: message.id, tries: goes(message.tries) } : null
    case 'say': {
      const text = typeof message.text === 'string' ? message.text.trim().slice(0, SAY_LIMIT) : ''
      return text ? { type: 'say', text } : null
    }
    default:
      return null
  }
}

/** Listens to one frame's game, and only to it. */
export function useGameMessages(frame: React.RefObject<HTMLIFrameElement>, onMessage: (message: GameMessage) => void) {
  const latest = useRef(onMessage)
  latest.current = onMessage
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      const from = frame.current?.contentWindow
      if (!from || event.source !== from) return
      const message = readMessage(event.data)
      if (message) latest.current(message)
    }
    window.addEventListener('message', listen)
    return () => window.removeEventListener('message', listen)
  }, [frame])
}

/** Tells the game a setting changed: sound on or off, calm motion. */
export function tellGame(frame: HTMLIFrameElement | null, type: 'sound' | 'calm', on: boolean) {
  // The game's origin is opaque — sandboxed, no same-origin — so `*` is the
  // only address it answers to; it accepts only messages from this window.
  frame?.contentWindow?.postMessage({ source: 'mentora-host', type, on }, '*')
}
