/**
 * Where the buddy keeps a child company while they play.
 *
 * On a wide screen, a corner beside the game. On anything narrower that
 * corner would sit on the answers, so the buddy stands in the page instead —
 * under the game, in the spot each player leaves for it (`BuddySpot`) — and
 * talks to its left. Either way nothing it does covers a question.
 */
import { motion } from 'motion/react'
import { createContext, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Buddy, type BuddyHandle } from '@/features/buddies'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Wide enough for a corner beside the game without touching it. */
export const CORNER_FROM = '(min-width: 1280px)'

interface Dock {
  spot: HTMLElement | null
  setSpot: (el: HTMLElement | null) => void
}

const DockContext = createContext<Dock | null>(null)

export function BuddyDock({ children }: { children: React.ReactNode }) {
  const [spot, setSpot] = useState<HTMLElement | null>(null)
  const dock = useMemo(() => ({ spot, setSpot }), [spot])
  return <DockContext.Provider value={dock}>{children}</DockContext.Provider>
}

/** Room for the buddy under a game, on screens without a corner to spare. */
export function BuddySpot() {
  const dock = useContext(DockContext)
  return <div ref={dock?.setSpot} className="mt-6 flex w-full justify-end empty:hidden" />
}

/** The buddy: in the corner when there is room, else in the player's spot. */
export function BuddyCorner({ buddy, handle }: { buddy: string | null | undefined; handle: React.RefObject<BuddyHandle> }) {
  const cornered = useMediaQuery(CORNER_FROM)
  const tablet = useMediaQuery('(min-width: 768px)')
  const spot = useContext(DockContext)?.spot
  if (!cornered && spot) {
    return createPortal(
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.3 }}>
        <Buddy key="spot" ref={handle} buddy={buddy} size={tablet ? 112 : 84} bubble="left" />
      </motion.div>,
      spot,
    )
  }
  return (
    <motion.div
      initial={{ y: 140, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.3 }}
      className="pointer-events-none fixed right-2 bottom-2 z-50 md:right-6 md:bottom-4 [&_button]:pointer-events-auto"
    >
      <Buddy key="corner" ref={handle} buddy={buddy} size={cornered ? 136 : 84} bubble="above-left" />
    </motion.div>
  )
}
