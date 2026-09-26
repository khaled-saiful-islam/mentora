/**
 * A student's way into a live lesson. Before it starts: when it is, a
 * countdown, and a calendar file to keep. The room itself — the lobby and the
 * lesson — opens here ten minutes before the start.
 */
import { ArrowLeft, CalendarPlus, Clock } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Skeleton } from '@/components/ui'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { apiFetch } from '@/lib/api'
import { Page, spring } from '@/motion'
import { starField } from '@/features/auth/scene/sky'
import type { SessionSummary } from '../sessions/api'
import { AstraBadge } from '../sessions/SessionCard'
import { countdown, joinOpen, whenLabel } from '../sessions/when'
import { useNow } from '../schedule/SchedulePage'

const STARS = starField(40, 23, 96)

export default function RoomPage() {
  const { id = '' } = useParams()
  const session = useResource(`my-live-session:${id}`, () => apiFetch<SessionSummary>(`/me/live-sessions/${id}`))
  useLive(['live'], (m) => {
    if (m.session_id === id) void session.reload()
  })
  const now = useNow(1000)
  const live = session.data

  return (
    <Page className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <Link to="/schedule" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft weight="bold" className="size-4" aria-hidden />
        My schedule
      </Link>
      {session.error && <Alert>{session.error}</Alert>}
      {!live ? (
        !session.error && <Skeleton className="h-96 rounded-[2rem]" />
      ) : (
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-b from-grape-900 via-grape-800 to-[hsl(var(--kind-live))] p-6 text-center text-white shadow-xl sm:p-10">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            {STARS.map((s, i) => (
              <span key={i} className="absolute rounded-full bg-white/70" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }} />
            ))}
          </div>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="mx-auto w-fit">
            <AstraBadge size={180} mood="happy" />
          </motion.div>
          <p className="mt-2 text-sm font-bold uppercase tracking-wider text-sun-300">Live lesson with Astra</p>
          <h1 className="mx-auto mt-1 max-w-2xl break-words font-display text-3xl font-semibold leading-tight sm:text-5xl">{live.title}</h1>
          <p className="mt-2 text-white/80">
            {live.class_name} · {live.group_name}
            {live.teacher_name && ` · from ${live.teacher_name}`}
          </p>
          {live.status === 'cancelled' ? (
            <p className="mx-auto mt-6 max-w-md rounded-2xl bg-white/10 p-4 font-semibold">This lesson was cancelled.</p>
          ) : live.status === 'ended' ? (
            <p className="mx-auto mt-6 max-w-md rounded-2xl bg-white/10 p-4 font-semibold">This lesson has finished.</p>
          ) : (
            live.scheduled_at && (
              <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <Clock weight="bold" className="size-5" aria-hidden />
                  {whenLabel(live.scheduled_at, now)}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold">
                  {joinOpen(live.scheduled_at, live.status, now) ? 'The room is opening…' : `Starts ${countdown(live.scheduled_at, now)}`}
                </p>
                <p className="mt-2 text-sm text-white/75">The room opens ten minutes before. You'll get a reminder.</p>
                <a
                  href={`/api/me/live-sessions/${live.id}/calendar.ics`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25"
                >
                  <CalendarPlus weight="bold" className="size-4" aria-hidden />
                  Add to my calendar
                </a>
              </div>
            )
          )}
        </section>
      )}
    </Page>
  )
}
