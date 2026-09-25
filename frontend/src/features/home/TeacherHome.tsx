/**
 * A teacher's home: the day at a glance. Who is working on something right
 * now, who is waiting to be let in, how the last few shares are going, and
 * the classes themselves — live, so it fills in as students get going.
 *
 * A brand-new teacher gets a short path instead: make a class, invite, make
 * something, share it — ticking itself off as they go.
 */
import { motion } from 'motion/react'
import { ArrowRight, BookOpenText, Cards, ChalkboardTeacher, CheckCircle, Circle, Exam, Plus, Sparkle, UserPlus, UsersThree, type Icon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Alert, ButtonLink, Chip, Skeleton } from '@/components/ui'
import { LiveBadge } from '@/components/ui/LiveBadge'
import { greeting } from '@/features/buddies'
import type { LearningKindName } from '@/features/learning/api'
import { lookOfKind } from '@/features/learning/kinds'
import { useLearnStudio } from '@/features/learning/LearnStudio'
import { useResource } from '@/hooks/useResource'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLive } from '@/lib/bus'
import { lookOf } from '@/lib/palette'
import { dueLabel } from '@/lib/time'
import { firstName } from '@/lib/user'
import { cn } from '@/lib/utils'
import { Page, pop, rise, stagger } from '@/motion'

interface Teaching {
  pending: number
  live_now: number
  classes: { id: string; name: string; subject: string | null; grade_label: string | null; theme: string; students: number; pending: number }[]
  recent: {
    id: string
    title: string
    kind: LearningKindName
    class_id: string
    class_name: string
    due_at: string | null
    closed: boolean
    created_at: string
    audience: number
    completed: number
    in_progress: number
    average: number | null
  }[]
}

export default function TeacherHome() {
  const { user } = useAuth()
  const studio = useLearnStudio()
  const home = useResource('teaching-home', () => apiFetch<Teaching>('/me/teaching'))
  useLive(['progress', 'members', 'assignments'], () => void home.reload())
  const data = home.data
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-grape-500 via-grape-600 to-grape-800 p-6 text-white shadow-lg md:p-8">
        <Doodles />
        <p className="relative font-display text-lg font-semibold opacity-85">{today}</p>
        <h1 className="relative mt-1 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {greeting()}, {user ? firstName(user) : 'Cikgu'}!
        </h1>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Action Icon={Exam} label="Make a quiz" onClick={() => studio.create('quiz')} />
          <Action Icon={Cards} label="Make flashcards" onClick={() => studio.create('flashcard')} />
          <Action Icon={BookOpenText} label="Make a study guide" onClick={() => studio.create('study_guide')} />
          <Action Icon={Plus} label="New class" to="/classes?new=1" />
          <Action Icon={Sparkle} label="Open the studio" to="/studio" />
        </div>
      </section>

      {home.error && <Alert className="mt-6">{home.error}</Alert>}
      {!data ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : data.classes.length === 0 ? (
        <GettingStarted data={data} />
      ) : (
        <>
          {!setUp(data) && <GettingStarted data={data} />}
          <Glance data={data} />
          {data.recent.length > 0 && <Recent data={data} />}
          <Classes data={data} />
        </>
      )}
    </Page>
  )
}

function Action({ Icon, label, onClick, to }: { Icon: Icon; label: string; onClick?: () => void; to?: string }) {
  const inner = (
    <>
      <Icon weight="fill" className="size-5" />
      {label}
    </>
  )
  const style = 'inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 font-bold backdrop-blur transition-colors hover:bg-white/25'
  return to ? (
    <Link to={to} className={style}>{inner}</Link>
  ) : (
    <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={onClick} className={style}>{inner}</motion.button>
  )
}

/** Chalk doodles drifting on the hero: a star, a plus, a squiggle, a circle. */
function Doodles() {
  const bits = [
    { d: 'M12 2 L14.5 9 L22 9.5 L16 14 L18 21.5 L12 17 L6 21.5 L8 14 L2 9.5 L9.5 9 Z', x: '78%', y: '12%', s: 40, t: 7 },
    { d: 'M12 4 V20 M4 12 H20', x: '88%', y: '58%', s: 28, t: 9 },
    { d: 'M2 14 Q7 4 12 14 T22 14', x: '66%', y: '70%', s: 44, t: 8 },
    { d: 'M12 3 A9 9 0 1 1 11.9 3 Z', x: '92%', y: '22%', s: 22, t: 6 },
  ]
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {bits.map((bit, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          width={bit.s}
          height={bit.s}
          className="absolute text-white/25"
          style={{ left: bit.x, top: bit.y }}
          animate={{ y: [0, -10, 0], rotate: [0, i % 2 ? 12 : -12, 0] }}
          transition={{ duration: bit.t, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d={bit.d} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      ))}
    </span>
  )
}

function Glance({ data }: { data: Teaching }) {
  const students = data.classes.reduce((n, c) => n + c.students, 0)
  const waiting = data.classes.filter((c) => c.pending > 0)
  return (
    <motion.div className="mt-6 grid gap-4 md:grid-cols-3" variants={stagger(0.07)} initial="hidden" animate="shown">
      <motion.div variants={pop} className="rounded-3xl border-2 border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-muted-foreground">Working right now</p>
          <LiveBadge />
        </div>
        <p className="mt-2 font-display text-4xl font-semibold">{data.live_now}</p>
        <p className="text-sm text-muted-foreground">{data.live_now === 1 ? 'student is' : 'students are'} answering something of yours</p>
      </motion.div>
      <motion.div variants={pop} className={cn('rounded-3xl border-2 p-5', data.pending ? 'border-sun-400 bg-sun-100 dark:bg-sun-600/20' : 'border-border bg-surface')}>
        <p className="text-sm font-bold text-muted-foreground">Waiting to join</p>
        <p className="mt-2 font-display text-4xl font-semibold">{data.pending}</p>
        {waiting.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {waiting.map((c) => (
              <Link key={c.id} to={`/classes/${c.id}/requests`} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-sm font-bold hover:underline">
                <UserPlus weight="bold" className="size-3.5" />
                {c.name} · {c.pending}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody at the door</p>
        )}
      </motion.div>
      <motion.div variants={pop} className="rounded-3xl border-2 border-border bg-surface p-5">
        <p className="text-sm font-bold text-muted-foreground">Your classes</p>
        <p className="mt-2 font-display text-4xl font-semibold">{data.classes.length}</p>
        <p className="text-sm text-muted-foreground">{students} {students === 1 ? 'student' : 'students'} in all</p>
      </motion.div>
    </motion.div>
  )
}

function Recent({ data }: { data: Teaching }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold">Shared lately</h2>
      <motion.ul className="mt-4 grid gap-4 md:grid-cols-2" variants={stagger(0.06)} initial="hidden" animate="shown">
        {data.recent.map((share) => {
          const look = lookOfKind(share.kind)
          const due = share.due_at && !share.closed ? dueLabel(share.due_at) : null
          return (
            <motion.li key={share.id} variants={rise}>
              <Link to={`/assignments/${share.id}`} className="flex items-center gap-4 rounded-3xl border-2 border-border bg-surface p-4 transition-colors hover:border-hover-border">
                <Ring done={share.completed} of={share.audience} tone={look.colour} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                    <look.Icon weight="fill" className={cn('size-4', look.text)} />
                    {share.class_name}
                  </span>
                  <span className="block truncate font-display text-lg font-semibold">{share.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {share.in_progress > 0 && <Chip tone="mint">{share.in_progress} going</Chip>}
                    {share.average !== null && <Chip tone="grape">average {Math.round(share.average)}%</Chip>}
                    {share.closed ? <Chip>Closed</Chip> : due && <Chip tone={due.late ? 'coral' : 'sun'}>{due.late ? 'Past due' : due.text}</Chip>}
                  </span>
                </span>
                <ArrowRight weight="bold" className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}

/** Finished out of everyone it is for, as a ring that fills. */
function Ring({ done, of, tone }: { done: number; of: number; tone: string }) {
  const share = of ? done / of : 0
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx={18} cy={18} r={15.5} fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth={4} />
        <motion.circle
          cx={18}
          cy={18}
          r={15.5}
          fill="none"
          stroke={tone}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray="97.4 97.4"
          initial={{ strokeDashoffset: 97.4 }}
          animate={{ strokeDashoffset: 97.4 * (1 - share) }}
          transition={{ type: 'spring', stiffness: 60, damping: 16, delay: 0.2 }}
        />
      </svg>
      <span className="font-display text-sm font-semibold">
        {done}/{of}
      </span>
    </span>
  )
}

function Classes({ data }: { data: Teaching }) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Your classes</h2>
        <Link to="/classes" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          All classes <ArrowRight weight="bold" className="size-4" />
        </Link>
      </div>
      <motion.ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" variants={stagger(0.05)} initial="hidden" animate="shown">
        {data.classes.map((room) => {
          const look = lookOf(room.theme)
          return (
            <motion.li key={room.id} variants={rise} whileHover={{ y: -4 }}>
              <Link to={`/classes/${room.id}`} className={cn('relative block overflow-hidden rounded-3xl p-5 shadow-sm', look.hero, look.onHero)}>
                <p className="text-sm font-bold opacity-85">{[room.subject, room.grade_label].filter(Boolean).join(' · ') || 'Class'}</p>
                <p className="font-display text-2xl font-semibold">{room.name}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold opacity-90">
                  <UsersThree weight="fill" className="size-4" />
                  {room.students} {room.students === 1 ? 'student' : 'students'}
                  {room.pending > 0 && ` · ${room.pending} waiting`}
                </p>
                <ChalkboardTeacher weight="duotone" aria-hidden className="absolute -right-3 -bottom-4 size-24 opacity-20" />
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}

/** Set up: a class, students in it, and something shared with them. */
function setUp(data: Teaching): boolean {
  return data.classes.some((c) => c.students > 0) && data.recent.length > 0
}

/** The first four steps, ticking themselves off from what is really there. */
function GettingStarted({ data }: { data: Teaching }) {
  const studio = useLearnStudio()
  const first = data.classes[0]
  const hasClass = data.classes.length > 0
  const hasStudents = data.classes.some((c) => c.students > 0)
  const shared = data.recent.length > 0
  const steps = [
    { done: hasClass, label: 'Make your first class', detail: 'Give it a name and a colour.', action: <ButtonLink to="/classes?new=1" size="sm">Make a class</ButtonLink> },
    { done: hasStudents, label: 'Invite your students', detail: 'Share a code, a link or a QR code.', action: first ? <ButtonLink to={`/classes/${first.id}/invite`} size="sm" variant="outline">Invite</ButtonLink> : null },
    { done: shared, label: 'Make a quiz or flashcards', detail: 'From real sources, in about a minute.', action: <button type="button" onClick={() => studio.create('quiz')} className="text-sm font-bold text-primary hover:underline">Make a quiz</button> },
    { done: shared, label: 'Share it with the class', detail: 'Then watch the results come in live.', action: <ButtonLink to="/library" size="sm" variant="outline">Your library</ButtonLink> },
  ]
  return (
    <section className="mt-8 rounded-3xl border-2 border-dashed border-border p-6">
      <h2 className="font-display text-2xl font-semibold">Let's get your class going</h2>
      <p className="mt-1 text-muted-foreground">Four small steps. You'll be done before your coffee cools.</p>
      <motion.ol className="mt-5 space-y-3" variants={stagger(0.08)} initial="hidden" animate="shown">
        {steps.map((step, i) => (
          <motion.li key={step.label} variants={rise} className={cn('flex items-center gap-3 rounded-2xl bg-surface p-4', step.done && 'opacity-70')}>
            {step.done ? (
              <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}>
                <CheckCircle weight="fill" className="size-7 text-correct" />
              </motion.span>
            ) : (
              <Circle weight="bold" className="size-7 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className={cn('block font-bold', step.done && 'line-through decoration-2')}>
                {i + 1}. {step.label}
              </span>
              <span className="text-sm text-muted-foreground">{step.detail}</span>
            </span>
            {!step.done && step.action}
          </motion.li>
        ))}
      </motion.ol>
    </section>
  )
}
