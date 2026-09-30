/**
 * One live lesson as a card, for a teacher's list and a student's schedule
 * alike: Astra on a scrap of night sky, where the lesson is, the title, who
 * it is for, when, and what pressing it does.
 *
 * Where the lesson is has to read at a glance across a page of them
 * (`cardState.ts`): one Astra is still writing shows a moving bar and how
 * far it is; one waiting for the teacher glows sun; the one happening now
 * pulses coral.
 */
import { ArrowRight, Bell, CalendarBlank, CheckCircle, CircleNotch, Clock, UsersThree, WarningCircle } from '@phosphor-icons/react'
import { motion, useMotionValue } from 'motion/react'
import { Link } from 'react-router-dom'
import type { Mood } from '@/features/buddies/types'
import type { WorkItem } from '@/features/work/api'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { TutorAvatar } from '../TutorAvatar'
import type { SessionSummary } from './api'
import { cardState, type CardTone } from './cardState'
import { whenLabel } from './when'

const LOOKS: Record<CardTone, { border: string; badge: string; action: string }> = {
  busy: { border: 'border-kind-live-vivid', badge: 'bg-white text-kind-live', action: 'bg-muted text-foreground group-hover:bg-kind-live-vivid group-hover:text-white' },
  'needs-you': { border: 'border-sun-400', badge: 'bg-sun-400 text-grape-900', action: 'bg-sun-400 text-grape-900' },
  live: { border: 'border-coral-400', badge: 'bg-coral-400 text-white', action: 'bg-coral-400 text-white' },
  open: { border: 'border-sun-400', badge: 'bg-sun-400 text-grape-900', action: 'bg-sun-400 text-grape-900' },
  upcoming: { border: 'border-border', badge: 'bg-kind-live-vivid text-white', action: 'bg-muted text-foreground group-hover:bg-kind-live-vivid group-hover:text-white' },
  problem: { border: 'border-destructive/60', badge: 'bg-destructive text-destructive-foreground', action: 'bg-destructive/15 text-destructive' },
  done: { border: 'border-border', badge: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100', action: 'bg-muted text-foreground group-hover:bg-kind-live-vivid group-hover:text-white' },
}

const MOODS: Record<CardTone, Mood> = {
  busy: 'think',
  'needs-you': 'wave',
  live: 'happy',
  open: 'happy',
  upcoming: 'idle',
  problem: 'idle',
  done: 'idle',
}

export function AstraBadge({ size = 72, mood = 'idle' }: { size?: number; mood?: Mood }) {
  const level = useMotionValue(0)
  return <TutorAvatar mood={mood} speaking={false} level={level} size={size} />
}

export function SessionCard({
  session,
  to,
  action,
  audience = 'teacher',
  work,
  now = new Date(),
}: {
  session: SessionSummary
  to: string
  action?: string
  audience?: 'teacher' | 'student'
  /** What is being made for it in the background, if anything. */
  work?: WorkItem
  now?: Date
}) {
  const state = cardState(session, work, now, audience)
  const look = LOOKS[state.tone]
  const calm = useCalmMotion()
  const pulsing = state.tone === 'live' && !calm
  return (
    <motion.div whileHover={{ y: -3 }} transition={spring.snappy} className="h-full">
      <Link
        to={to}
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border-2 bg-surface shadow-sm transition-colors hover:border-kind-live-vivid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kind-live-vivid/30',
          look.border,
          state.tone === 'done' && 'opacity-90',
        )}
      >
        {pulsing && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[1.6rem] ring-4 ring-coral-400/60"
            animate={{ opacity: [0.9, 0.2, 0.9] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className="relative flex items-center gap-3 bg-gradient-to-br from-grape-900 via-grape-800 to-[hsl(var(--kind-live))] px-4 py-3 text-white">
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
          <span className="relative -my-2 shrink-0">
            <AstraBadge size={64} mood={MOODS[state.tone]} />
          </span>
          <div className="relative min-w-0 flex-1">
            <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold', look.badge)}>
              <BadgeIcon tone={state.tone} calm={calm} />
              <span className="break-words">{state.badge}</span>
            </span>
            {state.detail && <p className="mt-1 break-words text-sm font-semibold text-white/90">{state.detail}</p>}
          </div>
        </div>
        {state.tone === 'busy' && <WorkBar progress={state.progress} calm={calm} />}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="break-words font-display text-xl font-semibold leading-snug">{session.title}</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <UsersThree weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="break-words">
                {session.class_name} · {session.group_name}
                {audience === 'teacher' && ` · ${session.students} student${session.students === 1 ? '' : 's'}`}
              </span>
            </li>
            {session.scheduled_at && (
              <li className="flex items-start gap-1.5">
                <CalendarBlank weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{whenLabel(session.scheduled_at, now)}</span>
              </li>
            )}
            {session.duration_minutes && (
              <li className="flex items-start gap-1.5">
                <Clock weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {session.duration_minutes} minutes
                  {audience === 'student' && session.teacher_name && ` · from ${session.teacher_name}`}
                </span>
              </li>
            )}
          </ul>
          <span className={cn('mt-auto inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors', look.action)}>
            {action ?? state.action}
            <ArrowRight weight="bold" className="size-4" aria-hidden />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function BadgeIcon({ tone, calm }: { tone: CardTone; calm: boolean }) {
  if (tone === 'busy') return <CircleNotch weight="bold" className={cn('size-3.5 shrink-0', !calm && 'animate-spin')} aria-hidden />
  if (tone === 'live' || tone === 'open') {
    return (
      <span className="relative grid size-2.5 shrink-0 place-items-center" aria-hidden>
        {!calm && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />}
        <span className="relative inline-flex size-2 rounded-full bg-current" />
      </span>
    )
  }
  if (tone === 'needs-you') return <Bell weight="fill" className="size-3.5 shrink-0" aria-hidden />
  if (tone === 'problem') return <WarningCircle weight="fill" className="size-3.5 shrink-0" aria-hidden />
  if (tone === 'done') return <CheckCircle weight="fill" className="size-3.5 shrink-0" aria-hidden />
  return null
}

/** How far the writing or recording is: filled as it goes, or a sliding
 *  shimmer while nobody knows yet. */
function WorkBar({ progress, calm }: { progress: number | null; calm: boolean }) {
  const known = progress !== null && progress > 0
  const percent = known ? Math.round(progress * 100) : null
  return (
    <div
      role="progressbar"
      aria-label="How far Astra is"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      className="relative h-2 overflow-hidden bg-kind-live-vivid/15"
    >
      {known ? (
        <motion.span className="absolute inset-y-0 left-0 bg-kind-live-vivid" initial={false} animate={{ width: `${percent}%` }} transition={spring.gentle} />
      ) : (
        <motion.span
          className="absolute inset-y-0 w-1/3 rounded-full bg-kind-live-vivid"
          animate={calm ? { left: '33%' } : { left: ['-33%', '100%'] }}
          transition={calm ? { duration: 0 } : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}
