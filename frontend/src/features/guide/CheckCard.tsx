import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Lightbulb, Target, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { OPTION_LOOKS } from '@/features/learning/options'
import { cn } from '@/lib/utils'
import { spring, wobble } from '@/motion'

export interface CheckResult {
  choice: number | null
  correct: boolean | null
  answer?: number
  explanation?: string
}

/**
 * The one question at the end of each part: did it go in? Answered once;
 * then it shows which was right and why, and the way on.
 */
export function CheckCard({
  prompt,
  options,
  result,
  busy,
  onChoose,
  onNext,
  nextLabel,
}: {
  prompt: string
  options: string[]
  result: CheckResult | null
  busy: boolean
  onChoose: (choice: number) => void
  onNext: () => void
  nextLabel: string
}) {
  const answered = result !== null
  return (
    <section className="mt-10 rounded-[2rem] border-2 border-kind-study-guide-vivid/40 bg-surface p-5 shadow-press sm:p-7" aria-label="Check yourself">
      <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-kind-study-guide">
        <span className="grid size-8 place-items-center rounded-full bg-kind-study-guide-vivid text-white">
          <Target weight="fill" className="size-4" aria-hidden />
        </span>
        Check yourself
      </p>
      <h2 className="mt-3 font-display text-xl font-bold leading-snug md:text-2xl">{prompt}</h2>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {options.map((option, index) => {
          const look = OPTION_LOOKS[index]
          const picked = result?.choice === index
          const right = answered && result?.answer === index
          const wrongPick = picked && result?.correct === false
          return (
            <motion.button
              key={index}
              type="button"
              disabled={answered || busy}
              onClick={() => onChoose(index)}
              whileHover={answered ? undefined : { y: -2 }}
              whileTap={answered ? undefined : { scale: 0.97 }}
              animate={wrongPick ? wobble : right ? { scale: [1, 1.04, 1] } : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left font-bold transition-colors',
                !answered && 'border-border bg-surface hover:border-hover-border',
                right && 'border-correct bg-correct-soft',
                wrongPick && 'border-wrong bg-wrong-soft',
                answered && !right && !wrongPick && 'border-border opacity-60',
              )}
            >
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', look.tile)} aria-hidden>
                <look.Shape weight="fill" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">{option}</span>
              {right && <Check weight="bold" className="size-5 shrink-0 text-correct" aria-label="Right answer" />}
              {wrongPick && <X weight="bold" className="size-5 shrink-0 text-wrong" aria-label="Your answer" />}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: spring.gentle }}
            className="overflow-hidden"
          >
            <div className={cn('mt-4 rounded-2xl p-4', result.correct ? 'bg-correct-soft' : 'bg-sun-100 dark:bg-sun-600/20')}>
              <p className="font-display text-lg font-bold">{result.correct ? 'Yes! You got it.' : 'Not quite — here is the idea:'}</p>
              {result.explanation && (
                <p className="mt-1 flex items-start gap-2">
                  <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-sun-400" aria-hidden />
                  <span>{result.explanation}</span>
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="lg" variant="sun" onClick={onNext} autoFocus>
                {nextLabel}
                <ArrowRight weight="bold" className="size-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
