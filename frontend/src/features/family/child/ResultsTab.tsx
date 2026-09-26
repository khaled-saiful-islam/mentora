/** Strengths and weak spots by skill, and every finished try. */
import { Barbell, ChartLineUp, Trophy } from '@phosphor-icons/react'
import { Alert, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { History, SkillBars, SkillList } from '@/features/results/ResultsPage'
import { familyApi } from '../api'
import { useChildResource } from './useChild'

export function ResultsTab({ childId, first }: { childId: string; first: string }) {
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
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <SkillList title="Strong at" Icon={Trophy} tone="mint" skills={data.insights.strengths} empty="Strengths show after a few more tries." practiseLink={false} />
        <SkillList title="Worth practising" Icon={Barbell} tone="coral" skills={data.insights.practise} empty="Nothing tricky right now." practiseLink={false} />
      </div>
      {data.insights.skills.length > 0 && <SkillBars skills={data.insights.skills} />}
      <History rows={data.attempts} title={`Everything ${first} has finished`} hrefFor={(row) => `/children/${childId}/attempts/${row.attempt_id}`} />
    </div>
  )
}
