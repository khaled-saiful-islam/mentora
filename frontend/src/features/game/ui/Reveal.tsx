/**
 * After an answer: right or not, the right answer if it was missed, and why —
 * read aloud on a tap — then on with the story. Every answer teaches, even a
 * timer that ran out.
 */
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle, SpeakerHigh, Stop, XCircle } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { OptionText } from './ChallengeCard'

export interface RevealProps {
  correct: boolean
  /** The right option's words, shown when it was missed. */
  right: string | null
  explanation: string
  timedOut: boolean
  earned: number
  reading: boolean
  readable: boolean
  onRead: () => void
  onNext: () => void
  /** What the button says: "Next", "Finish the chapter", … */
  nextLabel: string
}

const RIGHT = ['Brilliant!', 'You got it!', 'Spot on!', 'Yes!', 'Superb!']
const MISSED = ['Not quite', 'Nearly!', 'Good try']

export function Reveal({ correct, right, explanation, timedOut, earned, reading, readable, onRead, onNext, nextLabel }: RevealProps) {
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => next.current?.focus(), [])
  const words = correct ? RIGHT[earned % RIGHT.length] : timedOut ? "Time's up!" : MISSED[earned % MISSED.length]
  return (
    <motion.div
      role="status"
      aria-label="How it went"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      className={cn('w-full rounded-3xl border-4 bg-surface p-4 shadow-lg sm:p-5', correct ? 'border-correct' : 'border-wrong')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-2xl font-bold">
          {correct ? <CheckCircle weight="fill" className="size-8 text-correct" /> : <XCircle weight="fill" className="size-8 text-wrong" />}
          {words}
        </p>
        {correct && earned > 0 && (
          <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="rounded-full bg-star-soft px-3 py-1 font-display text-lg font-bold text-foreground">
            +{earned}
          </motion.span>
        )}
      </div>
      {!correct && right && (
        <p className="mt-2 text-lg">
          The answer is <OptionText text={right} className="font-bold" />.
        </p>
      )}
      {explanation && <p className="mt-2 break-words text-base text-muted-foreground">{explanation}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {readable && explanation && (
          <Button variant="ghost" onClick={onRead} aria-pressed={reading}>
            {reading ? <Stop weight="fill" className="size-4" /> : <SpeakerHigh weight="bold" className="size-4" />}
            {reading ? 'Stop' : 'Read why'}
          </Button>
        )}
        <Button ref={next} variant="sun" size="lg" onClick={onNext}>
          {nextLabel}
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </div>
    </motion.div>
  )
}
