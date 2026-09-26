/**
 * After a live lesson, for the teacher: who came and for how long, every
 * question asked and by whom, how the group did on each quick check, and how
 * the quiz is going.
 */
import { ChartBar, ChatCircleText, CheckCircle, ListChecks, UsersThree } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Card, Skeleton } from '@/components/ui'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { roomApi } from '../room/api'

export function Summary({ id }: { id: string }) {
  const summary = useResource(`live-summary:${id}`, () => roomApi.summary(id))
  if (!summary.data) return summary.error ? null : <Skeleton className="h-64 rounded-3xl" />
  const { attendance, questions, checkins, quiz } = summary.data
  const came = attendance.filter((a) => a.came).length
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-semibold">How it went</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat Icon={UsersThree} value={`${came} of ${attendance.length}`} label="came" />
        <Stat Icon={ChatCircleText} value={String(questions.length)} label={questions.length === 1 ? 'question asked' : 'questions asked'} />
        <Stat
          Icon={ChartBar}
          value={quiz?.average !== null && quiz?.average !== undefined ? `${quiz.average}%` : quiz ? `${quiz.completed} done` : '—'}
          label={quiz?.average !== null && quiz?.average !== undefined ? `quiz average · ${quiz.completed} done` : 'quiz'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 font-display text-lg font-semibold">Attendance</h3>
          <ul className="space-y-1.5">
            {attendance.map((a) => (
              <li key={a.student_id} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/50">
                <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', a.came ? 'bg-mint-400' : 'bg-muted-foreground/30')} />
                <span className="min-w-0 flex-1 break-words font-semibold">{a.name}</span>
                <span className="text-sm text-muted-foreground">
                  {a.removed
                    ? 'removed'
                    : a.came && a.joined_at
                      ? `joined ${new Date(a.joined_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${a.minutes} min`
                      : "didn't come"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-display text-lg font-semibold">Questions</h3>
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions this time.</p>
          ) : (
            <ol className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="rounded-2xl bg-muted/50 p-3 text-sm">
                  <p className="break-words font-semibold">
                    {q.name}: {q.question ?? <span className="italic text-muted-foreground">({q.status === 'missed' ? 'called on, but did not ask' : q.status})</span>}
                  </p>
                  {q.answer && <p className="mt-1 break-words text-muted-foreground">Astra: {q.answer}</p>}
                  {q.status === 'redirected' && <p className="mt-1 text-xs font-bold text-destructive">Kept out of the room by the safety rules</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {checkins.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <ListChecks weight="bold" className="size-5 text-kind-live" aria-hidden />
            Quick checks
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {checkins.map((c, i) => {
              const most = Math.max(1, ...c.counts)
              return (
                <div key={i}>
                  <p className="mb-2 break-words font-semibold">{c.question}</p>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {c.right} of {c.answered} got it right
                  </p>
                  {c.options.map((option, n) => (
                    <div key={n} className="mb-1 flex items-center gap-2 text-sm">
                      {n === c.answer ? <CheckCircle weight="fill" className="size-4 shrink-0 text-mint-700" aria-label="Right answer" /> : <span className="size-4 shrink-0" />}
                      <span className="w-[min(45%,12rem)] break-words">{option}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full', n === c.answer ? 'bg-mint-400' : 'bg-kind-live-vivid/50')} style={{ width: `${(c.counts[n] / most) * 100}%` }} />
                      </span>
                      <span className="w-5 text-right font-bold">{c.counts[n]}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {quiz && (
        <Link to={`/assignments/${quiz.assignment_id}`} className="inline-flex items-center gap-2 font-bold text-primary hover:underline">
          See the quiz results
        </Link>
      )}
    </section>
  )
}

function Stat({ Icon, value, label }: { Icon: typeof UsersThree; value: string; label: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-kind-live-vivid/15 text-kind-live">
        <Icon weight="bold" className="size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="break-words font-display text-2xl font-bold leading-tight">{value}</p>
        <p className="break-words text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}
