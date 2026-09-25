import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { Bell as BellIcon, Check, Checks } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { Buddy } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { spring, stagger, rise, useCalmMotion } from '@/motion'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Notification } from './api'
import { JoinRequestActions } from './JoinRequestActions'
import { headlineOf, kindOf } from './kinds'
import { useNotifications } from './NotificationsProvider'
import { place, type Placement } from './place'

const NUDGE_MS = 25_000
const RING = { rotate: [0, -24, 20, -14, 10, -5, 0], transition: { duration: 0.9 } }

/**
 * The bell: it rings when news lands — sound waves and a "+1" floating up —
 * gives a little nudge now and then while something is unread, and opens a
 * panel of what happened, with join requests answerable in place.
 */
export function Bell({ className, align = 'left' }: { className?: string; align?: 'left' | 'right' }) {
  const { unread, arrivals } = useNotifications()
  const [open, setOpen] = useState(false)
  const [ringing, setRinging] = useState(0)
  const swing = useAnimationControls()
  const calm = useCalmMotion()
  const first = useRef(true)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void swing.start(RING)
    setRinging((n) => n + 1)
    // Only on a new arrival, not on every re-render.
  }, [arrivals])

  // While something waits unread, a small "psst" every so often.
  useEffect(() => {
    if (!unread || calm || open) return
    const timer = window.setInterval(() => void swing.start({ rotate: [0, -10, 8, 0], transition: { duration: 0.5 } }), NUDGE_MS)
    return () => window.clearInterval(timer)
  }, [unread, calm, open, swing])

  return (
    <div className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-hover"
      >
        <motion.span animate={swing} whileHover={{ rotate: [0, -12, 10, 0], transition: { duration: 0.4 } }} style={{ originY: 0.1 }} className="grid place-items-center">
          <BellIcon weight={unread ? 'fill' : 'duotone'} className={cn('size-6', unread && 'text-primary')} />
        </motion.span>
        <AnimatePresence>{ringing > 0 && !calm && <Waves key={ringing} />}</AnimatePresence>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.35, 1], opacity: 1, transition: { duration: 0.45 } }}
              exit={{ scale: 0.3, opacity: 0 }}
              className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-coral-400 px-1 text-[0.7rem] font-bold leading-5 text-white ring-2 ring-background"
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {ringing > 0 && !calm && (
            <motion.span
              key={`plus-${ringing}`}
              aria-hidden
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], y: -26, scale: 1 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              className="pointer-events-none absolute -top-1 right-0 font-display text-sm font-bold text-coral-400"
            >
              +1
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {/* On the body, so nothing that holds the bell can clip the panel. */}
      {createPortal(
        <AnimatePresence>
          {open && <Panel anchor={trigger} align={align} onClose={() => setOpen(false)} />}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** Two arcs either side of the bell, like the ring you can see. */
function Waves() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {[-1, 1].map((side) =>
        [0, 1].map((i) => (
          <motion.span
            key={`${side}-${i}`}
            className="absolute top-1/2 left-1/2 block size-8 rounded-full border-2 border-transparent"
            style={{ [side < 0 ? 'borderLeftColor' : 'borderRightColor']: 'hsl(var(--primary))', translateX: '-50%', translateY: '-50%' }}
            initial={{ opacity: 0.9, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.6 + i * 0.4 }}
            transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
          />
        )),
      )}
    </span>
  )
}

/** Below this the panel spans the screen under the top bar instead. */
const PHONE = 640

/** Under the bell and inside the window, kept there as the window changes. */
function useAnchored(
  anchor: RefObject<HTMLElement>,
  panel: RefObject<HTMLElement>,
  align: 'left' | 'right',
): Placement | null {
  const [at, setAt] = useState<Placement | null>(null)
  useLayoutEffect(() => {
    const update = () => {
      const bell = anchor.current?.getBoundingClientRect()
      const width = panel.current?.offsetWidth ?? 0
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      setAt(bell && width && viewport.width >= PHONE ? place(bell, width, align, viewport) : null)
    }
    update()
    window.addEventListener('resize', update)
    // Capture, so a scroll inside the sidebar moves the panel with its bell.
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchor, panel, align])
  return at
}

function Panel({
  anchor,
  onClose,
  align,
}: {
  anchor: RefObject<HTMLButtonElement>
  onClose: () => void
  align: 'left' | 'right'
}) {
  const { items, unread, hasMore, loadMore, markAllRead } = useNotifications()
  const [sweeping, setSweeping] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const at = useAnchored(anchor, panel, align)
  const fresh = items.filter((n) => !n.read)
  const earlier = items.filter((n) => n.read)

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      // The bell toggles the panel itself. Closing here as well would close
      // it on the press and open it again on the click.
      if (anchor.current?.contains(target)) return
      if (panel.current && !panel.current.contains(target)) onClose()
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    // A tick later, so the click that opened the panel does not close it.
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDown))
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchor])

  // Every dot turns into a tick, one after another, and then they are read.
  function readAll() {
    setSweeping(true)
    window.setTimeout(() => {
      void markAllRead()
      setSweeping(false)
    }, 250 + fresh.length * 60)
  }

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-label="Notifications"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
      exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
      style={at ? { top: at.top, left: at.left, maxHeight: `min(75dvh, ${at.maxHeight}px)` } : undefined}
      className={cn(
        'fixed inset-x-3 top-16 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-lg',
        'sm:inset-x-auto sm:w-[25rem]',
        align === 'left' ? 'origin-top-left' : 'origin-top-right',
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          What's new
          {unread > 0 && <span className="rounded-full bg-coral-400 px-2 text-sm leading-6 text-white">{unread}</span>}
        </h2>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={readAll} disabled={sweeping}>
            <Checks weight="bold" className="size-4" />
            Mark all read
          </Button>
        )}
      </header>
      {items.length === 0 ? (
        <Quiet />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {fresh.length > 0 && <Section title="New" notes={fresh} sweeping={sweeping} onNavigate={onClose} />}
          {earlier.length > 0 && <Section title="Earlier" notes={earlier} sweeping={false} onNavigate={onClose} />}
          {hasMore && (
            <div className="p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => void loadMore()}>
                Show older
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function Section({ title, notes, sweeping, onNavigate }: { title: string; notes: Notification[]; sweeping: boolean; onNavigate: () => void }) {
  return (
    <section>
      <h3 className="px-5 pt-3 pb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <motion.ul className="divide-y divide-border" variants={stagger(0.04)} initial="hidden" animate="shown">
        {notes.map((note, i) => (
          <Row key={note.id} note={note} onNavigate={onNavigate} ticking={sweeping} delay={i * 0.06} />
        ))}
      </motion.ul>
    </section>
  )
}

/** Nothing new: said with a little humour, and a buddy having a nap. */
function Quiet() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-8 text-center text-muted-foreground">
      {user?.role === 'student' ? (
        <Buddy buddy={user.buddy} size={96} mood="sleepy" interactive={false} track={false} lively={false} />
      ) : (
        <motion.span animate={{ rotate: [0, 8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="relative">
          <BellIcon weight="duotone" className="size-14 text-grape-300" />
          <motion.span
            className="absolute -top-2 -right-3 font-display font-bold text-primary"
            animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            z
          </motion.span>
        </motion.span>
      )}
      <p className="mt-2 font-bold text-foreground">All quiet… suspiciously quiet.</p>
      <p className="text-sm">News about your classes will pop up here.</p>
    </div>
  )
}

function Row({ note, onNavigate, ticking, delay }: { note: Notification; onNavigate: () => void; ticking: boolean; delay: number }) {
  const { markRead } = useNotifications()
  const navigate = useNavigate()
  const view = kindOf(note)
  const href = view.href?.(note) ?? null
  const body = view.body?.(note)

  function open() {
    if (!note.read) void markRead(note.id)
    if (href) {
      onNavigate()
      navigate(href)
    }
  }

  return (
    <motion.li variants={rise} className={cn('relative flex gap-3 px-5 py-4', !note.read && 'bg-grape-50/70 dark:bg-grape-900/20')}>
      {!note.read && (
        <motion.span
          aria-hidden
          className="absolute inset-y-3 left-1.5 w-1 rounded-full bg-gradient-to-b from-primary via-coral-400 to-sun-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      )}
      <motion.span whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.4 } }} className={cn('grid size-10 shrink-0 place-items-center rounded-2xl', view.tile)}>
        <view.Icon weight="duotone" className="size-6" />
      </motion.span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={open} className="text-left">
          <p className="font-bold leading-snug hover:underline">{headlineOf(note)}</p>
          {body && <p className="text-sm text-muted-foreground">{body}</p>}
        </button>
        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(note.updated_at)}</p>
        {note.type === 'join_request' && (
          <div className="mt-2.5">
            <JoinRequestActions note={note} />
          </div>
        )}
      </div>
      {!note.read && (
        <AnimatePresence mode="wait" initial={false}>
          {ticking ? (
            <motion.span
              key="tick"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...spring.bouncy, delay }}
              className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-correct text-white"
            >
              <Check weight="bold" className="size-3" />
            </motion.span>
          ) : (
            <motion.span key="dot" aria-label="Unread" exit={{ scale: 0 }} className="mt-1.5 size-2.5 shrink-0 rounded-full bg-coral-400" />
          )}
        </AnimatePresence>
      )}
    </motion.li>
  )
}
