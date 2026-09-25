/**
 * Taking something: start or pick up where you left off, play it with your
 * buddy in the corner, then celebrate and look back over it.
 *
 * `/play/:id` is a class assignment, `/practice/:id` your own practice set,
 * `/attempts/:id` one you have already started or finished.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowClockwise, CaretLeft } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Button, ButtonLink, Skeleton } from '@/components/ui'
import { errorMessage } from '@/features/auth/errors'
import { Buddy, tipFor, type BuddyHandle } from '@/features/buddies'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuth } from '@/lib/auth'
import { firstName } from '@/lib/user'
import { Page } from '@/motion'
import { playApi, type Attempt, type Finish } from './api'
import { FinishScreen } from './FinishScreen'
import { PLAYERS } from './players'
import { Review } from './Review'
import { starsFor } from './session'

export type PlaySource = 'assignment' | 'practice' | 'attempt'

type Step =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'playing'; attempt: Attempt }
  | { name: 'finishing'; attempt: Attempt }
  | { name: 'finished'; finish: Finish }
  | { name: 'review'; attempt: Attempt }

const EXIT: Record<PlaySource, string> = { assignment: '/', practice: '/library', attempt: '/results' }

function begin(source: PlaySource, id: string): Promise<Attempt> {
  if (source === 'assignment') return playApi.start(id)
  if (source === 'practice') return playApi.practise(id)
  return playApi.attempt(id)
}

export default function PlayPage({ source }: { source: PlaySource }) {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>({ name: 'loading' })
  const buddy = useRef<BuddyHandle>(null)

  const load = useCallback(async (from: PlaySource, key: string) => {
    setStep({ name: 'loading' })
    try {
      const attempt = await begin(from, key)
      setStep(attempt.status === 'completed' ? { name: 'review', attempt } : { name: 'playing', attempt })
    } catch (error) {
      setStep({ name: 'error', message: errorMessage(error) })
    }
  }, [])

  useEffect(() => {
    void load(source, id)
  }, [load, source, id])

  // A hello and a tip as the first question lands — once per attempt. Keyed
  // on the attempt rather than guarded by a flag, so a re-run of the effect
  // (React's dev double-invoke) reschedules instead of skipping.
  const playing = step.name === 'playing' ? step.attempt : null
  const playingId = playing?.id
  const playingKind = playing?.kind
  useEffect(() => {
    if (!playingId) return
    const place = playingKind === 'flashcard' ? 'flashcard' : playingKind === 'study_guide' ? 'guide' : 'quiz'
    const hello = window.setTimeout(() => buddy.current?.cue('hello', { name: user ? firstName(user) : undefined }), 700)
    const tip = window.setTimeout(() => buddy.current?.say(tipFor(place)), 4400)
    return () => (window.clearTimeout(hello), window.clearTimeout(tip))
    // The user object changes on every preference save; the greeting should not.
  }, [playingId, playingKind])

  const finish = useCallback(async (attempt: Attempt) => {
    setStep({ name: 'finishing', attempt })
    try {
      setStep({ name: 'finished', finish: await playApi.complete(attempt.id) })
    } catch (error) {
      setStep({ name: 'error', message: errorMessage(error) })
    }
  }, [])

  const exitTo = EXIT[source]
  const again = (attempt: Attempt) => {
    if (!attempt.can_retake) return null
    return () => void load(attempt.assignment_id ? 'assignment' : 'practice', attempt.assignment_id ?? attempt.set_id)
  }

  if (step.name === 'loading' || step.name === 'finishing') return <Loading finishing={step.name === 'finishing'} />
  if (step.name === 'error') {
    return (
      <Page className="mx-auto max-w-xl px-4 py-16 text-center">
        <Alert>{step.message}</Alert>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => void load(source, id)}>
            <ArrowClockwise weight="bold" className="size-4" />
            Try again
          </Button>
          <ButtonLink to={exitTo}>Back</ButtonLink>
        </div>
      </Page>
    )
  }
  if (step.name === 'finished') {
    const { attempt } = step.finish
    return (
      <FinishScreen
        finish={step.finish}
        onReview={() => setStep({ name: 'review', attempt })}
        onRetake={again(attempt)}
        leaderboardTo={attempt.leaderboard && attempt.assignment_id ? `/leaderboard/${attempt.assignment_id}` : null}
      />
    )
  }
  if (step.name === 'review') return <ReviewPage attempt={step.attempt} exitTo={exitTo} onRetake={again(step.attempt)} />

  const Player = PLAYERS[step.attempt.kind]
  return (
    <>
      <Player key={step.attempt.id} attempt={step.attempt} buddy={buddy} exitTo={exitTo} onFinished={() => void finish(step.attempt)} />
      <BuddyCorner buddy={user?.buddy} handle={buddy} />
    </>
  )
}

/** The buddy keeping you company: small in a corner, above everything. */
function BuddyCorner({ buddy, handle }: { buddy: string | null | undefined; handle: React.RefObject<BuddyHandle> }) {
  const wide = useMediaQuery('(min-width: 768px)')
  return (
    <motion.div
      initial={{ y: 140, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.3 }}
      className="pointer-events-none fixed right-2 bottom-2 z-50 md:right-6 md:bottom-4 [&_button]:pointer-events-auto"
    >
      <Buddy key={wide ? 'wide' : 'narrow'} ref={handle} buddy={buddy} size={wide ? 136 : 84} bubble="above-left" />
    </motion.div>
  )
}

function Loading({ finishing }: { finishing: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-4 px-4">
      <AnimatePresence>
        <motion.p key={String(finishing)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-2xl font-semibold text-muted-foreground">
          {finishing ? 'Adding up your score…' : 'Getting it ready…'}
        </motion.p>
      </AnimatePresence>
      <Skeleton className="h-10 w-2/3" />
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function ReviewPage({ attempt, exitTo, onRetake }: { attempt: Attempt; exitTo: string; onRetake: (() => void) | null }) {
  const stars = starsFor(attempt.percent)
  return (
    <Page className="mx-auto w-full max-w-3xl px-4 py-8">
      <ButtonLink to={exitTo} variant="ghost" size="sm" className="-ml-3">
        <CaretLeft weight="bold" className="size-4" />
        Back
      </ButtonLink>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{attempt.title}</h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {attempt.score} of {attempt.max_score} · {Math.round(attempt.percent)}% · {'★'.repeat(stars)}
            {'☆'.repeat(3 - stars)}
          </p>
        </div>
        {onRetake && (
          <Button variant="sun" onClick={onRetake}>
            <ArrowClockwise weight="bold" className="size-4" />
            Try again
          </Button>
        )}
      </div>
      <div className="mt-6">
        <Review attempt={attempt} />
      </div>
    </Page>
  )
}
