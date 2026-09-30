/**
 * A quiz or flashcards for the teacher or parent who made them, two ways:
 *
 * - **Look through** (first): every question one at a time with its answer
 *   showing, and Next to move on — nothing to answer (`LookThrough.tsx`).
 * - **Play as a student**: the real players and the real finish screen, in
 *   the look for the set's year. Answers are marked here and never saved
 *   (`preview.ts`).
 */
import { ArrowClockwise, ArrowLeft, Eye, GameController, ListNumbers } from '@phosphor-icons/react'
import { useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Alert, Button, Skeleton } from '@/components/ui'
import { Segmented } from '@/components/ui/Segmented'
import type { BuddyHandle } from '@/features/buddies'
import { learningApi, type SetDetail } from '@/features/learning/api'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { Page } from '@/motion'
import type { Attempt, Finish } from './api'
import { PlayBackendProvider } from './backend'
import { FinishScreen } from './FinishScreen'
import { levelForGrade, PlayLevelProvider } from './level'
import { LookThrough } from './LookThrough'
import { BuddyCorner, BuddyDock } from './BuddyDock'
import { PLAYERS } from './players'
import { previewAttempt, PreviewGrader } from './preview'
import { Review } from './Review'
import { starsFor } from './session'

export default function PreviewPage() {
  const { setId = '' } = useParams()
  const loaded = useResource(`set:${setId}`, () => learningApi.get(setId))
  if (loaded.error) return <Page className="mx-auto max-w-3xl p-6"><Alert>{loaded.error}</Alert></Page>
  const set = loaded.data
  if (!set) return <Page className="mx-auto max-w-3xl p-6"><Skeleton className="h-72 rounded-[2rem]" /></Page>
  // A study guide has its own preview, made for reading and printing.
  if (set.kind === 'study_guide') return <Navigate to={`/library/${set.id}/preview`} replace />
  return <Preview set={set} />
}

type Step = { name: 'playing' } | { name: 'finished'; finish: Finish } | { name: 'review'; attempt: Attempt }
type Mode = 'look' | 'play'

function Preview({ set }: { set: SetDetail }) {
  const { user } = useAuth()
  // The look follows the set's own year, as it will for a student in it.
  const level = levelForGrade(set.grade_level)
  const [round, setRound] = useState(0)
  const [mode, setMode] = useState<Mode>('look')
  const [step, setStep] = useState<Step>({ name: 'playing' })
  const buddy = useRef<BuddyHandle>(null)
  // A fresh attempt and a fresh marker each round, so Start over is clean.
  const attempt = useMemo(() => previewAttempt(set), [set, round])
  const grader = useMemo(() => new PreviewGrader(set), [set, round])
  const back = `/library/${set.id}`
  const again = () => (setRound((r) => r + 1), setStep({ name: 'playing' }))
  const play = () => (again(), setMode('play'), window.scrollTo({ top: 0 }))
  const Player = PLAYERS[set.kind]

  return (
    <PlayLevelProvider value={level}>
      <PlayBackendProvider value={grader}>
        <div className="border-b border-border bg-sun-100/70 dark:bg-sun-600/15">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            <p className="inline-flex min-w-[min(100%,14rem)] flex-1 items-center gap-2 text-sm font-bold">
              <Eye weight="fill" className="size-4 shrink-0 text-sun-600 dark:text-sun-300" aria-hidden />
              <span className="break-words">
                {mode === 'look'
                  ? 'Preview — every question with its answer. Nothing to answer, nothing saved.'
                  : `Preview — this is how ${set.grade_label ? `a ${set.grade_label} student` : 'a student'} sees it. Nothing is saved.`}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="How to preview"
                value={mode}
                onChange={(m) => (m === 'play' ? play() : setMode('look'))}
                options={[
                  { value: 'look', label: 'Look through', icon: <ListNumbers weight="bold" className="size-4" /> },
                  { value: 'play', label: 'Play as a student', icon: <GameController weight="bold" className="size-4" /> },
                ]}
              />
              {mode === 'play' && (
                <Button variant="ghost" size="sm" onClick={again}>
                  <ArrowClockwise weight="bold" className="size-4" aria-hidden /> Start over
                </Button>
              )}
              <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
                <ArrowLeft weight="bold" className="size-4" aria-hidden /> Back to editing
              </Link>
            </div>
          </div>
        </div>

        {mode === 'look' && <LookThrough set={set} onPlay={play} />}
        {mode === 'play' && step.name === 'playing' && (
          <BuddyDock>
            <Player key={round} attempt={attempt} buddy={buddy} exitTo={back} onFinished={() => setStep({ name: 'finished', finish: grader.finish(attempt) })} />
            <BuddyCorner buddy={user?.buddy} handle={buddy} />
          </BuddyDock>
        )}
        {mode === 'play' && step.name === 'finished' && (
          <FinishScreen
            finish={step.finish}
            onReview={() => setStep({ name: 'review', attempt: step.finish.attempt })}
            onRetake={again}
            leaderboardTo={null}
            home={{ to: back, label: 'Back to editing' }}
          />
        )}
        {mode === 'play' && step.name === 'review' && (
          <Page className="mx-auto w-full max-w-3xl px-4 py-8">
            <h1 className="break-words font-display text-3xl font-semibold">{step.attempt.title}</h1>
            <p className="mt-1 text-lg text-muted-foreground">
              {step.attempt.score} of {step.attempt.max_score} · {Math.round(step.attempt.percent)}% · {'★'.repeat(starsFor(step.attempt.percent))}
              {'☆'.repeat(3 - starsFor(step.attempt.percent))}
            </p>
            <div className="mt-6">
              <Review attempt={step.attempt} />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="sun" onClick={again}>
                <ArrowClockwise weight="bold" className="size-4" aria-hidden /> Try again
              </Button>
              <Link to={back} className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline">
                <ArrowLeft weight="bold" className="size-4" aria-hidden /> Back to editing
              </Link>
            </div>
          </Page>
        )}
      </PlayBackendProvider>
    </PlayLevelProvider>
  )
}
