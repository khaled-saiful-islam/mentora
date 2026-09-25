import { motion } from 'motion/react'
import { ArrowRight, ChalkboardTeacher, Coins, Exam, Heartbeat, Student, UsersThree } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Alert, Skeleton } from '@/components/ui'
import type { Resource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import type { Overview } from './api'

const number = new Intl.NumberFormat()

export function OverviewTab({ overview }: { overview: Resource<Overview> }) {
  const data = overview.data
  if (overview.error) return <Alert>{overview.error}</Alert>
  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
    )
  }
  const { users, learning, safety } = data
  return (
    <div className="space-y-6">
      {safety.high > 0 && (
        <Link to="/admin/safety" className="flex items-center gap-3 rounded-3xl border-2 border-wrong bg-wrong-soft p-4 font-bold hover:brightness-95">
          <Heartbeat weight="fill" className="size-7 shrink-0 text-destructive" />
          <span className="flex-1">
            {safety.high === 1 ? 'A student may need support.' : `${safety.high} students may need support.`} Please look today.
          </span>
          <ArrowRight weight="bold" className="size-5" />
        </Link>
      )}
      <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={stagger(0.06)} initial="hidden" animate="shown">
        <Stat Icon={UsersThree} label="People" value={users.total} note={`${users.active_7d} active this week · ${users.new_7d} new`} />
        <Stat Icon={Student} label="Students" value={users.students} note={`${learning.memberships} in classes`} />
        <Stat Icon={ChalkboardTeacher} label="Teachers" value={users.teachers} note={`${learning.classes} classes · ${users.admins} admins`} />
        <Stat Icon={Exam} label="Finished this week" value={learning.attempts_7d} note={learning.average_7d === null ? 'no scores yet' : `average ${Math.round(learning.average_7d)}%`} />
        <Stat Icon={Exam} label="Sets made" value={learning.sets} note={`${learning.practice_sets} practice · ${learning.assignments} shared`} />
        <Stat Icon={Coins} label="Tokens, 24 hours" value={data.tokens_24h} note="chat and generation" />
        <Stat Icon={Heartbeat} label="Safety queue" value={safety.open} note={`${safety.high} urgent · ${safety.medium} to check`} tone={safety.high ? 'alert' : undefined} to="/admin/safety" />
        <Stat Icon={UsersThree} label="Suspended" value={users.suspended} note="can't sign in" to="/admin/users?status=suspended" />
      </motion.div>
      <Trend trend={data.trend} />
    </div>
  )
}

function Stat({ Icon, label, value, note, tone, to }: { Icon: Icon; label: string; value: number; note: string; tone?: 'alert'; to?: string }) {
  const body = (
    <>
      <span className={cn('grid size-10 place-items-center rounded-2xl', tone ? 'bg-wrong-soft text-destructive' : 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100')}>
        <Icon weight="duotone" className="size-6" />
      </span>
      <p className="mt-3 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-semibold">{number.format(value)}</p>
      <p className="text-sm text-muted-foreground">{note}</p>
    </>
  )
  const frame = 'block rounded-3xl border-2 border-border bg-surface p-4'
  return (
    <motion.div variants={rise}>
      {to ? <Link to={to} className={cn(frame, 'transition-colors hover:border-hover-border')}>{body}</Link> : <div className={frame}>{body}</div>}
    </motion.div>
  )
}

/** Two weeks of activity as paired bars: finishes and chat messages a day. */
function Trend({ trend }: { trend: Overview['trend'] }) {
  const most = Math.max(1, ...trend.map((d) => Math.max(d.attempts, d.messages)))
  return (
    <section className="rounded-3xl border-2 border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">The last two weeks</h2>
        <p className="flex gap-4 text-sm font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-primary" />Finished</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-sky-400" />Chat messages</span>
        </p>
      </div>
      <div className="mt-4 flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={trend.map((d) => `${d.day}: ${d.attempts} finished, ${d.messages} messages`).join('; ')}>
        {trend.map((day, i) => (
          <div key={day.day} className="flex h-full flex-1 items-end justify-center gap-0.5" title={`${day.day}: ${day.attempts} finished, ${day.messages} messages, ${day.signups} joined`}>
            {[
              [day.attempts, 'bg-primary'],
              [day.messages, 'bg-sky-400'],
            ].map(([value, tone]) => (
              <motion.span
                key={String(tone)}
                className={cn('w-full max-w-4 rounded-t-md', String(tone))}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(Number(value) ? 4 : 1, (Number(value) / most) * 100)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 18, delay: i * 0.02 }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-center text-[0.65rem] font-bold text-muted-foreground sm:gap-2">
        {trend.map((day) => (
          <span key={day.day} className="flex-1">{new Date(`${day.day}T00:00:00`).getDate()}</span>
        ))}
      </div>
    </section>
  )
}
