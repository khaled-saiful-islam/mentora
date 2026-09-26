import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Archive, ArrowRight, Broadcast, ChalkboardTeacher, PaperPlaneTilt, Plus, UserCirclePlus, UsersThree } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { useResource } from '@/hooks/useResource'
import { Page, rise, stagger } from '@/motion'
import { cn } from '@/lib/utils'
import { classesApi, type ClassDraft, type ClassRoom, type NextLive } from './api'
import { NextLiveLine } from './ClassBits'
import { AddTile } from '@/components/ui/AddTile'
import { ClassCard } from './ClassCard'
import { ClassFormDialog } from './ClassFormDialog'
import { EmptyArt } from './EmptyArt'
import { useLive } from '@/lib/bus'

export default function TeacherClassesPage() {
  const [view, setView] = useState<'active' | 'archived'>('active')
  // `?new=1` — "New class" on the home page — opens straight into the form.
  const [params] = useSearchParams()
  const [creating, setCreating] = useState(params.get('new') === '1')
  const classes = useResource(`classes:${view}`, () => classesApi.list(view === 'archived'))
  useLive(['members', 'assignments'], () => void classes.reload())
  const navigate = useNavigate()
  const { toast } = useToast()

  async function create(draft: ClassDraft) {
    const room = await classesApi.create(draft)
    toast(`${room.name} is ready!`, { body: 'Share the invite link to bring students in.' })
    navigate(`/classes/${room.id}/invite`)
  }

  const items = classes.data?.items ?? []
  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-auto sm:flex-1">
          <h1 className="font-display text-4xl font-semibold tracking-tight">Your classes</h1>
          <p className="mt-1 text-muted-foreground">Invite students, sort them into groups, share what they'll learn.</p>
        </div>
        <Segmented
          label="Which classes"
          value={view}
          onChange={setView}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived', icon: <Archive weight="bold" className="size-4" /> },
          ]}
        />
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus weight="bold" className="size-5" />
          New class
        </Button>
      </div>

      {classes.error && <Alert className="mt-6">{classes.error}</Alert>}

      <div className="mt-8">
        {classes.loading && !classes.data ? (
          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-[1.75rem]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            art={<EmptyArt Icon={ChalkboardTeacher} />}
            title={view === 'active' ? 'Your first class starts here' : 'Nothing archived'}
            body={
              view === 'active'
                ? "Create a class and you'll get a link and a code to share with your students."
                : 'Classes you archive wait here, with their results kept safe.'
            }
            action={
              view === 'active' && (
                <Button size="lg" onClick={() => setCreating(true)}>
                  <Plus weight="bold" className="size-5" />
                  Create a class
                </Button>
              )
            }
          />
        ) : (
          <>
            {view === 'active' && <Glance classes={items} />}
            <motion.ul
              key={view}
              className={cn('mt-6 grid gap-5 lg:grid-cols-2', items.length + 1 >= 3 && '2xl:grid-cols-3')}
              variants={stagger(0.06)}
              initial="hidden"
              animate="shown"
            >
              {items.map((room) => (
                <ClassCard key={room.id} room={room} />
              ))}
              {view === 'active' && (
                <AddTile
                  title="Start another class"
                  hint="You'll get a link and a code to share."
                  onClick={() => setCreating(true)}
                  count={items.length}
                  columns={items.length + 1 >= 3 ? { lg: 2, '2xl': 3 } : { lg: 2 }}
                />
              )}
            </motion.ul>
          </>
        )}
      </div>

      <ClassFormDialog open={creating} onClose={() => setCreating(false)} onSave={create} />
    </Page>
  )
}

/** Every class at once: who is in, who is waiting, what is out, what is next. */
function Glance({ classes }: { classes: ClassRoom[] }) {
  const students = classes.reduce((sum, c) => sum + c.students, 0)
  const pending = classes.reduce((sum, c) => sum + c.pending, 0)
  const shared = classes.reduce((sum, c) => sum + (c.pulse?.shared ?? 0), 0)
  const waitingAt = classes.find((c) => c.pending > 0)
  const next = soonest(classes.map((c) => c.pulse?.next_live ?? null))
  return (
    <motion.div className="grid grid-cols-3 gap-3 xl:grid-cols-4" variants={stagger(0.05)} initial="hidden" animate="shown">
      <GlanceTile Icon={UsersThree} value={students} label={`${students === 1 ? 'student' : 'students'} in ${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`} />
      <GlanceTile
        Icon={UserCirclePlus}
        value={pending}
        label="waiting to join"
        to={waitingAt ? `/classes/${waitingAt.id}/requests` : undefined}
        loud={pending > 0}
      />
      <GlanceTile Icon={PaperPlaneTilt} value={shared} label="shared and open" to="/library" />
      <motion.div variants={rise} className="col-span-3 xl:col-span-1">
        {next ? (
          <Card className="flex h-full min-w-0 flex-col justify-center p-3">
            <NextLiveLine live={next} to={(id) => `/live/${id}`} empty="" />
          </Card>
        ) : (
          <Link to="/live/new" className="group block h-full rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
            <Card className="flex h-full items-center gap-3 p-4 transition-colors group-hover:border-hover-border">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-kind-live-vivid/15 text-kind-live">
                <Broadcast weight="duotone" className="size-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-bold leading-snug">No live lesson planned</span>
                <span className="mt-0.5 flex items-center gap-1 text-sm font-bold text-kind-live">
                  Plan one with Astra <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </span>
            </Card>
          </Link>
        )}
      </motion.div>
    </motion.div>
  )
}

function GlanceTile({
  Icon,
  value,
  label,
  to,
  loud = false,
}: {
  Icon: typeof UsersThree
  value: number
  label: string
  to?: string
  loud?: boolean
}) {
  const body = (
    <Card className={cn('flex h-full flex-col items-start gap-2 p-3 transition-colors lg:flex-row lg:items-center lg:gap-3 lg:p-4', to && 'hover:border-hover-border', loud && 'border-coral-400/50 bg-coral-100/60 dark:bg-coral-700/20')}>
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', loud ? 'bg-coral-400 text-white' : 'bg-primary/10 text-primary')}>
        <Icon weight="duotone" className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-2xl font-semibold leading-none tabular-nums">{value}</span>
        <span className="mt-1 block text-sm font-bold text-muted-foreground">{label}</span>
      </span>
    </Card>
  )
  return <motion.div variants={rise}>{to ? <Link to={to} className="block h-full rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">{body}</Link> : body}</motion.div>
}

function soonest(lives: (NextLive | null)[]): NextLive | null {
  const found = lives.filter((l): l is NextLive => l !== null)
  const now = found.find((l) => l.status !== 'scheduled')
  if (now) return now
  return found.sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))[0] ?? null
}
