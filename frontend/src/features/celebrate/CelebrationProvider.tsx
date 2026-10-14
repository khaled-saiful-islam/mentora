/**
 * Big moments, one at a time and never mid-question (§28.4): a buddy growing
 * up, a new buddy to meet. Anything can ask for one; it waits in line and
 * plays at the next pause — never while a quiz, game or live lesson is open,
 * where it would take a child's eyes off the question.
 */
import { AnimatePresence } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

export interface Celebration {
  /** One of each at a time: asking twice for the same id is asking once. */
  id: string
  render: (close: () => void) => React.ReactNode
  onClose?: () => void
}

interface CelebrationValue {
  celebrate: (moment: Celebration) => void
}

const CelebrationContext = createContext<CelebrationValue | null>(null)

// Pages where a child is in the middle of something.
const BUSY = [
  /^\/(play|practice|from-home|attempts)\/[^/]+/,
  /^\/library\/[^/]+\/(try|preview)/,
  /^\/room\//,
  /^\/live\/[^/]+\/room/,
]

export function isBusy(pathname: string): boolean {
  return BUSY.some((pattern) => pattern.test(pathname))
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Celebration[]>([])
  const { pathname } = useLocation()
  const celebrate = useCallback((moment: Celebration) => {
    setQueue((waiting) => (waiting.some((m) => m.id === moment.id) ? waiting : [...waiting, moment]))
  }, [])
  const current = isBusy(pathname) ? null : (queue[0] ?? null)
  const close = useCallback(() => {
    setQueue(([first, ...rest]) => {
      first?.onClose?.()
      return rest
    })
  }, [])
  const value = useMemo(() => ({ celebrate }), [celebrate])
  return (
    <CelebrationContext.Provider value={value}>
      {children}
      <AnimatePresence>{current && <Shown key={current.id} moment={current} close={close} />}</AnimatePresence>
    </CelebrationContext.Provider>
  )
}

function Shown({ moment, close }: { moment: Celebration; close: () => void }) {
  return <>{moment.render(close)}</>
}

export function useCelebrate(): (moment: Celebration) => void {
  const value = useContext(CelebrationContext)
  return value?.celebrate ?? noop
}

function noop(): void {}
