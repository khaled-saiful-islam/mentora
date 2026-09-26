import { motion } from 'motion/react'
import { ArrowRight, CalendarBlank, CheckCircle, HeartStraight, Lock, PlayCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Chip } from '@/components/ui'
import { lookOfKind, nounOf } from '@/features/learning/kinds'
import { lookOf } from '@/lib/palette'
import { dueLabel } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise } from '@/motion'
import type { HomeWork, Todo } from './api'

const ACTION: Record<Todo['status'], string> = {
  todo: 'Start',
  in_progress: 'Keep going',
  done: 'Look back',
  closed: 'Closed',
}

/** One thing a teacher shared: what it is, where from, when it is due, and
 *  a big button to get going. */
export function TodoCard({ todo, showClass = true }: { todo: Todo; showClass?: boolean }) {
  const room = lookOf(todo.class_theme)
  const origin = showClass ? (
    <Chip className={room.soft}>
      <span className={cn('size-2 rounded-full', room.dot)} />
      {todo.class_name}
    </Chip>
  ) : null
  return <WorkCard todo={todo} to={`/play/${todo.assignment_id}`} origin={origin} />
}

/** Something a parent sent home (§20.4), on the child's own home: the same
 *  card, saying who it is from. */
export function FromHomeCard({ work }: { work: HomeWork }) {
  const todo: Todo = {
    assignment_id: work.share_id,
    title: work.title,
    kind: work.kind,
    class_id: '',
    class_name: '',
    class_theme: 'grape',
    item_count: work.item_count,
    status: work.status,
    best: work.best,
    attempts: work.attempts,
    due_at: work.due_at,
    feedback_mode: 'instant',
    shared_at: work.shared_at,
  }
  const origin = (
    <Chip className="bg-kind-family-vivid/12 text-kind-family">
      <HeartStraight weight="fill" className="size-3.5" aria-hidden />
      From {work.label}
    </Chip>
  )
  const action = work.status === 'done' ? 'Go again' : undefined
  return <WorkCard todo={todo} to={`/from-home/${work.share_id}`} origin={origin} action={action} />
}

function WorkCard({ todo, to, origin, action }: { todo: Todo; to: string; origin: React.ReactNode; action?: string }) {
  const kind = lookOfKind(todo.kind)
  const due = todo.due_at && todo.status !== 'done' ? dueLabel(todo.due_at) : null
  const closed = todo.status === 'closed'
  const content = (
    <>
      <div className={cn('relative flex items-center gap-3 overflow-hidden p-4', kind.hero)}>
        <motion.span
          className="relative z-10 grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20"
          whileHover={{ rotate: [0, -10, 10, 0] }}
        >
          <kind.Icon weight="fill" className="size-7" />
        </motion.span>
        <div className="relative z-10 min-w-0">
          <p className="text-sm font-bold opacity-90">
            {kind.label} · {nounOf(todo.kind, todo.item_count)}
          </p>
          <p className="break-words font-display text-xl font-semibold">{todo.title}</p>
        </div>
        <kind.Icon weight="fill" aria-hidden className="pointer-events-none absolute -right-3 -bottom-4 size-24 opacity-15" />
      </div>
      <div className="flex flex-wrap items-center gap-2 p-4">
        {origin}
        {due && (
          <Chip tone={due.late ? 'coral' : due.soon ? 'sun' : 'neutral'}>
            <CalendarBlank weight="bold" className="size-3.5" />
            {due.text}
          </Chip>
        )}
        {todo.status === 'done' && todo.best !== null && (
          <Chip tone="mint">
            <CheckCircle weight="fill" className="size-3.5" />
            Best {Math.round(todo.best)}%
          </Chip>
        )}
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-bold transition-transform group-hover:translate-x-0.5',
            closed ? 'bg-muted text-muted-foreground' : todo.status === 'done' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground shadow-press',
          )}
        >
          {closed ? <Lock weight="bold" className="size-4" /> : todo.status === 'in_progress' ? <PlayCircle weight="fill" className="size-4" /> : null}
          {action ?? ACTION[todo.status]}
          {!closed && <ArrowRight weight="bold" className="size-4" />}
        </span>
      </div>
    </>
  )
  return (
    <motion.li variants={rise} layout>
      {closed ? (
        <div className="overflow-hidden rounded-[1.75rem] border-2 border-border bg-surface opacity-70">{content}</div>
      ) : (
        <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
          <Link
            to={to}
            className="group block overflow-hidden rounded-[1.75rem] border-2 border-border bg-surface shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
          >
            {content}
          </Link>
        </motion.div>
      )}
    </motion.li>
  )
}
