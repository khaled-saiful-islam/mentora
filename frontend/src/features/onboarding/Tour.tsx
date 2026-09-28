/**
 * The first-visit tour: a few friendly steps showing what this person can do
 * here (`tours.ts`). It opens once, after sign-up — for a student, after
 * they have picked their buddy — and never again once finished or closed
 * (`POST /api/auth/me/toured`). Settings can open it again (`openTour`).
 *
 * Skip, the close button and Escape all end it; Tab stays inside while it is
 * open. Calm motion keeps the words and drops the movement.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, MapPin, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'
import { trapTab } from '@/components/ui/Dialog'
import { Buddy } from '@/features/buddies'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { User } from '@/lib/user'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion } from '@/motion'
import { tourFor, type TourStep } from './tours'

const OPEN_EVENT = 'mentora:tour'

/** Show the tour again (from Settings). */
export function openTour(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const TONE: Record<TourStep['tone'], { stage: string; badge: string; dot: string }> = {
  grape: { stage: 'from-grape-100 to-sky-100 dark:from-grape-800/40 dark:to-sky-700/20', badge: 'bg-grape-500 text-white', dot: 'bg-grape-400' },
  sky: { stage: 'from-sky-100 to-mint-100 dark:from-sky-700/30 dark:to-mint-700/20', badge: 'bg-sky-500 text-white', dot: 'bg-sky-400' },
  sun: { stage: 'from-sun-100 to-coral-100 dark:from-sun-600/25 dark:to-coral-700/20', badge: 'bg-sun-500 text-white', dot: 'bg-sun-400' },
  mint: { stage: 'from-mint-100 to-sky-100 dark:from-mint-700/30 dark:to-sky-700/20', badge: 'bg-mint-500 text-white', dot: 'bg-mint-400' },
  coral: { stage: 'from-coral-100 to-sun-100 dark:from-coral-700/30 dark:to-sun-600/20', badge: 'bg-coral-500 text-white', dot: 'bg-coral-400' },
}

/** Mounted in the app's frame: opens itself for someone who hasn't seen it. */
export function Tour() {
  const { user, updateUser } = useAuth()
  const steps = tourFor(user)
  // A student meets their buddy first (`Welcome`); the tour comes after.
  // Only on the server's word that it hasn't been seen.
  const due = Boolean(user && user.toured === false && (user.role !== 'student' || user.onboarded))
  const [open, setOpen] = useState(false)
  const [closedHere, setClosedHere] = useState(false)

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, reopen)
    return () => window.removeEventListener(OPEN_EVENT, reopen)
  }, [])

  // A beat after the page lands, so the tour arrives rather than blocks.
  useEffect(() => {
    if (!due || closedHere || steps.length === 0) return
    const timer = window.setTimeout(() => setOpen(true), 700)
    return () => window.clearTimeout(timer)
  }, [due, closedHere, steps.length])

  const close = useCallback(() => {
    setOpen(false)
    setClosedHere(true)
    if (user && user.toured === false) {
      apiFetch<User>('/auth/me/toured', { method: 'POST' })
        .then(updateUser)
        // Not saved: it simply shows again next visit.
        .catch(() => undefined)
    }
  }, [user, updateUser])

  if (!user || steps.length === 0) return null
  return createPortal(<AnimatePresence>{open && <TourDialog steps={steps} buddy={user.buddy} onClose={close} />}</AnimatePresence>, document.body)
}

function TourDialog({ steps, buddy, onClose }: { steps: TourStep[]; buddy: string | null; onClose: () => void }) {
  const calm = useCalmMotion()
  const [at, setAt] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const step = steps[at]
  const last = at === steps.length - 1

  const go = (next: number) => setAt(Math.max(0, Math.min(steps.length - 1, next)))

  function finish() {
    celebrate({ calm, power: 0.8, origin: { x: 0.5, y: 0.45 } })
    onClose()
  }

  useEffect(() => {
    const returnTo = document.activeElement
    panel.current?.querySelector<HTMLElement>('[data-primary]')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') trapTab(event, panel.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (returnTo instanceof HTMLElement) returnTo.focus()
    }
  }, [onClose])

  // The next button keeps the focus as the steps change.
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[data-primary]')?.focus()
  }, [at])

  const slide = calm ? 0 : 40
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-grape-900/45 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl"
        initial={calm ? { opacity: 0 } : { opacity: 0, y: 50, scale: 0.9, rotate: -2 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0, transition: calm ? { duration: 0.2 } : spring.bouncy }}
        exit={{ opacity: 0, y: 30, scale: 0.95, transition: { duration: 0.18 } }}
      >
        <button type="button" onClick={onClose} aria-label="Close the tour" className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-surface/80 text-muted-foreground backdrop-blur hover:bg-hover hover:text-foreground">
          <X weight="bold" className="size-5" />
        </button>
        {/* Sideways overflow is clipped: the next step's words wait just off to
            the right, and a scrollbar for them was a flicker of its own. */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Picture step={step} buddy={buddy} calm={calm} />
          {/* Every step's words sit in the same cell, so the window is always
              as tall as the longest and never jumps; only the one on show is
              visible, sliding in from the way you are going. */}
          <div className="grid px-6 pt-5 pb-2">
            {steps.map((each, i) => {
              const shown = i === at
              return (
                <motion.div
                  key={each.key}
                  className={cn('[grid-area:1/1]', !shown && 'pointer-events-none')}
                  aria-hidden={!shown}
                  initial={false}
                  animate={shown ? { opacity: 1, x: 0 } : { opacity: 0, x: i < at ? -slide : slide }}
                  transition={calm ? { duration: 0.15 } : { opacity: { duration: 0.22 }, x: spring.snappy }}
                >
                  {each.where && (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
                      <MapPin weight="fill" className="size-4 shrink-0" aria-hidden />
                      <span className="break-words">{each.where}</span>
                    </p>
                  )}
                  <h2 id={shown ? titleId : undefined} className={cn('break-words font-display text-2xl leading-tight font-semibold', each.where && 'mt-3')}>
                    {each.title}
                  </h2>
                  <p className="mt-2 break-words text-base leading-relaxed text-muted-foreground">{each.body}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
        <footer className="flex flex-wrap items-center gap-3 px-6 pt-3 pb-5">
          <Dots count={steps.length} at={at} tone={step.tone} />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {at === 0 ? (
              <Button variant="ghost" onClick={onClose}>
                Skip
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => go(at - 1)} aria-label="Back">
                <ArrowLeft weight="bold" className="size-4" aria-hidden />
                Back
              </Button>
            )}
            <Button data-primary onClick={() => (last ? finish() : go(at + 1))}>
              {last ? "Let's go!" : 'Next'}
              {!last && <ArrowRight weight="bold" className="size-4" aria-hidden />}
            </Button>
          </div>
        </footer>
      </motion.div>
    </div>
  )
}

/** The top of each step: the student's buddy, or a big icon with sparkles
 *  circling it. The frame stays; its colour cross-dissolves to the next
 *  step's and the picture pops in over the last, so nothing flashes. */
function Picture({ step, buddy, calm }: { step: TourStep; buddy: string | null; calm: boolean }) {
  const tone = TONE[step.tone]
  return (
    <div className="relative h-44 overflow-hidden" aria-hidden>
      <AnimatePresence initial={false}>
        <motion.div
          key={step.tone}
          className={cn('absolute inset-0 bg-gradient-to-br', tone.stage)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: calm ? 0.15 : 0.35 }}
        />
      </AnimatePresence>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className={cn('absolute rounded-full opacity-40 transition-colors duration-300', tone.dot)}
          style={{ width: 10 + i * 6, height: 10 + i * 6, left: `${12 + i * 19}%`, top: `${18 + ((i * 37) % 60)}%` }}
          animate={calm ? undefined : { y: [0, -12, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 3 + i * 0.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        />
      ))}
      <AnimatePresence initial={false}>
        <motion.div
          key={step.key}
          className="absolute inset-0 grid place-items-center"
          initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={calm ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          transition={calm ? { duration: 0.15 } : spring.bouncy}
        >
          {step.buddy ? (
            <Buddy buddy={buddy} size={140} mood={step.buddy === 'celebrate' ? 'celebrate' : 'wave'} interactive={false} track={false} lively={false} />
          ) : (
            <motion.span
              className={cn('grid size-24 place-items-center rounded-[1.75rem] shadow-lg', tone.badge)}
              animate={calm ? undefined : { y: [0, -6, 0] }}
              transition={calm ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <step.Icon weight="fill" className="size-12" />
            </motion.span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Dots({ count, at, tone }: { count: number; at: number; tone: TourStep['tone'] }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Step ${at + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={i}
          className={cn('block h-2 rounded-full', i === at ? TONE[tone].badge.split(' ')[0] : 'bg-border')}
          animate={{ width: i === at ? 22 : 8 }}
          transition={spring.snappy}
        />
      ))}
    </div>
  )
}
