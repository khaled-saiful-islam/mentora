/**
 * The tray beside the bell: what is being made for you in the background —
 * a quiz, a study guide, a live lesson being written or recorded — with how
 * far along each one is, live. Start something, go and do something else;
 * the ring fills as it goes, and it turns to a tick when it is ready.
 *
 * Hidden when nothing is being made or waiting to be opened.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CheckCircle, MagicWand, WarningCircle, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { useNotifications } from '@/features/notifications/NotificationsProvider'
import { place, type Placement } from '@/features/notifications/place'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, spring, stagger, useCalmMotion } from '@/motion'
import type { WorkItem } from './api'
import { lookOfWork } from './looks'
import { useWork } from './WorkProvider'

const RING = 2 * Math.PI * 17
const PHONE = 640

export function WorkTray({ className, align = 'right' }: { className?: string; align?: 'left' | 'right' }) {
  const { items, running } = useWork()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const calm = useCalmMotion()

  useEffect(() => {
    if (items.length === 0) setOpen(false)
  }, [items.length])

  if (items.length === 0) return null
  const ready = items.filter((item) => item.state === 'done').length
  const progress = running.length ? running.reduce((sum, item) => sum + item.progress, 0) / running.length : 1
  const label = running.length
    ? `${running.length} being made in the background`
    : `${ready || items.length} ready to open`

  return (
    <div className={cn('relative', className)}>
      <motion.button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        title={label}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.bouncy}
        className="relative grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-hover"
      >
        <svg viewBox="0 0 40 40" className="absolute inset-0 size-10 -rotate-90" aria-hidden>
          <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3" className="stroke-border" />
          <motion.circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING}
            animate={{ strokeDashoffset: RING * (1 - Math.max(0.06, progress)) }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
            className={running.length ? 'stroke-primary' : 'stroke-correct'}
          />
        </svg>
        {running.length ? (
          <motion.span
            animate={calm ? undefined : { rotate: [0, -14, 10, 0], y: [0, -1.5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="relative grid place-items-center"
          >
            <MagicWand weight="duotone" className="size-5 text-primary" />
          </motion.span>
        ) : (
          <motion.span initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} transition={spring.bouncy} className="relative grid place-items-center">
            <CheckCircle weight="fill" className="size-5 text-correct" />
          </motion.span>
        )}
        {running.length > 1 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.7rem] font-bold leading-5 text-primary-foreground ring-2 ring-background">
            {running.length}
          </span>
        )}
      </motion.button>
      {createPortal(
        <AnimatePresence>{open && <Panel anchor={trigger} align={align} onClose={() => setOpen(false)} />}</AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function useAnchored(anchor: RefObject<HTMLElement>, panel: RefObject<HTMLElement>, align: 'left' | 'right'): Placement | null {
  const [at, setAt] = useState<Placement | null>(null)
  useLayoutEffect(() => {
    const update = () => {
      const box = anchor.current?.getBoundingClientRect()
      const width = panel.current?.offsetWidth ?? 0
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      setAt(box && width && viewport.width >= PHONE ? place(box, width, align, viewport) : null)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchor, panel, align])
  return at
}

function Panel({ anchor, align, onClose }: { anchor: RefObject<HTMLButtonElement>; align: 'left' | 'right'; onClose: () => void }) {
  const { items, running } = useWork()
  const panel = useRef<HTMLDivElement>(null)
  const at = useAnchored(anchor, panel, align)

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchor.current?.contains(target)) return
      if (panel.current && !panel.current.contains(target)) onClose()
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDown))
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchor])

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-label="Being made in the background"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
      exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
      style={at ? { top: at.top, left: at.left, maxHeight: `min(75dvh, ${at.maxHeight}px)` } : undefined}
      className={cn(
        'fixed inset-x-3 top-16 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-lg',
        'sm:inset-x-auto sm:w-[24rem]',
        align === 'left' ? 'origin-top-left' : 'origin-top-right',
      )}
    >
      <header className="border-b border-border px-5 py-3">
        <h2 className="font-display text-lg font-semibold">{running.length ? 'In the works' : 'Ready for you'}</h2>
        <p className="text-sm text-muted-foreground">
          {running.length ? "Keep working — we'll ring the bell when each one is ready." : 'Open them now, or find them later in your library.'}
        </p>
      </header>
      <motion.ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto" variants={stagger(0.05)} initial="hidden" animate="shown">
        {items.map((item) => (
          <Row key={`${item.id}:${item.started_at}`} item={item} onNavigate={onClose} />
        ))}
      </motion.ul>
    </motion.div>
  )
}

function Row({ item, onNavigate }: { item: WorkItem; onNavigate: () => void }) {
  const { clear } = useWork()
  const { items: notes, markRead } = useNotifications()
  const navigate = useNavigate()
  const look = lookOfWork(item.kind)
  const running = item.state === 'running'

  function open() {
    // Opened from here is as good as opened from the bell.
    const note = notes.find((n) => n.payload.work_id === item.id && !n.read)
    if (note) void markRead(note.id)
    if (!running) clear(item)
    onNavigate()
    navigate(item.link)
  }

  return (
    <motion.li variants={rise} className="flex gap-3 px-5 py-4">
      <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-2xl', look.soft)}>
        <look.Icon weight="duotone" className="size-6" aria-hidden />
        {item.state === 'done' && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy} className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-surface">
            <CheckCircle weight="fill" className="size-5 text-correct" aria-hidden />
          </motion.span>
        )}
        {item.state === 'failed' && (
          <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-surface">
            <WarningCircle weight="fill" className="size-5 text-coral-400" aria-hidden />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 font-bold leading-snug break-words">{item.title}</p>
          {!running && (
            <button
              type="button"
              onClick={() => clear(item)}
              aria-label={`Clear ${item.title} from this list`}
              className="-mt-1 -mr-2 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
            >
              <X weight="bold" className="size-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {look.label} · {running ? `started ${timeAgo(item.started_at)}` : timeAgo(item.finished_at ?? item.started_at)}
        </p>
        {running ? <Progress item={item} bar={look.bar} /> : <Outcome item={item} open={open} action={look.open} />}
      </div>
    </motion.li>
  )
}

function Progress({ item, bar }: { item: WorkItem; bar: string }) {
  const calm = useCalmMotion()
  return (
    <div className="mt-2">
      <div className="relative h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.progress * 100)} aria-label={item.label}>
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', bar)}
          initial={false}
          animate={{ width: `${Math.max(6, item.progress * 100)}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
        {!calm && (
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ left: ['-35%', '105%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={item.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="mt-1.5 text-sm text-muted-foreground"
        >
          {item.label}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

function Outcome({ item, open, action }: { item: WorkItem; open: () => void; action: string }) {
  const done = item.state === 'done'
  return (
    <div className="mt-2 space-y-2">
      {!done && item.message && <p className="text-sm text-coral-700 dark:text-coral-100">{item.message}</p>}
      <Button size="sm" variant={done ? 'primary' : 'outline'} onClick={open} className="h-8 px-3">
        {done ? action : 'Take a look'}
        <ArrowRight weight="bold" className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}
