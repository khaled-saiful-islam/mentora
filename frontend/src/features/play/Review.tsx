/** Every item of a finished attempt: what you said, what was right, why. */
import { motion } from 'motion/react'
import { ArrowCounterClockwise, Check, Lightbulb, X } from '@phosphor-icons/react'
import { Chip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { isQuizItem, type Attempt, type CardItem, type Played, type QuizItem } from './api'
import { playedById, skillLabel } from './session'

export function Review({ attempt }: { attempt: Attempt }) {
  const played = playedById(attempt.answered)
  return (
    <motion.ol className="space-y-3" variants={stagger(0.05)} initial="hidden" animate="shown">
      {attempt.items.map((item, i) => (
        <motion.li key={item.id} variants={rise}>
          {isQuizItem(item) ? (
            <QuizRow n={i + 1} item={item} answer={played[item.id]} skill={skillLabel(attempt, item.skill)} />
          ) : (
            <CardRow item={item} answer={played[item.id]} skill={skillLabel(attempt, item.skill)} />
          )}
        </motion.li>
      ))}
    </motion.ol>
  )
}

function Mark({ right }: { right: boolean | null }) {
  if (right === null) return <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">–</span>
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-white', right ? 'bg-correct' : 'bg-wrong')}>
      {right ? <Check weight="bold" className="size-5" /> : <X weight="bold" className="size-5" />}
    </span>
  )
}

function QuizRow({ n, item, answer, skill }: { n: number; item: QuizItem; answer: Played | undefined; skill: string }) {
  const right = answer?.reveal?.answer
  return (
    <article className="rounded-3xl border-2 border-border bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <Mark right={answer ? answer.correct : null} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-muted-foreground">
            Question {n} · <span className="capitalize">{skill}</span>
          </p>
          <p className="mt-1 font-display text-lg font-semibold">{item.prompt}</p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {item.options.map((option, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-xl border-2 px-3 py-2 font-bold',
                  i === right ? 'border-correct bg-correct-soft' : i === answer?.choice ? 'border-wrong bg-wrong-soft' : 'border-transparent bg-muted/60 text-muted-foreground',
                )}
              >
                {option}
                {i === answer?.choice && <span className="ml-2 text-xs font-bold uppercase opacity-70">your answer</span>}
              </li>
            ))}
          </ul>
          {!answer && <p className="mt-2 text-sm font-bold text-muted-foreground">Not answered</p>}
          {answer?.reveal?.explanation && (
            <p className="mt-3 flex gap-1.5 text-foreground/80">
              <Lightbulb weight="duotone" className="mt-0.5 size-5 shrink-0" aria-hidden />
              {answer.reveal.explanation}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function CardRow({ item, answer, skill }: { item: CardItem; answer: Played | undefined; skill: string }) {
  const knew = answer?.knew ?? null
  return (
    <article className="flex items-start gap-3 rounded-3xl border-2 border-border bg-surface p-4 md:p-5">
      <Mark right={knew} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold">{item.front}</p>
        <p className="mt-1">{item.back}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip className="capitalize">{skill}</Chip>
          {knew === false && (
            <Chip tone="coral">
              <ArrowCounterClockwise weight="bold" className="size-3.5" />
              Practise this one
            </Chip>
          )}
        </div>
      </div>
    </article>
  )
}
