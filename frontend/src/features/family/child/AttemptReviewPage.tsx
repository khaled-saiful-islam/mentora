/** One of the child's tries, answer by answer — what they chose, what was
 *  right and why. The same review the child sees, without Try again. */
import { CaretLeft, BookOpenText } from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import { Alert, ButtonLink, Skeleton } from '@/components/ui'
import { Review } from '@/features/play/Review'
import { starsFor } from '@/features/play/session'
import { useResource } from '@/hooks/useResource'
import { Page } from '@/motion'
import { familyApi } from '../api'

export default function AttemptReviewPage() {
  const { childId = '', attemptId = '' } = useParams()
  const children = useResource('my-children', () => familyApi.children())
  const attempt = useResource(`child-attempt:${childId}:${attemptId}`, () => familyApi.attempt(childId, attemptId))
  const first = children.data?.items.find((c) => c.id === childId)?.first_name ?? 'Your child'
  const data = attempt.data
  const stars = data ? starsFor(data.percent) : 0
  return (
    <Page className="mx-auto w-full max-w-3xl px-4 py-8">
      <ButtonLink to={`/children/${childId}/work`} variant="ghost" size="sm" className="-ml-3">
        <CaretLeft weight="bold" className="size-4" aria-hidden /> Back to {first}
      </ButtonLink>
      {attempt.error && <Alert className="mt-4">{attempt.error}</Alert>}
      {!data ? (
        !attempt.error && <Skeleton className="mt-4 h-64 rounded-[1.75rem]" />
      ) : (
        <>
          <div className="mt-2">
            <h1 className="break-words font-display text-3xl font-semibold">{data.title}</h1>
            <p className="mt-1 text-lg text-muted-foreground">
              {data.status === 'completed' ? (
                <>
                  {data.score} of {data.max_score} · {Math.round(data.percent)}% · {'★'.repeat(stars)}
                  {'☆'.repeat(3 - stars)}
                </>
              ) : (
                `${first} hasn't finished this yet`
              )}
            </p>
          </div>
          <div className="mt-6">
            {data.kind === 'study_guide' ? (
              <p className="flex items-center gap-3 rounded-2xl bg-muted/50 p-4">
                <BookOpenText weight="duotone" className="size-6 shrink-0 text-kind-family" aria-hidden />
                A study guide is read part by part. The score is from the quick checks after each part.
              </p>
            ) : (
              <Review attempt={data} whose={`${first}'s answer`} />
            )}
          </div>
        </>
      )}
    </Page>
  )
}
