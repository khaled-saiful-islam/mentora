/**
 * A student's own results: what they are strong at, what to practise, and
 * everything they have finished — each one opens to its answers.
 */
import { motion } from 'motion/react'
import { ArrowRight, Barbell, ChartLineUp, Star, Trophy } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Alert, Chip, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { lookOfKind } from '@/features/learning/kinds'
import { playApi, type HistoryRow, type SkillInsight } from '@/features/play/api'
import { starsFor } from '@/features/play/session'
import { useResource } from '@/hooks/useResource'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Page, rise, stagger } from '@/motion'

export default function ResultsPage() {
  const results = useResource('my-results', () => playApi.results())
  const data = results.data
  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">My results</h1>
      <p className="mt-1 text-muted-foreground">How you're growing, skill by skill.</p>
      {results.error && <Alert className="mt-6">{results.error}</Alert>}
      {!data ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-[1.75rem]" />
          <Skeleton className="h-48 rounded-[1.75rem]" />
        </div>
      ) : data.attempts.length === 0 ? (
        <EmptyState
          className="mt-8"
          art={<EmptyArt Icon={ChartLineUp} tone="from-grape-100 to-mint-100" />}
          title="No results yet"
          body="Finish a quiz or some flashcards and your results will grow here."
        />
      ) : (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <SkillList title="Strong at" Icon={Trophy} tone="mint" skills={data.insights.strengths} empty="Keep going — strengths show after a few tries." />
            <SkillList title="Practise next" Icon={Barbell} tone="coral" skills={data.insights.practise} empty="Nothing tricky right now. Brilliant!" />
          </div>
          {data.insights.skills.length > 0 && <SkillBars skills={data.insights.skills} />}
          <History rows={data.attempts} />
        </>
      )}
    </Page>
  )
}

function SkillList({ title, Icon, tone, skills, empty }: { title: string; Icon: typeof Trophy; tone: 'mint' | 'coral'; skills: SkillInsight[]; empty: string }) {
  return (
    <section className={cn('rounded-[1.75rem] p-5', tone === 'mint' ? 'bg-correct-soft' : 'bg-wrong-soft')}>
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <Icon weight="fill" className={cn('size-6', tone === 'mint' ? 'text-success' : 'text-destructive')} />
        {title}
      </h2>
      {skills.length === 0 ? (
        <p className="mt-2 text-foreground/70">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill.subject + skill.slug}>
              <Chip className="bg-surface px-3 py-1 text-sm capitalize text-foreground">
                {skill.label} · {Math.round(skill.mastery * 100)}%
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {tone === 'coral' && skills.length > 0 && (
        <Link to="/library" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          Make a practice set <ArrowRight weight="bold" className="size-4" />
        </Link>
      )}
    </section>
  )
}

const LEVEL = { strong: 'bg-correct', growing: 'bg-star', practise: 'bg-wrong' } as const

function SkillBars({ skills }: { skills: SkillInsight[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-semibold">Every skill</h2>
      <motion.ul className="mt-4 space-y-3" variants={stagger(0.04)} initial="hidden" animate="shown">
        {skills.map((skill) => (
          <motion.li key={skill.subject + skill.slug} variants={rise} className="rounded-2xl bg-surface p-3 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-bold capitalize">
                {skill.label} <span className="text-sm font-normal text-muted-foreground">· {skill.subject}</span>
              </p>
              <p className="text-sm font-bold text-muted-foreground">
                {skill.correct}/{skill.total}
              </p>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn('h-full rounded-full', LEVEL[skill.level])}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, skill.mastery * 100)}%` }}
                transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.2 }}
              />
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  )
}

function History({ rows }: { rows: HistoryRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold">Everything you've finished</h2>
      <motion.ul className="mt-4 space-y-2" variants={stagger(0.04)} initial="hidden" animate="shown">
        {rows.map((row) => {
          const look = lookOfKind(row.kind)
          const stars = starsFor(row.percent)
          return (
            <motion.li key={row.attempt_id} variants={rise}>
              <Link to={`/attempts/${row.attempt_id}`} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 transition-colors hover:border-hover-border">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', look.hero)}>
                  <look.Icon weight="fill" className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-bold leading-snug">{row.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {row.purpose === 'practice' ? 'Practice' : 'Class'} · {timeAgo(row.completed_at)}
                  </span>
                </span>
                <span className="flex" aria-label={`${stars} stars`}>
                  {[0, 1, 2].map((i) => (
                    <Star key={i} weight="fill" className={cn('size-5', i < stars ? 'text-star' : 'text-foreground/10')} />
                  ))}
                </span>
                <span className="w-14 text-right font-display text-lg font-semibold">{Math.round(row.percent)}%</span>
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}
