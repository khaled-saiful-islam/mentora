/**
 * A student's schedule of live lessons: what is coming up, by day, and what
 * has already happened. It updates the moment a teacher schedules, moves or
 * cancels one.
 */
import { CalendarStar } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Alert, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { Page, rise, stagger } from '@/motion'
import { sessionsApi, type SessionSummary } from '../sessions/api'
import { AstraBadge, SessionCard } from '../sessions/SessionCard'

export function useSchedule() {
  const schedule = useResource('my-live-sessions', () => sessionsApi.mine())
  useLive(['live'], () => void schedule.reload())
  return schedule
}

/** Re-renders every half minute, so countdowns and Join buttons stay true. */
export function useNow(every = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), every)
    return () => window.clearInterval(timer)
  }, [every])
  return now
}

export default function SchedulePage() {
  const schedule = useSchedule()
  const now = useNow()
  const upcoming = schedule.data?.upcoming ?? []
  const past = schedule.data?.past ?? []
  const days = byDay(upcoming)

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <motion.header variants={rise} className="mb-8 flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-kind-live-vivid text-white shadow-lg">
          <CalendarStar weight="fill" className="size-7" aria-hidden />
        </span>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">My schedule</h1>
          <p className="text-muted-foreground">Live lessons with Astra. You'll get a reminder before each one.</p>
        </div>
      </motion.header>

      {schedule.error && <Alert className="mb-6">{schedule.error}</Alert>}

      {!schedule.data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-60 rounded-[1.75rem]" />
          ))}
        </div>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          art={<AstraBadge size={140} mood="happy" />}
          title="Nothing on your schedule yet"
          body="When your teacher plans a live lesson for your group, it will appear here — and on your home page."
        />
      ) : (
        <div className="space-y-10">
          {days.map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-4 font-display text-2xl font-semibold">{day}</h2>
              <motion.ul variants={stagger()} initial="hidden" animate="shown" className="grid gap-4 sm:grid-cols-2">
                {items.map((s) => (
                  <motion.li key={s.id} variants={rise}>
                    <SessionCard session={s} to={`/room/${s.id}`} audience="student" now={now} />
                  </motion.li>
                ))}
              </motion.ul>
            </section>
          ))}
          {past.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-2xl font-semibold">Already happened</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {past.map((s) => (
                  <li key={s.id}>
                    <SessionCard session={s} to={`/room/${s.id}`} audience="student" action="Notes" now={now} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Page>
  )
}

function byDay(items: SessionSummary[]): [string, SessionSummary[]][] {
  const groups = new Map<string, SessionSummary[]>()
  for (const item of items) {
    const at = item.scheduled_at ? new Date(item.scheduled_at) : new Date()
    const key = at.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()]
}
