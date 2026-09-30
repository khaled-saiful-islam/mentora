/**
 * A teacher's live lessons: what is happening now, what is coming up, what
 * is being prepared, and what has finished — with the way in to a new one
 * and to the voice lab.
 *
 * Each card says where its lesson is (`cardState.ts`). Astra's writing and
 * recording come from the work board, live, so a card fills its bar as it
 * goes; when that work ends, the list is fetched again for the new status.
 */
import { Broadcast, Plus, Waveform } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Alert, ButtonLink, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { cn } from '@/lib/utils'
import { AddTile } from '@/components/ui/AddTile'
import type { WorkItem } from '@/features/work/api'
import { useWork } from '@/features/work/WorkProvider'
import { Page, rise, stagger } from '@/motion'
import { sessionsApi, type SessionSummary } from './api'
import { useNow } from '../schedule/SchedulePage'
import { AstraBadge, SessionCard } from './SessionCard'

const NOW = ['lobby', 'live']
const COMING = ['scheduled']
const PREPARING = ['draft', 'planning', 'planned', 'failed', 'recording', 'approved']

export default function LiveLessonsPage() {
  const list = useResource('live-sessions', () => sessionsApi.list())
  useLive(['live'], () => void list.reload())
  const work = useLessonWork(list.reload)
  const now = useNow(30_000)
  const items = list.data?.items ?? []
  const happening = items.filter((s) => NOW.includes(s.status))
  const coming = items
    .filter((s) => COMING.includes(s.status))
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
  const preparing = items.filter((s) => PREPARING.includes(s.status))
  const past = items.filter((s) => s.status === 'ended' || s.status === 'cancelled')

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <motion.header variants={rise} className="mb-8 flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-kind-live-vivid text-white shadow-lg">
          <Broadcast weight="bold" className="size-7" aria-hidden />
        </span>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Live lessons</h1>
          <p className="text-muted-foreground">Astra teaches a group out loud, takes their questions, then sets a quiz.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/live/voice-lab" variant="outline">
            <Waveform weight="bold" className="size-4" aria-hidden />
            Voice lab
          </ButtonLink>
          <ButtonLink to="/live/new">
            <Plus weight="bold" className="size-4" aria-hidden />
            New live lesson
          </ButtonLink>
        </div>
      </motion.header>

      {list.error && <Alert className="mb-6">{list.error}</Alert>}

      {!list.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-60 rounded-[1.75rem]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          art={<AstraBadge size={140} mood="happy" />}
          title="Your first live lesson"
          body="Pick a group, a topic and how you'd like it taught. Astra writes the lesson for you to check, then teaches it live."
          action={
            <ButtonLink to="/live/new">
              <Plus weight="bold" className="size-4" aria-hidden />
              New live lesson
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-10">
          <Section title="Happening now" items={happening} work={work} now={now} />
          <Section title="Coming up" items={coming} add={coming.length > 0} work={work} now={now} />
          <Section title="Getting ready" items={preparing} add={coming.length === 0} work={work} now={now} />
          <Section title="Finished" items={past} work={work} now={now} />
        </div>
      )}
    </Page>
  )
}

/**
 * What Astra is making for each lesson, by lesson id. When a piece of it
 * finishes, the lesson's status has moved on, so the list is fetched again.
 */
function useLessonWork(reload: () => unknown): Map<string, WorkItem> {
  const { items } = useWork()
  const lessons = items.filter((w) => w.kind === 'live_plan' || w.kind === 'live_recording')
  const settled = lessons
    .filter((w) => w.state !== 'running')
    .map((w) => `${w.id}:${w.finished_at}`)
    .join()
  const seen = useRef(settled)
  useEffect(() => {
    if (settled === seen.current) return
    seen.current = settled
    void reload()
  }, [settled, reload])
  return new Map(lessons.filter((w) => w.state === 'running').map((w) => [w.id, w]))
}

function Section({
  title,
  items,
  add = false,
  work,
  now,
}: {
  title: string
  items: SessionSummary[]
  add?: boolean
  work: Map<string, WorkItem>
  now: Date
}) {
  if (items.length === 0) return null
  return (
    <section>
      <h2 className="mb-4 flex flex-wrap items-baseline gap-2 font-display text-2xl font-semibold">
        {title}
        <span className="text-base font-bold text-muted-foreground">{items.length}</span>
      </h2>
      <motion.ul
        variants={stagger()}
        initial="hidden"
        animate="shown"
        // Two lessons share the row between them rather than leave a third empty.
        className={cn('grid gap-4 sm:grid-cols-2', items.length + (add ? 1 : 0) >= 3 && 'lg:grid-cols-3')}
      >
        {items.map((s) => (
          <motion.li key={s.id} variants={rise}>
            <SessionCard session={s} to={s.status === 'live' || s.status === 'lobby' ? `/live/${s.id}/room` : `/live/${s.id}`} work={work.get(s.id)} now={now} />
          </motion.li>
        ))}
        {add && (
          <AddTile
            title="Another live lesson"
            hint="Astra teaches it to a group, live."
            to="/live/new"
            count={items.length}
            columns={items.length + 1 >= 3 ? { sm: 2, lg: 3 } : { sm: 2 }}
          />
        )}
      </motion.ul>
    </section>
  )
}
