/**
 * The buddies on the signed-out screens, and what the page asks of them.
 *
 * A page says how they should be (watching, eyes covered for a password) and
 * asks for moments (a wobble at a wrong password, a celebration on the way
 * in). The crew itself only draws; this is the one place those wishes meet.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { pick, type BuddyHandle } from '@/features/buddies'
import { celebrate as confetti, useCalmMotion } from '@/motion'

export type Reaction = 'idle' | 'watch' | 'shy' | 'peek'

interface Crew {
  reaction: Reaction
  setReaction: (reaction: Reaction) => void
  /** A wrong password: everyone winces. */
  oops: () => void
  /** Everyone jumps; resolves once it has been seen, so the page can go. */
  celebrate: () => Promise<void>
  /** One buddy says something — the one in the middle, unless told. */
  say: (line: string, who?: number) => void
  register: (index: number, handle: BuddyHandle | null) => void
}

const CrewContext = createContext<Crew | null>(null)

/** Long enough to see the jump and the confetti, short enough not to wait. */
const CELEBRATION_MS = 850
const LEAD = 2

const OOPS_LINES = ["Hmm, that didn't work. Try again?", 'Oh no! Check your password?', 'Whoops! One more go?'] as const
const CHEER_LINES = ['Yay! In you go!', 'Woohoo! Welcome!', 'Here we go!'] as const

export function CrewProvider({ children }: { children: React.ReactNode }) {
  const [reaction, setReaction] = useState<Reaction>('idle')
  const handles = useRef<(BuddyHandle | null)[]>([])
  const calm = useCalmMotion()

  const each = useCallback((act: (handle: BuddyHandle, index: number) => void, gap: number) => {
    handles.current.forEach((handle, index) => {
      if (handle) window.setTimeout(() => act(handle, index), index * gap)
    })
  }, [])

  const oops = useCallback(() => {
    each((handle) => handle.play('oops'), 60)
    handles.current[LEAD]?.say(pick(OOPS_LINES), 3200)
  }, [each])

  const celebrate = useCallback(async () => {
    setReaction('idle')
    each((handle) => {
      handle.play('celebrate')
      handle.burst('confetti', 8, 'top')
    }, 70)
    handles.current[LEAD]?.say(pick(CHEER_LINES), 2000)
    confetti({ calm, power: 1.2, origin: { x: 0.5, y: 0.75 } })
    await new Promise((resolve) => window.setTimeout(resolve, calm ? 200 : CELEBRATION_MS))
  }, [each, calm])

  const say = useCallback((line: string, who = LEAD) => handles.current[who]?.say(line, 3800), [])

  const register = useCallback((index: number, handle: BuddyHandle | null) => {
    handles.current[index] = handle
  }, [])

  const value = useMemo(
    () => ({ reaction, setReaction, oops, celebrate, say, register }),
    [reaction, oops, celebrate, say, register],
  )
  return <CrewContext.Provider value={value}>{children}</CrewContext.Provider>
}

export function useCrew(): Crew {
  const crew = useContext(CrewContext)
  if (!crew) throw new Error('useCrew needs a CrewProvider — it lives in AuthLayout.')
  return crew
}

/**
 * Wiring for an ordinary field: the buddies lean in to listen while it has
 * focus, and relax when it loses it.
 */
export function useWatching(): { onFocus: () => void; onBlur: () => void } {
  const { setReaction } = useCrew()
  return useMemo(
    () => ({ onFocus: () => setReaction('watch'), onBlur: () => setReaction('idle') }),
    [setReaction],
  )
}

/**
 * Wiring for a password: hands over their eyes while it is typed, and a
 * peek round them when it is shown.
 */
export function useLookingAway(): {
  onFocus: () => void
  onBlur: () => void
  onShownChange: (shown: boolean) => void
} {
  const { setReaction } = useCrew()
  const focused = useRef(false)
  const shown = useRef(false)
  return useMemo(() => {
    const update = () => setReaction(focused.current ? (shown.current ? 'peek' : 'shy') : 'idle')
    return {
      onFocus: () => {
        focused.current = true
        update()
      },
      onBlur: () => {
        focused.current = false
        update()
      },
      onShownChange: (next: boolean) => {
        shown.current = next
        update()
      },
    }
  }, [setReaction])
}
