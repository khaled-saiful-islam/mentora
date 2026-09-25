/**
 * News that arrives while you are here gets a moment of its own: a card that
 * flies in with a little show — a medal that spins, a paper plane that lands,
 * a door that gets knocked on — and, for a student, their buddy popping up to
 * announce it. It leaves by itself, waiting while a pointer rests on it.
 *
 * Nothing pops during a quiz or a deck: the bell keeps it for afterwards.
 */
import { animate, AnimatePresence, motion, useAnimationControls, useMotionValue } from 'motion/react'
import { PaperPlaneTilt, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { Buddy } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { useSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion } from '@/motion'
import type { Notification } from './api'
import { headlineOf, kindOf, type Flourish, type KindView } from './kinds'
import { useNotifications } from './NotificationsProvider'

const SHOW_MS = 7000
const MAX_SHOWN = 3
const QUIET_ON = ['/play/', '/practice/', '/attempts/']

export function NewsPop() {
  const { arrivals, latestArrival, markRead } = useNotifications()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [shown, setShown] = useState<Notification[]>([])
  const first = useRef(true)
  const sound = useSound()

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!latestArrival || QUIET_ON.some((p) => pathname.startsWith(p))) return
    sound(latestArrival.type === 'badge_awarded' ? 'badge' : 'notify')
    setShown((now) => [latestArrival, ...now.filter((n) => n.id !== latestArrival.id)].slice(0, MAX_SHOWN))
    // Only on a new arrival, not on every navigation.
  }, [arrivals])

  const dismiss = (id: string) => setShown((now) => now.filter((n) => n.id !== id))

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex flex-col items-stretch gap-3 sm:inset-x-auto sm:right-5 sm:top-20 sm:w-[24rem]"
    >
      <AnimatePresence initial={false}>
        {shown.map((note) => (
          <Pop
            key={note.id}
            note={note}
            buddy={user?.role === 'student' ? user.buddy : null}
            onDone={() => dismiss(note.id)}
            onRead={() => void markRead(note.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function Pop({ note, buddy, onDone, onRead }: { note: Notification; buddy: string | null; onDone: () => void; onRead: () => void }) {
  const view = kindOf(note)
  const navigate = useNavigate()
  const card = useRef<HTMLDivElement>(null)
  const calm = useCalmMotion()
  const [paused, setPaused] = useState(false)
  const href = view.href?.(note) ?? null

  // Leaves by itself, unless it is serious or someone is reading it. The
  // bar and the timer are one value, so a pause really pauses both.
  const left = useMotionValue(1)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (view.serious || paused) return
    const run = animate(left, 0, {
      duration: (left.get() * SHOW_MS) / 1000,
      ease: 'linear',
      onComplete: () => done.current(),
    })
    return () => run.stop()
  }, [paused, view.serious, left])

  // The confetti ones burst from where the card landed.
  useEffect(() => {
    if (view.flourish !== 'medal' && view.flourish !== 'confetti') return
    const timer = window.setTimeout(() => {
      const box = card.current?.getBoundingClientRect()
      if (!box) return
      celebrate({ calm, power: 0.45, origin: { x: (box.left + 40) / window.innerWidth, y: (box.top + 40) / window.innerHeight } })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [view.flourish, calm])

  function go() {
    onRead()
    onDone()
    if (href) navigate(href)
  }

  return (
    <motion.div
      ref={card}
      layout
      role={view.serious ? 'alert' : 'status'}
      initial={{ opacity: 0, x: 80, y: -10, scale: 0.85, rotate: 4 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, x: 90, scale: 0.9, transition: { duration: 0.2 } }}
      transition={spring.bouncy}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto relative overflow-visible rounded-3xl border-2 bg-surface shadow-lg',
        view.serious ? 'border-wrong' : 'border-border',
        buddy && !view.serious && 'ml-20',
      )}
    >
      {buddy && !view.serious && (
        // The buddy peeks round the card's edge to announce it.
        <motion.div
          className="absolute -bottom-3 -left-[5.75rem]"
          initial={{ x: 40, opacity: 0, rotate: 20 }}
          animate={{ x: 0, opacity: 1, rotate: [20, -8, 0] }}
          transition={{ ...spring.bouncy, delay: 0.2 }}
        >
          <Buddy buddy={buddy} size={104} mood={view.mood} interactive={false} track={false} lively={false} />
        </motion.div>
      )}
      {!view.serious && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[1.75rem] border-4 border-primary/40"
          initial={{ opacity: 0.9, scale: 0.96 }}
          animate={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
        />
      )}
      <div className="flex gap-3 p-4 pr-10">
        <Tile view={view} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-snug">{headlineOf(note)}</p>
          {view.body?.(note) && <p className="mt-0.5 text-sm text-muted-foreground">{view.body(note)}</p>}
          {href && (
            <Button size="sm" variant={view.serious ? 'danger' : 'primary'} className="mt-2.5" onClick={go}>
              {view.action ?? 'Open'}
            </Button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDone}
        aria-label="Dismiss"
        className="absolute top-3 right-3 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
      >
        <X weight="bold" className="size-4" />
      </button>
      {!view.serious && (
        <span className="absolute inset-x-4 bottom-0 h-1 overflow-hidden rounded-full">
          <motion.span className="block h-full origin-left rounded-full bg-primary/40" style={{ scaleX: left }} />
        </span>
      )}
    </motion.div>
  )
}

/** The icon, doing its bit. */
function Tile({ view }: { view: KindView }) {
  const controls = useAnimationControls()
  useEffect(() => {
    void controls.start(FLOURISH[view.flourish])
  }, [controls, view.flourish])
  return (
    <span className={cn('relative grid size-12 shrink-0 place-items-center rounded-2xl', view.tile)}>
      {view.flourish === 'plane' && <Plane />}
      <motion.span animate={controls} className="grid place-items-center" style={{ originY: view.flourish === 'ring' ? 0.1 : 0.5 }}>
        <view.Icon weight="fill" className="size-7" />
      </motion.span>
      {view.flourish === 'knock' && <Knocks />}
    </span>
  )
}

const FLOURISH: Record<Flourish, Parameters<ReturnType<typeof useAnimationControls>['start']>[0]> = {
  medal: { rotateY: [0, 720], scale: [0.4, 1.25, 1], transition: { duration: 1.1, ease: 'easeOut' } },
  plane: { opacity: [0, 0, 1], scale: [0.6, 0.6, 1], transition: { duration: 1, times: [0, 0.7, 1] } },
  knock: { x: [0, -4, 4, -4, 4, 0, 0, -4, 4, 0], transition: { duration: 1.2, times: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.6, 0.68, 0.76, 0.84] } },
  trophy: { y: [0, -10, 0, -5, 0], scale: [1, 1.15, 0.95, 1.05, 1], transition: { duration: 0.9 } },
  confetti: { scale: [0.3, 1.3, 1], rotate: [-30, 15, 0], transition: { duration: 0.7 } },
  ring: { rotate: [0, -20, 18, -12, 8, -4, 0], transition: { duration: 0.9 } },
  alert: { scale: [1, 1.15, 1, 1.15, 1], transition: { duration: 1.2 } },
}

/** A paper plane that swoops across and lands where the icon appears. */
function Plane() {
  return (
    <motion.span
      aria-hidden
      className="absolute text-primary"
      initial={{ x: -160, y: -40, rotate: -20, opacity: 0 }}
      animate={{ x: [-160, -40, 6, 0], y: [-40, -60, -8, 0], rotate: [-20, 10, 30, 0], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <PaperPlaneTilt weight="fill" className="size-7" />
    </motion.span>
  )
}

/** "Knock knock": two little arcs beside the door. */
function Knocks() {
  return (
    <span aria-hidden className="pointer-events-none absolute -right-3 top-1 flex flex-col gap-0.5">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="block h-1 w-3 rounded-full bg-sun-400"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: [0, 1, 0, 1, 0], x: [-4, 2, -4, 2, 6] }}
          transition={{ duration: 1.2, delay: i * 0.08 }}
        />
      ))}
    </span>
  )
}
