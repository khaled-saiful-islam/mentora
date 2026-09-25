import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { Bell as BellIcon, BellSimpleSlash, Checks } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { spring, stagger, rise } from '@/motion'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Notification } from './api'
import { JoinRequestActions } from './JoinRequestActions'
import { kindOf } from './kinds'
import { useNotifications } from './NotificationsProvider'

/**
 * The bell: a count that pops when it changes, a wiggle when news arrives,
 * and a panel of what happened — with join requests answerable in place.
 */
export function Bell({ className, align = 'left' }: { className?: string; align?: 'left' | 'right' }) {
  const { unread, arrivals, latestArrival } = useNotifications()
  const [open, setOpen] = useState(false)
  const wiggle = useAnimationControls()
  const { toast } = useToast()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void wiggle.start({ rotate: [0, -18, 16, -10, 6, 0], transition: { duration: 0.7 } })
    if (latestArrival) toast(kindOf(latestArrival).title(latestArrival), { tone: 'info' })
    // Only on a new arrival, not on every re-render.
  }, [arrivals])

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-hover"
      >
        <motion.span animate={wiggle} style={{ originY: 0.1 }} className="grid place-items-center">
          <BellIcon weight={unread ? 'fill' : 'duotone'} className={cn('size-6', unread && 'text-primary')} />
        </motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: spring.bouncy }}
              exit={{ scale: 0.3, opacity: 0 }}
              className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-coral-400 px-1 text-[0.7rem] font-bold leading-5 text-white ring-2 ring-background"
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>{open && <Panel align={align} onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  )
}

function Panel({ onClose, align }: { onClose: () => void; align: 'left' | 'right' }) {
  const { items, unread, hasMore, loadMore, markAllRead } = useNotifications()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) onClose()
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
  }, [onClose])

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-label="Notifications"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
      exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
      className={cn(
        'fixed inset-x-3 top-16 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-lg',
        'sm:absolute sm:inset-x-auto sm:top-12 sm:w-[25rem]',
        align === 'left' ? 'sm:left-0 sm:origin-top-left' : 'sm:right-0 sm:origin-top-right',
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-display text-lg font-semibold">What's new</h2>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
            <Checks weight="bold" className="size-4" />
            Mark all read
          </Button>
        )}
      </header>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted-foreground">
          <BellSimpleSlash weight="duotone" className="size-12 text-grape-300" />
          <p className="font-bold text-foreground">All quiet for now</p>
          <p className="text-sm">News about your classes will show up here.</p>
        </div>
      ) : (
        <motion.ul
          className="min-h-0 flex-1 divide-y divide-border overflow-y-auto"
          variants={stagger(0.04)}
          initial="hidden"
          animate="shown"
        >
          {items.map((note) => (
            <Row key={note.id} note={note} onNavigate={onClose} />
          ))}
          {hasMore && (
            <li className="p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => void loadMore()}>
                Show older
              </Button>
            </li>
          )}
        </motion.ul>
      )}
    </motion.div>
  )
}

function Row({ note, onNavigate }: { note: Notification; onNavigate: () => void }) {
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
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl', view.tile)}>
        <view.Icon weight="duotone" className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={open} className="text-left">
          <p className="font-bold leading-snug hover:underline">{view.title(note)}</p>
          {body && <p className="text-sm text-muted-foreground">{body}</p>}
        </button>
        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(note.updated_at)}</p>
        {note.type === 'join_request' && (
          <div className="mt-2.5">
            <JoinRequestActions note={note} />
          </div>
        )}
      </div>
      {!note.read && <span aria-label="Unread" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-coral-400" />}
    </motion.li>
  )
}
