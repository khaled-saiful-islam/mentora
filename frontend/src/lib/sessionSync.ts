/**
 * One browser holds one session: the cookie is shared by every tab. So when
 * one tab signs in as someone else, or signs out, every other tab is now
 * that other person — while still showing the old one's pages, its live
 * line still speaking for the old account. Its next request would go out
 * under the new name.
 *
 * Each sign-in, sign-up and sign-out is announced here, and a tab that hears
 * a different account starts over from `/`. Coming back to a tab also asks
 * the server who is signed in, for a change this channel could not carry.
 */

const CHANNEL = 'mentora-session'
const KEY = 'mentora.session'
// Another channel in the same tab hears this tab's own posts; the tag lets
// the tab that signed in ignore itself.
const TAB = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

type Listener = (userId: string | null) => void
interface Note {
  userId: string | null
  from: string
}

function channel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
  } catch {
    return null
  }
}

/** Tell the other tabs who this browser is signed in as now. */
export function announceSession(userId: string | null): void {
  const line = channel()
  if (line) {
    line.postMessage({ userId, from: TAB } satisfies Note)
    line.close()
    return
  }
  try {
    // No BroadcastChannel: a storage write reaches the other tabs instead.
    localStorage.setItem(KEY, JSON.stringify({ userId, from: TAB, at: Date.now() }))
  } catch {
    // Storage blocked too: the check on coming back still catches it.
  }
}

/** Hear another tab's announcement. Returns the way to stop listening. */
export function onSessionChange(listener: Listener): () => void {
  const line = channel()
  const hear = (note: Note | null | undefined) => {
    if (note && note.from !== TAB) listener(note.userId ?? null)
  }
  const onMessage = (event: MessageEvent<Note>) => hear(event.data)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY || !event.newValue) return
    try {
      hear(JSON.parse(event.newValue) as Note)
    } catch {
      // A garbled note is not a sign-in.
    }
  }
  line?.addEventListener('message', onMessage)
  window.addEventListener('storage', onStorage)
  return () => {
    line?.removeEventListener('message', onMessage)
    line?.close()
    window.removeEventListener('storage', onStorage)
  }
}

/** Whether a tab showing `shown` must start over for `now`. */
export function isSomeoneElse(shown: string | null, now: string | null): boolean {
  return shown !== now
}

/** Start over from the home page as whoever is signed in now. */
export function startOver(): void {
  window.location.replace('/')
}
