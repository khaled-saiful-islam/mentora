/** Every item of a finished attempt: what you said, what was right, why. */
import { motion } from 'motion/react'
import { ArrowCounterClockwise, Check, Lightbulb, X } from '@phosphor-icons/react'
import { Chip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { PLAY_LABELS } from '@/features/game/rounds'
import { isQuizItem, type Attempt, type CardItem, type GameIsland, type Played, type QuizItem } from './api'
import { playedById, skillLabel } from './session'

/** `whose` names the answer given: "your answer" for the student, their
 *  name for a parent looking back with them. */
export function Review({ attempt, whose = 'your answer' }: { attempt: Attempt; whose?: string }) {
  const played = playedById(attempt.answered)
  return (
    // A container: options go two across by the review's width, not the window's.
    <motion.ol className="@container space-y-3" variants={stagger(0.05)} initial="hidden" animate="shown">
      {attempt.items.map((item, i) => (
        <motion.li key={item.id} variants={rise}>
          {'play' in item ? (
            <IslandRow n={i + 1} item={item} answer={played[item.id]} skill={skillLabel(attempt, item.skill)} />
          ) : 'front' in item ? (
            <CardRow item={item} answer={played[item.id]} skill={skillLabel(attempt, item.skill)} />
          ) : isQuizItem(item as QuizItem) ? (
            <QuizRow n={i + 1} item={item as QuizItem} answer={played[item.id]} skill={skillLabel(attempt, item.skill)} whose={whose} />
          ) : null}
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

function QuizRow({ n, item, answer, skill, whose }: { n: number; item: QuizItem; answer: Played | undefined; skill: string; whose: string }) {
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
          <ul className="mt-3 grid gap-1.5 @lg:grid-cols-2">
            {item.options.map((option, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-xl border-2 px-3 py-2 font-bold',
                  i === right ? 'border-correct bg-correct-soft' : i === answer?.choice ? 'border-wrong bg-wrong-soft' : 'border-transparent bg-muted/60 text-muted-foreground',
                )}
              >
                {option}
                {i === answer?.choice && <span className="ml-2 inline-block whitespace-nowrap text-xs font-bold uppercase opacity-70">{whose}</span>}
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

/** A game's island (§26): the idea, cleared or not, and what it teaches. */
function IslandRow({ n, item, answer, skill }: { n: number; item: GameIsland; answer: Played | undefined; skill: string }) {
  const reached = answer ? answer.correct === true : null
  return (
    <article className="flex items-start gap-3 rounded-3xl border-2 border-border bg-surface p-4 md:p-5">
      <Mark right={reached} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">
          Island {n} · {PLAY_LABELS[item.play]}
        </p>
        <p className="break-words font-display text-lg font-semibold">
          {item.icon && <span className="mr-1.5" aria-hidden>{item.icon}</span>}
          {item.learn}
        </p>
        {answer?.reveal?.explanation && (
          <p className="mt-2 flex items-start gap-2 rounded-2xl bg-correct-soft px-3 py-2">
            <Lightbulb weight="fill" className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span className="min-w-0 break-words">{answer.reveal.explanation}</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip className="capitalize">{skill}</Chip>
          {reached === false && (
            <Chip tone="coral">
              <ArrowCounterClockwise weight="bold" className="size-3.5" />
              Try this one again
            </Chip>
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
