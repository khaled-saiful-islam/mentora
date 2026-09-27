/**
 * A student's own results, told so a child can follow them (`ResultsView`):
 * a summary from their buddy, recent scores, skills in three groups, and
 * everything they finished — each one opens to its answers.
 */
import { ArrowRight, ChartLineUp, Trophy } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Alert, Chip, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { playApi, type SkillInsight } from '@/features/play/api'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Page } from '@/motion'
import { ResultsView } from './ResultsView'

export default function ResultsPage() {
  const { user } = useAuth()
  const results = useResource('my-results', () => playApi.results())
  // Practice made for a weak skill, so its "Practise" button can go straight there.
  const home = useResource('results-home', () => playApi.home())
  const data = results.data
  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">My results</h1>
      <p className="mt-1 text-muted-foreground">How you're growing — what you've got, and what to practise next.</p>
      {results.error && <Alert className="mt-6">{results.error}</Alert>}
      {!data ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-48 rounded-[2rem]" />
          <Skeleton className="h-40 rounded-[1.75rem]" />
        </div>
      ) : data.attempts.length === 0 ? (
        <EmptyState
          className="mt-8"
          art={<EmptyArt Icon={ChartLineUp} tone="from-grape-100 to-mint-100" />}
          title="No results yet"
          body="Finish a quiz or some flashcards and your results will grow here."
        />
      ) : (
        <div className="mt-8">
          <ResultsView results={data} buddy={user?.buddy ?? null} madeForYou={home.data?.made_for_you ?? []} />
        </div>
      )}
    </Page>
  )
}

export function SkillList({
  title,
  Icon,
  tone,
  skills,
  empty,
  practiseLink = true,
}: {
  title: string
  Icon: typeof Trophy
  tone: 'mint' | 'coral'
  skills: SkillInsight[]
  empty: string
  /** The student's own page points to their practice. */
  practiseLink?: boolean
}) {
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
      {practiseLink && tone === 'coral' && skills.length > 0 && (
        <Link to="/practice" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          Go to my practice <ArrowRight weight="bold" className="size-4" />
        </Link>
      )}
    </section>
  )
}
