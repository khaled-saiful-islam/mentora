/**
 * "Accept the mission" (§28.3.2): the button that starts a game, and the
 * stamp that comes down on it — MISSION ACCEPTED — with a thud and a chord,
 * before the map opens. Under reduced motion the stamp simply appears.
 */
import { AnimatePresence, motion } from 'motion/react'
import { RocketLaunch } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'
import { useCalmMotion } from '@/motion'
import { useMissionSound } from './context'
import { playSting } from './score'

// Long enough to see the stamp land and hear the chord begin.
const STAMP_MS = 1100

export function AcceptMission({ onStart }: { onStart: () => void }) {
  const calm = useCalmMotion()
  const sound = useMissionSound()
  const [accepted, setAccepted] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function accept() {
    if (accepted) return
    setAccepted(true)
    if (sound) playSting('accept')
    timer.current = window.setTimeout(onStart, calm ? 350 : STAMP_MS)
  }

  return (
    <>
      <Button variant="sun" size="lg" onClick={accept} autoFocus disabled={accepted}>
        <RocketLaunch weight="fill" className="size-5" />
        Accept the mission
      </Button>
      {createPortal(
        <AnimatePresence>
          {accepted && (
            <motion.div
              key="stamp"
              role="status"
              className="pointer-events-none fixed inset-0 z-[60] grid place-items-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.p
                className="rounded-2xl border-[6px] border-primary bg-surface/90 px-6 py-3 text-center font-celebrate text-4xl uppercase leading-tight tracking-wide text-primary shadow-lg sm:text-5xl"
                initial={calm ? { opacity: 0, rotate: -8 } : { scale: 2.6, opacity: 0, rotate: -18 }}
                animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={calm ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 18 }}
              >
                Mission accepted!
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
