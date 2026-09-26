/** This week at a glance: what is waiting, how it went, what is next. */
import { ArrowRight, Barbell, Confetti, Sparkle, Star, Trophy } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Chip, Skeleton } from '@/components/ui'
import { lookOfKind } from '@/features/learning/kinds'
import type { HistoryRow } from '@/features/play/api'
import { SkillList } from '@/features/results/ResultsPage'
import { starsFor } from '@/features/play/session'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import type { ChildOverview } from '../api'
import { LessonRow, SectionTitle, waitingOf, WorkRow } from './bits'
import { useAuth } from '@/lib/auth'

export function OverviewTab({ childId, first, overview }: { childId: string; first: string; overview: ChildOverview | null }) {
  const { user } = useAuth()
  if (!overview) return <Skeleton className="h-72 rounded-[1.75rem]" />
  const base = `/children/${childId}`
  const waiting = waitingOf(overview, user?.id)
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <SectionTitle title="Waiting" note={`What ${first} hasn't finished yet, from school and from home.`} action={<More to={`${base}/work`} label="All work" />} />
        {waiting.length === 0 ? (
          <Calm Icon={Confetti} text={`Nothing waiting — ${first} is all caught up.`} />
        ) : (
          <motion.ul className="space-y-2" variants={stagger(0.05)} initial="hidden" animate="shown">
            {waiting.map((todo) => (
              <WorkRow key={todo.assignment_id} todo={todo} />
            ))}
          </motion.ul>
        )}
      </section>

      <div className="grid gap-10 @2xl:grid-cols-2">
        <section className="space-y-3">
          <SectionTitle title="Latest results" action={<More to={`${base}/results`} label="All results" />} />
          {overview.latest.length === 0 ? (
            <Calm Icon={Trophy} text={`When ${first} finishes a quiz or deck, the score shows here.`} />
          ) : (
            <motion.ul className="space-y-2" variants={stagger(0.05)} initial="hidden" animate="shown">
              {overview.latest.map((row) => (
                <ResultRow key={row.attempt_id} row={row} to={`${base}/attempts/${row.attempt_id}`} />
              ))}
            </motion.ul>
          )}
        </section>
        <section className="space-y-3">
          <SectionTitle title="Coming up live" action={<More to={`${base}/schedule`} label="Schedule" />} />
          {overview.upcoming.length === 0 ? (
            <Calm Icon={Sparkle} text="No live lessons on the schedule." />
          ) : (
            <motion.ul className="space-y-2" variants={stagger(0.05)} initial="hidden" animate="shown">
              {overview.upcoming.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} />
              ))}
            </motion.ul>
          )}
        </section>
      </div>

      {(overview.strengths.length > 0 || overview.practise.length > 0) && (
        <section className="grid gap-4 @xl:grid-cols-2">
          <SkillList title="Strong at" Icon={Trophy} tone="mint" skills={overview.strengths} empty="Strengths show after a few more tries." practiseLink={false} />
          <SkillList title="Worth practising" Icon={Barbell} tone="coral" skills={overview.practise} empty="Nothing tricky right now." practiseLink={false} />
        </section>
      )}

      {overview.made_for_you.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="Made for them" note={`Practice Mentora made from what ${first} found tricky.`} action={<More to={`${base}/practice`} label="All practice" />} />
          <motion.ul className="flex flex-wrap gap-2" variants={stagger(0.05)} initial="hidden" animate="shown">
            {overview.made_for_you.map((made) => (
              <motion.li key={made.set_id} variants={rise}>
                <Chip tone={made.done ? 'mint' : 'sun'} className="px-3 py-1.5 text-sm">
                  <Barbell weight="fill" className="size-4" aria-hidden />
                  {made.title}
                  {made.done ? ' · done' : ' · not tried yet'}
                </Chip>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}
    </div>
  )
}

function More({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
      {label} <ArrowRight weight="bold" className="size-4" aria-hidden />
    </Link>
  )
}

function Calm({ Icon, text }: { Icon: typeof Trophy; text: string }) {
  return (
    <p className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border p-4 text-muted-foreground">
      <Icon weight="duotone" className="size-6 shrink-0 text-kind-family" aria-hidden />
      {text}
    </p>
  )
}

export function ResultRow({ row, to }: { row: HistoryRow; to: string }) {
  const look = lookOfKind(row.kind)
  const stars = starsFor(row.percent)
  return (
    <motion.li variants={rise}>
      <Link to={to} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 transition-colors hover:border-hover-border">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', look.hero)}>
          <look.Icon weight="fill" className="size-6" aria-hidden />
        </span>
        <span className="min-w-[min(100%,12rem)] flex-1">
          <span className="block break-words font-bold leading-snug">{row.title}</span>
          <span className="text-sm text-muted-foreground">
            {row.purpose === 'practice' ? 'Practice' : row.purpose === 'family' ? 'From home' : 'From school'} · {timeAgo(row.completed_at)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex" aria-label={`${stars} stars`}>
            {[0, 1, 2].map((i) => (
              <Star key={i} weight="fill" className={cn('size-5', i < stars ? 'text-star' : 'text-foreground/10')} />
            ))}
          </span>
          <span className="w-14 text-right font-display text-lg font-semibold">{Math.round(row.percent)}%</span>
        </span>
      </Link>
    </motion.li>
  )
}
