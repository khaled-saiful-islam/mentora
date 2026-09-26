/**
 * The next live lesson on a student's home page: a slice of night sky with
 * Astra, the title, a live countdown, and — ten minutes before the start — a
 * glowing Join button. Nothing at all when there is nothing coming.
 */
import { ArrowRight, CalendarStar } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { AstraBadge } from '../sessions/SessionCard'
import { countdown, joinOpen, whenLabel } from '../sessions/when'
import { useNow, useSchedule } from './SchedulePage'

export function UpNext({ className }: { className?: string }) {
  const schedule = useSchedule()
  const now = useNow(15_000)
  const calm = useCalmMotion()
  const next = schedule.data?.upcoming.find((s) => s.status !== 'cancelled')
  if (!next) return null
  const open = joinOpen(next.scheduled_at, next.status, now)
  const more = (schedule.data?.upcoming.length ?? 1) - 1

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      aria-label="Your next live lesson"
      className={cn(
        'relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-grape-900 via-grape-800 to-[hsl(var(--kind-live))] p-5 text-white shadow-xl sm:p-6',
        className,
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:26px_26px]" />
      <span aria-hidden className="blob pointer-events-none -right-16 -top-20 -z-10 size-72 bg-kind-live-vivid opacity-50" />
      <div className="flex flex-wrap items-center gap-4">
        <AstraBadge size={104} mood={open ? 'happy' : 'idle'} />
        <div className="min-w-[min(100%,15rem)] flex-1">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-sun-300">
            <CalendarStar weight="fill" className="size-4" aria-hidden />
            {open ? 'Live now — come in!' : 'Up next'}
          </p>
          <h2 className="mt-1 break-words font-display text-2xl font-semibold leading-tight sm:text-3xl">{next.title}</h2>
          {next.scheduled_at && (
            <p className="mt-1 text-white/85">
              {whenLabel(next.scheduled_at, now)} · starts {countdown(next.scheduled_at, now) || 'soon'} · {next.group_name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <motion.span
            animate={open && !calm ? { scale: [1, 1.05, 1], boxShadow: ['0 0 0 0 rgba(255,210,80,0.6)', '0 0 0 14px rgba(255,210,80,0)', '0 0 0 0 rgba(255,210,80,0)'] } : undefined}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="rounded-full"
          >
            <Link
              to={`/room/${next.id}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold transition-colors',
                open ? 'bg-sun-400 text-grape-900 hover:bg-sun-300' : 'bg-white/15 text-white hover:bg-white/25',
              )}
            >
              {open ? 'Join the lesson' : 'Have a look'}
              <ArrowRight weight="bold" className="size-4" aria-hidden />
            </Link>
          </motion.span>
          {more > 0 && (
            <Link to="/schedule" className="text-sm font-bold text-white/80 underline-offset-4 hover:underline">
              +{more} more on your schedule
            </Link>
          )}
        </div>
      </div>
    </motion.section>
  )
}
