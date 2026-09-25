/**
 * How an assignment went, for the teacher who shared it: who has finished,
 * how the scores spread, which questions tripped people up, and each
 * student's skills — filterable by group, and live as students finish.
 */
import { useState } from 'react'
import { CaretLeft, ChartBar, Check, Lock, Question, Ranking, Student, X } from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import { Alert, ButtonLink, Chip, Skeleton } from '@/components/ui'
import { LiveBadge } from '@/components/ui/LiveBadge'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Segmented'
import { classesApi } from '@/features/classes/api'
import { lookOfKind } from '@/features/learning/kinds'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { dueLabel } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Page } from '@/motion'
import { isActive, resultsApi, type AssignmentResults, type StudentDrill, type StudentResult } from './api'
import { Distribution, Questions, SkillHeatmap, Students, Summary } from './ResultViews'

type View = 'students' | 'questions' | 'skills'

const VIEWS = [
  { value: 'students', label: 'Students', icon: <Student weight="bold" className="size-4" /> },
  { value: 'questions', label: 'Questions', icon: <Question weight="bold" className="size-4" /> },
  { value: 'skills', label: 'Skills', icon: <ChartBar weight="bold" className="size-4" /> },
] as const

export default function AssignmentResultsPage() {
  const { assignmentId = '' } = useParams()
  const [group, setGroup] = useState<string>('all')
  const [view, setView] = useState<View>('students')
  const [open, setOpen] = useState<StudentResult | null>(null)
  const results = useResource(`results-${assignmentId}-${group}`, () => resultsApi.forAssignment(assignmentId, group === 'all' ? null : group))
  const classId = results.data?.assignment.class_id
  const groups = useResource(classId ? `groups-${classId}` : null, () => classesApi.groups(classId ?? ''))

  // Live: every student starting, answering and finishing shows up here.
  useLive(['progress', 'assignments'], (m) => m.assignment_id === assignmentId && void results.reload())

  const data = results.data
  const look = lookOfKind(data?.assignment.kind ?? 'quiz')
  const due = data?.assignment.due_at ? dueLabel(data.assignment.due_at) : null

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <ButtonLink to={classId ? `/classes/${classId}/assignments` : '/classes'} variant="ghost" size="sm" className="-ml-3">
        <CaretLeft weight="bold" className="size-4" />
        Back to the class
      </ButtonLink>
      {results.error && <Alert className="mt-4">{results.error}</Alert>}
      {!data ? (
        <div className="mt-4 space-y-4">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      ) : (
        <>
          <header className="mt-2 flex flex-wrap items-center gap-3">
            <span className={cn('grid size-12 place-items-center rounded-2xl shadow-press', look.hero)}>
              <look.Icon weight="fill" className="size-7" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-3xl font-semibold">{data.assignment.title}</h1>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chip>{look.label}</Chip>
                {due && <Chip tone={due.late ? 'coral' : 'sun'}>{due.late ? 'Past due' : due.text}</Chip>}
                {data.assignment.closed && <Chip tone="grape"><Lock weight="bold" className="size-3" />Closed</Chip>}
              </div>
            </div>
            <LiveNow results={data} />
            {data.assignment.leaderboard && data.assignment.kind === 'quiz' && (
              <ButtonLink to={`/leaderboard/${assignmentId}`} variant="sun">
                <Ranking weight="fill" className="size-5" />
                Leaderboard
              </ButtonLink>
            )}
          </header>

          {(groups.data?.items.length ?? 0) > 0 && (
            <Segmented
              className="mt-5"
              label="Show a group"
              value={group}
              onChange={setGroup}
              options={[{ value: 'all', label: 'Everyone' }, ...(groups.data?.items ?? []).map((g) => ({ value: g.id, label: g.name }))]}
            />
          )}

          <div className="mt-5 space-y-5">
            <Summary results={data} />
            {data.summary.completed > 0 && <Distribution buckets={data.summary.distribution} />}
          </div>

          <Segmented className="mt-8" label="Look at" value={view} onChange={setView} options={VIEWS} />
          <div className="mt-4">
            {view === 'students' && <Students students={data.students} onOpen={setOpen} />}
            {view === 'questions' && <Questions questions={data.questions} kind={data.assignment.kind} />}
            {view === 'skills' && <SkillHeatmap results={data} />}
          </div>
        </>
      )}
      {open && <Drill assignmentId={assignmentId} student={open} onClose={() => setOpen(null)} />}
    </Page>
  )
}

/** One student's every answer, try by try. */
function Drill({ assignmentId, student, onClose }: { assignmentId: string; student: StudentResult; onClose: () => void }) {
  const drill = useResource(`drill-${assignmentId}-${student.student_id}`, () => resultsApi.student(assignmentId, student.student_id))
  return (
    <Dialog open onClose={onClose} title={student.name} description="Every answer, try by try." size="lg">
      {drill.error && <Alert>{drill.error}</Alert>}
      {!drill.data ? <Skeleton className="h-40 rounded-2xl" /> : <Attempts drill={drill.data} />}
    </Dialog>
  )
}

function Attempts({ drill }: { drill: StudentDrill }) {
  const byId = new Map(drill.items.map((item) => [String(item.id), item]))
  return (
    <div className="space-y-6">
      {drill.attempts.map((attempt) => (
        <section key={attempt.id}>
          <h3 className="font-display text-lg font-semibold">
            Try {attempt.number} · {attempt.status === 'completed' ? `${Math.round(attempt.percent)}%` : 'still going'}
          </h3>
          <ol className="mt-2 space-y-1.5">
            {attempt.answers.map((answer) => {
              const item = byId.get(answer.item_id) ?? {}
              const options = Array.isArray(item.options) ? (item.options as string[]) : null
              const said = options && typeof answer.response.choice === 'number' ? options[answer.response.choice] : answer.response.knew ? 'Knew it' : 'Not yet'
              return (
                <li key={answer.item_id} className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2">
                  <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white', answer.correct ? 'bg-correct' : 'bg-wrong')}>
                    {answer.correct ? <Check weight="bold" className="size-3.5" /> : <X weight="bold" className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{String(item.prompt ?? item.front ?? answer.item_id)}</span>
                    <span className="text-sm text-muted-foreground">
                      {said} · {Math.max(1, Math.round(answer.time_ms / 1000))}s
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

/** Live, and how many are taking it this minute. */
function LiveNow({ results }: { results: AssignmentResults }) {
  const now = results.students.filter((s) => isActive(s)).length
  return (
    <span className="flex items-center gap-2">
      <LiveBadge />
      {now > 0 && (
        <Chip tone="mint" className="text-sm">
          {now} taking it now
        </Chip>
      )}
    </span>
  )
}
