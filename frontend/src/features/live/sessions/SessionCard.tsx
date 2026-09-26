/**
 * One live lesson as a card, for a teacher's list and a student's schedule
 * alike: Astra on a scrap of night sky, the title, who it is for, when, and
 * what pressing it does.
 */
import { ArrowRight, CalendarBlank, Clock, UsersThree } from '@phosphor-icons/react'
import { motion, useMotionValue } from 'motion/react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { TutorAvatar } from '../TutorAvatar'
import { STATUS_WORDS, type SessionSummary } from './api'
import { countdown, joinOpen, whenLabel } from './when'

const TONES: Partial<Record<SessionSummary['status'], string>> = {
  scheduled: 'bg-kind-live-vivid text-white',
  lobby: 'bg-sun-400 text-grape-900',
  live: 'bg-coral-400 text-white',
  failed: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
  ended: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100',
}

export function AstraBadge({ size = 72, mood = 'idle' as const }: { size?: number; mood?: 'idle' | 'happy' }) {
  const level = useMotionValue(0)
  return <TutorAvatar mood={mood} speaking={false} level={level} size={size} />
}

export function SessionCard({
  session,
  to,
  action,
  audience = 'teacher',
  now = new Date(),
}: {
  session: SessionSummary
  to: string
  action?: string
  audience?: 'teacher' | 'student'
  now?: Date
}) {
  const open = audience === 'student' && joinOpen(session.scheduled_at, session.status, now)
  const soon = session.scheduled_at ? countdown(session.scheduled_at, now) : ''
  return (
    <motion.div whileHover={{ y: -3 }} transition={spring.snappy} className="h-full">
      <Link
        to={to}
        className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border-2 border-border bg-surface shadow-sm transition-colors hover:border-kind-live-vivid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kind-live-vivid/30"
      >
        <div className="relative flex items-center gap-3 bg-gradient-to-br from-grape-900 via-grape-800 to-[hsl(var(--kind-live))] px-4 py-3 text-white">
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
          <span className="relative -my-2 shrink-0">
            <AstraBadge size={64} mood={open ? 'happy' : 'idle'} />
          </span>
          <div className="relative min-w-0 flex-1">
            <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', TONES[session.status] ?? 'bg-white/20 text-white')}>
              {STATUS_WORDS[session.status]}
            </span>
            {soon && ['scheduled', 'lobby', 'live'].includes(session.status) && (
              <p className="mt-1 text-sm font-semibold text-white/85">Starts {soon}</p>
            )}
          </div>
        </div>
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
          <span
            className={cn(
              'mt-auto inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors',
              open ? 'bg-sun-400 text-grape-900' : 'bg-muted text-foreground group-hover:bg-kind-live-vivid group-hover:text-white',
            )}
          >
            {action ?? (open ? 'Join now' : 'Open')}
            <ArrowRight weight="bold" className="size-4" aria-hidden />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
