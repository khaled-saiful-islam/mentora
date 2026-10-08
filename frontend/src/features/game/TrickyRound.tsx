/**
 * Tricky ones (§23.2): after a game, a calm round of the challenges that were
 * missed — no timer, no points, nothing recorded. The game is finished, so its
 * answers have already been revealed to the player; each is marked here, in
 * the browser, and explained again.
 */
import { motion } from 'motion/react'
import { ArrowLeft, Target } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui'
import type { Attempt, GameChallenge } from '@/features/play/api'
import { playedById } from '@/features/play/session'
import { useSound } from '@/lib/sound'
import { spring, useCalmMotion } from '@/motion'
import { useGameKeys } from './styles/keys'
import { OptionTile } from './styles/OptionTile'
import type { OptionState } from './styles/types'
import { ChallengeCard } from './ui/ChallengeCard'
import { Reveal } from './ui/Reveal'

export interface Tricky {
  item: GameChallenge
  answer: number
  explanation: string
}

const isChallenge = (item: Attempt['items'][number]): item is GameChallenge => 'options' in item && 'has_hint' in item

/** The challenges a finished game got wrong — or ran out of time on — with their answers. */
export function trickyOnes(attempt: Attempt): Tricky[] {
  if (attempt.kind !== 'game' || attempt.status !== 'completed') return []
  const played = playedById(attempt.answered)
  return attempt.items.filter(isChallenge).flatMap((item) => {
    const answer = played[item.id]?.reveal?.answer
    if (played[item.id]?.correct !== false || typeof answer !== 'number') return []
    return [{ item, answer, explanation: played[item.id]?.reveal?.explanation ?? '' }]
  })
}

export function TrickyRound({ tricky, onDone }: { tricky: Tricky[]; onDone: () => void }) {
  const calm = useCalmMotion()
  const sound = useSound()
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [fixed, setFixed] = useState(0)
  const current = tricky[index] as Tricky | undefined
  const answered = choice !== null

  const choose = (n: number) => {
    if (!current || answered) return
    setChoice(n)
    sound(n === current.answer ? 'correct' : 'wrong')
    if (n === current.answer) setFixed((f) => f + 1)
  }
  useGameKeys(Boolean(current) && !answered, current?.item.options.length ?? 0, { pick: choose })
  const stateOf = (n: number): OptionState => (!current || !answered ? 'idle' : n === current.answer ? 'right' : n === choice ? 'wrong' : 'faded')

  if (!current) return <Done fixed={fixed} total={tricky.length} onDone={onDone} />
  const last = index === tricky.length - 1
  return (
    <section aria-label="Tricky ones" className="space-y-4">
      <p className="flex items-center gap-2 font-display text-lg font-semibold text-muted-foreground">
        <Target weight="duotone" className="size-6 text-primary" aria-hidden />
        No timer, no points — just another go.
      </p>
      <ChallengeCard
        prompt={current.item.prompt}
        label={`Tricky one ${index + 1} of ${tricky.length}`}
        boss={false}
        hint={null}
        canHint={false}
        buddyName=""
        onHint={() => {}}
        reading={false}
        readable={false}
        onRead={() => {}}
      />
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Answers">
        {current.item.options.map((text, n) => (
          <OptionTile key={`${current.item.id}-${n}`} n={n} text={text} state={stateOf(n)} disabled={answered} calm={calm} onChoose={() => choose(n)} />
        ))}
      </div>
      {answered && (
        <Reveal
          correct={choice === current.answer}
          right={current.item.options[current.answer]}
          explanation={current.explanation}
          timedOut={false}
          // No points in this round.
          earned={0}
          reading={false}
          readable={false}
          onRead={() => {}}
          onNext={() => (setChoice(null), setIndex((i) => i + 1))}
          nextLabel={last ? 'All done' : 'Next one'}
        />
      )}
    </section>
  )
}

function Done({ fixed, total, onDone }: { fixed: number; total: number; onDone: () => void }) {
  return (
    <motion.section initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="rounded-3xl border-4 border-correct bg-surface p-6 text-center shadow-lg">
      <p className="font-celebrate text-4xl text-primary">{fixed === total ? 'All fixed!' : 'Good practice!'}</p>
      <p className="mt-2 text-lg">
        You got {fixed} of the {total} tricky {total === 1 ? 'one' : 'ones'} this time.
      </p>
      <Button size="lg" className="mt-5" onClick={onDone}>
        <ArrowLeft weight="bold" className="size-5" />
        Back to my score
      </Button>
    </motion.section>
  )
}
