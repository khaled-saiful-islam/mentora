/**
 * A parent's home: each child they follow — their week at a glance, their
 * classes and teachers, and the way into everything they do — and a way to
 * connect another with the child's code.
 */
import { ArrowRight, ChalkboardTeacher, Fire, HeartStraight, LinkBreak, ListChecks, Medal, UsersThree, Warning } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, ButtonLink, Card, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { Buddy, greeting } from '@/features/buddies'
import { CodeInput } from '@/features/classes/CodeInput'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { useLive } from '@/lib/bus'
import { lookOf } from '@/lib/palette'
import { firstName } from '@/lib/user'
import { cn } from '@/lib/utils'
import { Page, rise, stagger } from '@/motion'
import { useLearnStudio } from '@/features/learning/LearnStudio'
import type { LearningKindName } from '@/features/learning/api'
import { lookOfKind } from '@/features/learning/kinds'
import { familyApi, type Child } from './api'
import { isLate, LessonRow, waitingOf, WorkRow } from './child/bits'
import { ResultRow } from './child/OverviewTab'
import { useChildResource } from './child/useChild'
import { LabelPicker } from './LabelPicker'

export default function ParentHome() {
  const { user } = useAuth()
  const children = useResource('my-children', () => familyApi.children())
  useLive(['family', 'classes'], () => void children.reload())
  const items = children.data?.items ?? []

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-kind-family-vivid via-kind-family-vivid to-kind-family p-6 text-white shadow-lg md:p-8">
        <motion.span
          aria-hidden
          className="absolute -top-6 right-10 text-white/20"
          animate={{ y: [0, -8, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          <HeartStraight weight="fill" className="size-40" />
        </motion.span>
        <p className="relative font-display text-lg font-semibold opacity-85">{greeting()},</p>
        <h1 className="relative mt-1 font-display text-4xl font-semibold tracking-tight md:text-5xl">{user ? firstName(user) : 'there'}!</h1>
        <p className="relative mt-2 max-w-xl opacity-90">
          {items.length === 0
            ? "Connect to your child and you'll see everything they're learning."
            : `Here's how ${items.map((c) => c.first_name).join(' and ')} ${items.length === 1 ? 'is' : 'are'} getting on.`}
        </p>
      </section>

      {children.error && <Alert className="mt-6">{children.error}</Alert>}
      {!children.data ? (
        <Skeleton className="mt-6 h-64 rounded-[1.75rem]" />
      ) : (
        <div className={cn('mt-6 grid gap-5', items.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_22rem]')}>
          {items.length > 0 && (
            <motion.ul className="space-y-5" variants={stagger(0.08)} initial="hidden" animate="shown">
              {items.map((child) => (
                <ChildCard key={child.id} child={child} onGone={() => void children.reload()} />
              ))}
            </motion.ul>
          )}
          <div className="space-y-5 self-start">
            {items.length > 0 && <MakeCard names={items.map((c) => c.first_name)} />}
            <ConnectCard first={items.length === 0} onConnected={() => void children.reload()} />
          </div>
        </div>
      )}
    </Page>
  )
}

function ChildCard({ child, onGone }: { child: Child; onGone: () => void }) {
  const classes = useResource(`child-classes:${child.id}`, () => familyApi.classes(child.id))
  const overview = useChildResource(child.id, 'overview', () => familyApi.overview(child.id))
  const [leaving, setLeaving] = useState(false)
  const { toast } = useToast()

  async function disconnect() {
    setLeaving(false)
    try {
      await familyApi.disconnect(child.id)
      toast(`You're no longer following ${child.first_name}`, { tone: 'info' })
      onGone()
    } catch (e) {
      toast('That did not work', { tone: 'error', body: errorMessage(e) })
    }
  }

  const rooms = classes.data?.items ?? []
  const week = overview.data
  const { user } = useAuth()
  const waiting = week ? waitingOf(week, user?.id) : []
  const late = waiting.filter((t) => isLate(t)).length
  const page = `/children/${child.id}`
  return (
    <motion.li variants={rise}>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-kind-family-vivid/8 p-5">
          <Buddy buddy={child.buddy} size={84} mood="happy" bubble="top" />
          <div className="min-w-[min(100%,12rem)] flex-1">
            <p className="text-xs font-bold tracking-wide text-kind-family uppercase">You're their {child.label}</p>
            <h2 className="break-words font-display text-3xl font-semibold">{child.name}</h2>
            {child.grade_label && <p className="text-sm font-bold text-muted-foreground">{child.grade_label}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink to={page} className="bg-kind-family-vivid text-white">
              See everything <ArrowRight weight="bold" className="size-4" aria-hidden />
            </ButtonLink>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLeaving(true)}>
              <LinkBreak weight="bold" className="size-4" /> Disconnect
            </Button>
          </div>
        </div>
        {!week ? (
          <Skeleton className="m-5 h-40 rounded-2xl" />
        ) : (
          <div className="space-y-5 p-5 @container">
            <ul className="flex flex-wrap gap-2">
              <Pill Icon={Fire} text={week.streak > 0 ? `${week.streak}-day streak` : 'No streak yet'} />
              <Pill Icon={Medal} text={`${week.badges} ${week.badges === 1 ? 'badge' : 'badges'}`} />
              <Pill Icon={ListChecks} text={waiting.length === 0 ? 'All caught up' : `${waiting.length} waiting`} />
              {late > 0 && <Pill Icon={Warning} text={`${late} past due`} alert />}
            </ul>
            <div className="grid gap-5 @3xl:grid-cols-2">
              <Glance title="Waiting" empty={`Nothing waiting — ${child.first_name} is all caught up.`} more={waiting.length > 3 ? { to: `${page}/work`, label: `All ${waiting.length}` } : null}>
                {waiting.slice(0, 3).map((todo) => (
                  <WorkRow key={todo.assignment_id} todo={todo} />
                ))}
              </Glance>
              <Glance title="Latest results" empty={`Scores show here when ${child.first_name} finishes something.`} more={week.latest.length > 0 ? { to: `${page}/results`, label: 'All results' } : null}>
                {week.latest.slice(0, 3).map((row) => (
                  <ResultRow key={row.attempt_id} row={row} to={`${page}/attempts/${row.attempt_id}`} />
                ))}
              </Glance>
            </div>
            {week.upcoming[0] && (
              <ul>
                <LessonRow lesson={week.upcoming[0]} />
              </ul>
            )}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground/85">
                <UsersThree weight="duotone" className="size-5 text-kind-family" aria-hidden /> Classes and teachers
              </h3>
              {!classes.data ? (
                <Skeleton className="mt-3 h-10 rounded-2xl" />
              ) : rooms.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{child.first_name} isn't in a class yet. When they join one, it shows up here with their teacher.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {rooms.map((room) => {
                    const look = lookOf(room.theme)
                    return (
                      <li key={room.class_id} className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold', look.soft)}>
                        <ChalkboardTeacher weight="duotone" className="size-4" aria-hidden />
                        <span className="break-words">
                          {room.class_name} · {room.teacher_name}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
      {leaving && (
        <Confirm
          title={`Stop following ${child.first_name}?`}
          body={`You'll stop seeing their work and getting their alerts. ${child.first_name} can invite you again any time.`}
          confirmLabel="Disconnect"
          onConfirm={() => void disconnect()}
          onCancel={() => setLeaving(false)}
        />
      )}
    </motion.li>
  )
}

function Pill({ Icon, text, alert = false }: { Icon: typeof Fire; text: string; alert?: boolean }) {
  return (
    <li className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold', alert ? 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100' : 'bg-muted text-foreground/85')}>
      <Icon weight="fill" className={cn('size-4', !alert && 'text-kind-family')} aria-hidden />
      {text}
    </li>
  )
}

function Glance({ title, empty, more, children }: { title: string; empty: string; more: { to: string; label: string } | null; children: React.ReactNode[] }) {
  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {more && (
          <Link to={more.to} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
            {more.label} <ArrowRight weight="bold" className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <motion.ul className="space-y-2" variants={stagger(0.05)} initial="hidden" animate="shown">
          {children}
        </motion.ul>
      )}
    </section>
  )
}

/** Make a quiz, some flashcards or a study guide to send home (§20.4). */
function MakeCard({ names }: { names: string[] }) {
  const studio = useLearnStudio()
  const kinds: LearningKindName[] = ['quiz', 'flashcard', 'study_guide']
  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold">Make something for {names.join(' and ')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a topic — or use your own notes — and Mentora makes it in about a minute. Then send it home.
          </p>
        </div>
        <motion.ul className="grid gap-2" variants={stagger(0.06)} initial="hidden" animate="shown">
          {kinds.map((kind) => {
            const look = lookOfKind(kind)
            return (
              <motion.li key={kind} variants={rise}>
                <motion.button
                  type="button"
                  onClick={() => studio.create(kind)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 text-left transition-colors hover:border-hover-border"
                >
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', look.hero)}>
                    <look.Icon weight="fill" className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 break-words font-bold">{look.label}</span>
                  <ArrowRight weight="bold" className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </motion.button>
              </motion.li>
            )
          })}
        </motion.ul>
        <Link to="/library" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          What I've made <ArrowRight weight="bold" className="size-4" aria-hidden />
        </Link>
      </div>
    </Card>
  )
}

/** Type the child's code — the same one their invitation link carries. */
function ConnectCard({ first, onConnected }: { first: boolean; onConnected: () => void }) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('Mum')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  async function connect(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const child = await familyApi.connect(code, label)
      toast(`You're connected to ${child.first_name}!`, { tone: 'success' })
      setCode('')
      onConnected()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn('self-start overflow-hidden', first && 'mx-auto w-full max-w-xl')}>
      <form onSubmit={connect} className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold">{first ? 'Connect to your child' : 'Connect another child'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            On their Mentora, they open <span className="font-bold text-foreground">Settings → My family</span> and read you the 6-letter code — or send you the link.
          </p>
        </div>
        <CodeInput compact value={code} onChange={(next) => { setCode(next); setError(null) }} invalid={Boolean(error)} />
        <LabelPicker value={label} onChange={setLabel} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full bg-kind-family-vivid text-white" disabled={code.length < 6 || !label.trim()} loading={busy}>
          {!busy && <HeartStraight weight="fill" className="size-4" />}
          Connect
        </Button>
      </form>
    </Card>
  )
}
