/** Strengths and weak spots by skill, and every finished try. */
import { ChartLineUp } from '@phosphor-icons/react'
import { Alert, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { ResultsView } from '@/features/results/ResultsView'
import { familyApi } from '../api'
import { useChildResource } from './useChild'

export function ResultsTab({ childId, first, buddy }: { childId: string; first: string; buddy?: string | null }) {
  const results = useChildResource(childId, 'results', () => familyApi.results(childId))
  if (results.error) return <Alert>{results.error}</Alert>
  const data = results.data
  if (!data) return <Skeleton className="h-64 rounded-[1.75rem]" />
  if (data.attempts.length === 0) {
    return (
      <EmptyState
        art={<EmptyArt Icon={ChartLineUp} tone="from-kind-family-vivid/30 to-grape-100" />}
        title="No results yet"
        body={`When ${first} finishes a quiz or some flashcards, their scores and skills grow here.`}
      />
    )
  }
  return <ResultsView results={data} name={first} buddy={buddy ?? null} hrefFor={(row) => `/children/${childId}/attempts/${row.attempt_id}`} />
}
