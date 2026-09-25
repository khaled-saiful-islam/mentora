/**
 * The pieces of an assignment's results: the headline numbers, the spread of
 * scores, and three ways to look closer — by student, by question, by skill.
 */
import { motion } from 'motion/react'
import { CaretRight, Check, Clock, Warning } from '@phosphor-icons/react'
import { Chip } from '@/components/ui'
import { BuddyAvatar } from '@/features/buddies'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { band, isActive, type AssignmentResults, type QuestionResult, type StudentResult } from './api'

const BAND = {
  strong: 'bg-correct text-white',
  growing: 'bg-star text-grape-900',
  practise: 'bg-wrong text-white',
} as const

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n)}%`)

export function Summary({ results }: { results: AssignmentResults }) {
  const { summary } = results
  const done = summary.assigned ? summary.completed / summary.assigned : 0
  const cards = [
    { label: 'Finished', value: `${summary.completed}/${summary.assigned}`, note: `${Math.round(done * 100)}% of the class` },
    { label: 'Average', value: pct(summary.average), note: 'first tries' },
    { label: 'Median', value: pct(summary.median), note: 'the middle score' },
    { label: 'Still going', value: String(summary.in_progress), note: `${summary.not_started} not started` },
  ]
  return (
    <motion.div className="grid grid-cols-2 gap-3 md:grid-cols-4" variants={stagger(0.06)} initial="hidden" animate="shown">
      {cards.map((card) => (
        <motion.div key={card.label} variants={rise} className="rounded-3xl border-2 border-border bg-surface p-4">
          <p className="text-sm font-bold text-muted-foreground">{card.label}</p>
          <p className="mt-1 font-display text-3xl font-semibold">{card.value}</p>
          <p className="text-sm text-muted-foreground">{card.note}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}

export function Distribution({ buckets }: { buckets: number[] }) {
  const most = Math.max(1, ...buckets)
  return (
    <section className="rounded-3xl border-2 border-border bg-surface p-5">
      <h2 className="font-display text-xl font-semibold">How scores spread</h2>
      <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label={`Scores: ${buckets.map((n, i) => `${n} scored ${i * 10}–${i === 9 ? 100 : i * 10 + 9}%`).join(', ')}`}>
        {buckets.map((count, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {count > 0 && <span className="text-xs font-bold">{count}</span>}
            <motion.div
              className={cn('w-full rounded-t-lg', i >= 8 ? 'bg-correct' : i >= 5 ? 'bg-star' : 'bg-wrong')}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(count ? 8 : 2, (count / most) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 16, delay: i * 0.04 }}
              style={{ opacity: count ? 1 : 0.25 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[0.65rem] font-bold text-muted-foreground">
        {buckets.map((_, i) => (
          <span key={i} className="flex-1">{i * 10}</span>
        ))}
      </div>
    </section>
  )
}

const STATUS: Record<StudentResult['status'], { label: string; tone: 'mint' | 'sun' | 'neutral' }> = {
  completed: { label: 'Finished', tone: 'mint' },
  in_progress: { label: 'Going', tone: 'sun' },
  not_started: { label: 'Not started', tone: 'neutral' },
}

export function Students({ students, onOpen }: { students: StudentResult[]; onOpen: (student: StudentResult) => void }) {
  return (
    <motion.ul className="space-y-2" variants={stagger(0.03)} initial="hidden" animate="shown">
      {students.map((s) => {
        const status = STATUS[s.status]
        return (
          <motion.li key={s.student_id} variants={rise}>
            <button
              type="button"
              onClick={() => onOpen(s)}
              disabled={s.status === 'not_started'}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-2.5 text-left transition-colors enabled:hover:border-hover-border disabled:cursor-default"
            >
              <BuddyAvatar buddy={s.buddy} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{s.name}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Chip tone={status.tone}>{status.label}</Chip>
                  {s.late && <Chip tone="coral"><Clock weight="bold" className="size-3" />Late</Chip>}
                  {s.attempts > 1 && <Chip>{s.attempts} tries · best {pct(s.best)}</Chip>}
                </span>
              </span>
              {s.status === 'in_progress' ? <LiveProgress student={s} /> : <span className="font-display text-xl font-semibold">{pct(s.first)}</span>}
              {s.status !== 'not_started' && <CaretRight weight="bold" className="size-4 text-muted-foreground" />}
            </button>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}

export function Questions({ questions, kind }: { questions: QuestionResult[]; kind: string }) {
  // Hardest first: what to reteach is what a teacher looks for.
  const ordered = [...questions].sort((a, b) => rate(a) - rate(b))
  return (
    <motion.ol className="space-y-3" variants={stagger(0.04)} initial="hidden" animate="shown">
      {ordered.map((q) => {
        const share = rate(q)
        return (
          <motion.li key={q.item_id} variants={rise} className="rounded-3xl border-2 border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl font-display text-sm font-semibold', q.answered ? BAND[band(share)] : 'bg-muted text-muted-foreground')}>
                {q.answered ? `${Math.round(share * 100)}%` : '—'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{q.prompt}</p>
                <p className="text-sm text-muted-foreground">
                  {q.correct} of {q.answered} {kind === 'flashcard' ? 'knew it' : 'right'}
                  {q.answered > 0 && share < 0.5 && (
                    <span className="ml-2 inline-flex items-center gap-1 font-bold text-destructive">
                      <Warning weight="fill" className="size-3.5" />
                      worth going over
                    </span>
                  )}
                </p>
                {q.choices.length > 0 && q.answered > 0 && <Choices q={q} />}
              </div>
            </div>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}

function Choices({ q }: { q: QuestionResult }) {
  const letters = 'ABCDEFGH'
  return (
    <ul className="mt-3 space-y-1">
      {q.choices.map((count, i) => {
        const right = i === q.answer
        return (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={cn('grid size-6 place-items-center rounded-md font-bold', right ? 'bg-correct text-white' : 'bg-muted text-muted-foreground')}>
              {right ? <Check weight="bold" className="size-3.5" /> : letters[i]}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.span
                className={cn('block h-full rounded-full', right ? 'bg-correct' : 'bg-foreground/30')}
                initial={{ width: 0 }}
                animate={{ width: `${(count / q.answered) * 100}%` }}
              />
            </span>
            <span className="w-6 text-right font-bold">{count}</span>
          </li>
        )
      })}
    </ul>
  )
}

function rate(q: QuestionResult): number {
  return q.answered ? q.correct / q.answered : 1
}

export function SkillHeatmap({ results }: { results: AssignmentResults }) {
  const students = results.students.filter((s) => results.heat[s.student_id])
  // Only skills someone has answered on: an empty column says nothing.
  const skills = results.skills.filter((skill) => students.some((s) => results.heat[s.student_id]?.[skill.slug] !== undefined))
  if (students.length === 0 || skills.length === 0) {
    return <p className="text-muted-foreground">The skill map fills in as students finish.</p>
  }
  return (
    <div className="overflow-x-auto rounded-3xl border-2 border-border bg-surface p-4">
      <table className="w-full min-w-max border-separate border-spacing-1.5 text-sm">
        <thead>
          <tr>
            <th className="text-left font-bold text-muted-foreground">Student</th>
            {skills.map((skill) => (
              <th key={skill.slug} className="px-1 text-center font-bold capitalize text-muted-foreground">{skill.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.student_id}>
              <td className="pr-3 font-bold whitespace-nowrap">{s.name}</td>
              {skills.map((skill) => {
                const share = results.heat[s.student_id]?.[skill.slug]
                return (
                  <td key={skill.slug} className={cn('min-w-16 rounded-lg px-2 py-2 text-center font-bold', share === undefined ? 'bg-muted text-muted-foreground' : BAND[band(share)])}>
                    {share === undefined ? '—' : `${Math.round(share * 100)}%`}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A student taking it right now: how far along, filling as they answer. */
function LiveProgress({ student }: { student: StudentResult }) {
  const active = isActive(student)
  const share = student.total ? student.answered / student.total : 0
  return (
    <span className="flex w-36 flex-col items-end gap-1">
      <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        {active && (
          <span className="relative flex size-2">
            <motion.span className="absolute inline-flex size-full rounded-full bg-mint-400" animate={{ scale: [1, 2.4], opacity: [0.7, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />
            <span className="relative inline-flex size-2 rounded-full bg-mint-400" />
          </span>
        )}
        {active ? 'Taking it now' : 'Paused'} · {student.answered}/{student.total}
      </span>
      <span className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.span className="block h-full rounded-full bg-primary" initial={false} animate={{ width: `${Math.max(4, share * 100)}%` }} transition={{ type: 'spring', stiffness: 140, damping: 20 }} />
      </span>
    </span>
  )
}
