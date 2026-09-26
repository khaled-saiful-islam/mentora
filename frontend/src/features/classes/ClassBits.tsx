/**
 * Small pieces the class cards share: a number with its label, the next
 * live lesson, and a row of faces.
 */
import { Broadcast } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { whenLabel } from '@/features/live/sessions/when'
import { cn } from '@/lib/utils'
import { pop, useCalmMotion } from '@/motion'
import type { NextLive } from './api'

/** A number worth seeing at a glance, and what it counts. */
export function Stat({ value, label, className }: { value: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-2xl bg-muted/60 px-3 py-2.5', className)}>
      <motion.p variants={pop} initial="hidden" animate="shown" className="font-display text-2xl font-semibold leading-none tabular-nums">
        {value}
      </motion.p>
      <p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  )
}

/** The next live lesson in a class — pulsing when it is on now. */
export function NextLiveLine({ live, to, empty }: { live: NextLive | null | undefined; to: (id: string) => string; empty: string }) {
  const calm = useCalmMotion()
  if (!live) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Broadcast weight="duotone" className="size-5 shrink-0" aria-hidden />
        {empty}
      </p>
    )
  }
  const now = live.status === 'live' || live.status === 'lobby'
  return (
    <Link
      to={to(live.id)}
      className="group/live flex items-center gap-3 rounded-2xl bg-kind-live-vivid/10 px-3 py-2.5 transition-colors hover:bg-kind-live-vivid/15"
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-kind-live-vivid text-white">
        {now && !calm && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-xl bg-kind-live-vivid"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        )}
        <Broadcast weight="fill" className="relative size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-kind-live">{now ? 'Live now' : 'Next live lesson'}</span>
        <span className="block break-words font-bold leading-snug">{live.title}</span>
        {!now && live.scheduled_at && <span className="block text-sm text-muted-foreground">{whenLabel(live.scheduled_at)}</span>}
      </span>
    </Link>
  )
}

const TINTS = ['bg-grape-100 text-grape-700', 'bg-mint-100 text-mint-700', 'bg-sky-100 text-sky-700', 'bg-sun-100 text-sun-600', 'bg-coral-100 text-coral-700']

/** The first few students, as initials on overlapping circles. */
export function Faces({ names, total }: { names: string[]; total: number }) {
  if (names.length === 0) return null
  const more = total - names.length
  return (
    <span className="flex items-center" aria-label={`${total} ${total === 1 ? 'student' : 'students'}`}>
      {names.map((name, i) => (
        <span
          key={`${name}-${i}`}
          title={name}
          aria-hidden
          className={cn('-ml-2 grid size-8 place-items-center rounded-full text-xs font-bold ring-2 ring-surface first:ml-0', TINTS[i % TINTS.length])}
        >
          {initials(name)}
        </span>
      ))}
      {more > 0 && (
        <span aria-hidden className="-ml-2 grid size-8 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground ring-2 ring-surface">
          +{more}
        </span>
      )}
    </span>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}
