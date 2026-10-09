/**
 * Where a set's page leads back to: the chat it was opened from, when it was
 * (its card in the chat — "Open", "Play it"), else the Library.
 *
 * The chat is remembered for the set for the rest of the session, so going
 * from its page to Play it and back still leads back to the chat. A
 * convenience only: storage that fails or is empty falls back to the Library.
 */
import { useLocation } from 'react-router-dom'

export interface Back {
  to: string
  label: string
}

export const LIBRARY: Back = { to: '/library', label: 'Library' }

const KEY = (setId: string) => `mentora:came-from:${setId}`

/** The router state that says "back to this chat" — and remembers it. */
export function fromChat(setId: string, chatPath: string): { back: Back } {
  const back = { to: chatPath, label: 'Chat' }
  try {
    window.sessionStorage.setItem(KEY(setId), chatPath)
  } catch {
    // No storage (a private window): the state still carries it one step.
  }
  return { back }
}

function isBack(value: unknown): value is Back {
  if (typeof value !== 'object' || value === null) return false
  const { to, label } = value as Record<string, unknown>
  return typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') && typeof label === 'string'
}

/** Where this page was reached from, if the link said so. */
export function useCameWith(): Back | null {
  const state: unknown = useLocation().state
  const back = typeof state === 'object' && state !== null ? (state as { back?: unknown }).back : null
  return isBack(back) ? back : null
}

/** Where a set's page leads back to: as the link said, or as remembered. */
export function useBackFor(setId: string | undefined): Back {
  const said = useCameWith()
  if (said) return said
  try {
    const chat = setId ? window.sessionStorage.getItem(KEY(setId)) : null
    if (chat && chat.startsWith('/') && !chat.startsWith('//')) return { to: chat, label: 'Chat' }
  } catch {
    // Storage unavailable: the Library.
  }
  return LIBRARY
}
