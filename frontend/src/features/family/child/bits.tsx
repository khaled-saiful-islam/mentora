/**
 * The rows a parent's child page is made of: a piece of work, a live lesson,
 * a section heading. Plain rows rather than the child's big play cards — a
 * parent is reading, not about to press Start.
 */
import { ArrowRight, CalendarBlank, CheckCircle, Clock, Lock, Warning } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { ButtonLink, Chip } from '@/components/ui'
import { lookOfKind, nounOf } from '@/features/learning/kinds'
import { STATUS_WORDS, type SessionSummary } from '@/features/live/sessions/api'
import type { HomeWork, Todo } from '@/features/play/api'
import { homeAsWork, type ChildOverview, type ChildWork } from '../api'
import { dueLabel } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise } from '@/motion'

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** How a piece of work stands against its due date, in a parent's words. */
export function dueFor(todo: Todo, now: Date = new Date()): { text: string; late: boolean; soon: boolean } | null {
  if (!todo.due_at || todo.status === 'done' || todo.status === 'closed') return null
  const due = dueLabel(todo.due_at, now)
  return due.late ? { ...due, text: `Past due · was due ${when(todo.due_at)}` } : due
}

export const isLate = (todo: Todo, now: Date = new Date()) => Boolean(dueFor(todo, now)?.late)

/** Work sent home, as rows: "From you" when this parent sent it. */
export function fromHome(items: HomeWork[] | undefined, me: string | undefined): ChildWork[] {
  return (items ?? []).map((w) => homeAsWork(w, w.parent_id === me ? 'From you' : `From ${w.label}`))
}

/** What is still to do — from school and from home — past due first. */
export function waitingOf(overview: ChildOverview, me: string | undefined): Todo[] {
  const home = fromHome(overview.from_home, me).filter((w) => w.status !== 'done')
  return [...overview.todo, ...home].sort((a, b) => Number(isLate(b)) - Number(isLate(a)))
}

const STATUS: Record<Todo['status'], { label: string; tone: 'neutral' | 'sky' | 'mint' }> = {
  todo: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'Started', tone: 'sky' },
  done: { label: 'Done', tone: 'mint' },
  closed: { label: 'Closed', tone: 'neutral' },
}

export function SectionTitle({ title, note, action }: { title: string; note?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-[min(100%,14rem)] flex-1">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      {action}
    </div>
  )
}

/** One piece of work: what it is, where from, how it stands. */
export function WorkRow({ todo, reviewTo }: { todo: Todo; reviewTo?: string | null }) {
  const kind = lookOfKind(todo.kind)
  const due = dueFor(todo)
  const status = STATUS[todo.status]
  return (
    <motion.li
      variants={rise}
      layout
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-2xl border-2 bg-surface p-3',
        due?.late ? 'border-coral-400/60 bg-coral-100/40 dark:bg-coral-700/10' : 'border-border',
      )}
    >
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', kind.hero)}>
        <kind.Icon weight="fill" className="size-6" aria-hidden />
      </span>
      <div className="min-w-[min(100%,14rem)] flex-1">
        <p className="break-words font-bold leading-snug">{todo.title}</p>
        <p className="text-sm text-muted-foreground">
          {kind.label} · {nounOf(todo.kind, todo.item_count)} · {todo.class_name}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {due ? (
          <Chip tone={due.late ? 'coral' : due.soon ? 'sun' : 'neutral'}>
            {due.late ? <Warning weight="fill" className="size-3.5" aria-hidden /> : <CalendarBlank weight="bold" className="size-3.5" aria-hidden />}
            {due.text}
          </Chip>
        ) : null}
        <Chip tone={status.tone}>
          {todo.status === 'done' ? <CheckCircle weight="fill" className="size-3.5" aria-hidden /> : todo.status === 'closed' ? <Lock weight="bold" className="size-3.5" aria-hidden /> : null}
          {status.label}
          {todo.status === 'done' && todo.best !== null && ` · best ${Math.round(todo.best)}%`}
        </Chip>
        {reviewTo && (
          <ButtonLink to={reviewTo} size="sm" variant="outline">
            See answers <ArrowRight weight="bold" className="size-4" aria-hidden />
          </ButtonLink>
        )}
      </div>
    </motion.li>
  )
}

/** A live lesson: when, with whom, and whether they came. */
export function LessonRow({ lesson, attended, action }: { lesson: SessionSummary; attended?: boolean; action?: React.ReactNode }) {
  const now = lesson.status === 'live' || lesson.status === 'lobby'
  return (
    <motion.li variants={rise} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-grape-800 to-[hsl(var(--kind-live))] text-white">
        <CalendarBlank weight="fill" className="size-6" aria-hidden />
      </span>
      <div className="min-w-[min(100%,14rem)] flex-1">
        <p className="break-words font-bold leading-snug">{lesson.title}</p>
        <p className="text-sm text-muted-foreground">
          {[lesson.scheduled_at ? when(lesson.scheduled_at) : null, lesson.class_name, lesson.teacher_name && `with ${lesson.teacher_name}`].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {lesson.duration_minutes && (
          <Chip>
            <Clock weight="bold" className="size-3.5" aria-hidden /> {lesson.duration_minutes} min
          </Chip>
        )}
        {attended === undefined ? (
          <Chip tone={now ? 'coral' : 'grape'}>{STATUS_WORDS[lesson.status]}</Chip>
        ) : (
          <Chip tone={attended ? 'mint' : 'sun'}>{attended ? 'Was there' : 'Missed it'}</Chip>
        )}
        {action}
      </div>
    </motion.li>
  )
}
