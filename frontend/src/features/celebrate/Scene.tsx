/**
 * A full-screen celebration (§28.4): a glow behind, slow rays of light, the
 * star of the moment in the middle, and one button to carry on. A dialog to
 * assistive tech — labelled, focus moved in and given back, Escape closes —
 * and still under reduced motion: the rays stop and nothing bursts.
 */
import { motion } from 'motion/react'
import { createContext, useContext, useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'
import { spring, useCalmMotion } from '@/motion'

// How many scenes are open, so a buddy talking behind one keeps quiet.
let open = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether a celebration covers the screen now. */
export function useSceneOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open > 0, () => false)
}

const InsideScene = createContext(false)

/** Whether this is inside the scene itself — its buddy may talk. */
export function useInsideScene(): boolean {
  return useContext(InsideScene)
}

/** For a full-screen sheet that is not a celebration (a guide's game, a
 *  second chance): while it is open, buddies behind it keep quiet. */
export function useCoversScreen(): void {
  useEffect(() => {
    open += 1
    notify()
    return () => {
      open -= 1
      notify()
    }
  }, [])
}

/** Inside such a sheet: its own buddy may talk. */
export const InsideSceneProvider = InsideScene.Provider

export function Scene({
  title,
  kicker,
  colour,
  onClose,
  action,
  children,
}: {
  title: string
  /** A line above the title: "Look who's here!" */
  kicker?: string
  /** The buddy's own colour variable, for the glow: `--buddy-momo`. */
  colour: string
  onClose: () => void
  action: string
  children: React.ReactNode
}) {
  const calm = useCalmMotion()
  const titleId = useId()
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    open += 1
    notify()
    return () => {
      open -= 1
      notify()
    }
  }, [])

  useEffect(() => {
    const returnTo = document.activeElement
    button.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      // One button to reach: Tab stays on it.
      if (event.key === 'Tab') {
        event.preventDefault()
        button.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const scrolled = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = scrolled
      if (returnTo instanceof HTMLElement) returnTo.focus()
    }
  }, [onClose])

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className="absolute inset-0 bg-grape-900/55 backdrop-blur-sm" aria-hidden />
      <motion.div
        className="relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-[2rem] border border-border bg-surface px-6 pt-8 pb-7 text-center shadow-lg"
        initial={{ scale: 0.86, y: 30 }}
        animate={{ scale: 1, y: 0, transition: spring.bouncy }}
        exit={{ scale: 0.95, y: 20, transition: { duration: 0.15 } }}
      >
        <div
          className="pointer-events-none absolute -top-24 left-1/2 size-[30rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{ background: `radial-gradient(circle, hsl(var(${colour}) / 0.55), transparent 65%)` }}
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute top-[-6rem] left-1/2 size-[28rem] -translate-x-1/2 opacity-30"
          style={{ background: `repeating-conic-gradient(hsl(var(${colour}) / 0.5) 0deg 10deg, transparent 10deg 30deg)`, maskImage: 'radial-gradient(circle, black 20%, transparent 62%)', WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 62%)' }}
          animate={calm ? { rotate: 0 } : { rotate: 360 }}
          transition={calm ? { duration: 0 } : { duration: 40, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        />
        {kicker && <p className="relative font-display text-lg font-semibold text-muted-foreground">{kicker}</p>}
        <h2 id={titleId} className="relative break-words font-celebrate text-4xl leading-tight">
          {title}
        </h2>
        <InsideScene.Provider value={true}>
          <div className="relative mt-2 flex w-full flex-col items-center">{children}</div>
        </InsideScene.Provider>
        <Button ref={button} size="lg" className="relative mt-6 w-full sm:w-auto" onClick={onClose}>
          {action}
        </Button>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
