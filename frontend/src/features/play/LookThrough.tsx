/**
 * A quiz or a deck for the teacher or parent who made it: every question,
 * one at a time, with its answer already showing. Next and Back walk
 * through; nothing needs answering, and nothing is saved.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowClockwise, ArrowLeft, ArrowRight, Check, CheckCircle, GameController, Lightbulb } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Chip } from '@/components/ui'
import type { FlashcardItem, QuizItem, SetDetail } from '@/features/learning/api'
import { nounOf } from '@/features/learning/kinds'
import { OPTION_LOOKS } from '@/features/learning/options'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'

type Viewable = QuizItem | FlashcardItem

const isQuiz = (item: Viewable): item is QuizItem => 'options' in item

export function viewable(set: SetDetail): Viewable[] {
  return set.items.filter((i): i is Viewable => 'options' in i || 'front' in i)
}

const DIFFICULTY: Record<QuizItem['difficulty'], string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export function LookThrough({ set, onPlay }: { set: SetDetail; onPlay: () => void }) {
  const items = viewable(set)
  const [at, setAt] = useState(0)
  const [dir, setDir] = useState(1)
  const calm = useCalmMotion()
  const ended = at >= items.length
  const item = items[at]
  const noun = nounOf(set.kind)
  const back = `/library/${set.id}`

  const go = (to: number) => {
    const next = Math.max(0, Math.min(items.length, to))
    setDir(next >= at ? 1 : -1)
    setAt(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') go(at + 1)
      if (e.key === 'ArrowLeft') go(at - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 md:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-[min(100%,14rem)] flex-1 break-words font-display text-2xl font-semibold md:text-3xl">{set.title}</h1>
        <p className="text-sm font-bold text-muted-foreground" aria-live="polite">
          {ended ? `All ${nounOf(set.kind, items.length)}` : `${capital(noun)} ${at + 1} of ${items.length}`}
        </p>
      </div>
      <Dots count={items.length} at={at} noun={noun} onGo={go} />

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={at}
          custom={dir}
          initial={calm ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={calm ? { opacity: 0 } : { opacity: 0, x: dir * -40, transition: { duration: 0.14 } }}
          transition={spring.gentle}
          className="mt-6"
        >
          {ended ? (
            <End count={items.length} kind={set.kind} back={back} onAgain={() => go(0)} onPlay={onPlay} />
          ) : isQuiz(item) ? (
            <QuizView item={item} skill={skillOf(set, item.skill)} />
          ) : (
            <CardView item={item} skill={skillOf(set, item.skill)} />
          )}
        </motion.div>
      </AnimatePresence>

      {!ended && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => go(at - 1)} disabled={at === 0}>
            <ArrowLeft weight="bold" className="size-4" aria-hidden /> Back
          </Button>
          <Button onClick={() => go(at + 1)}>
            {at + 1 < items.length ? `Next ${noun}` : 'Finish'}
            <ArrowRight weight="bold" className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function skillOf(set: SetDetail, slug: string): string | undefined {
  return set.skills.find((s) => s.slug === slug)?.label
}

/** One dot a question, to jump straight to it. They wrap, never scroll. */
function Dots({ count, at, noun, onGo }: { count: number; at: number; noun: string; onGo: (i: number) => void }) {
  return (
    <ol className="mt-4 flex flex-wrap gap-1.5" aria-label={`Jump to a ${noun}`}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onGo(i)}
            aria-label={`${capital(noun)} ${i + 1}`}
            aria-current={i === at ? 'step' : undefined}
            className={cn(
              'block h-2.5 rounded-full transition-[width,background-color] duration-200',
              i === at ? 'w-7 bg-primary' : i < at ? 'w-2.5 bg-primary/40 hover:bg-primary/60' : 'w-2.5 bg-border hover:bg-hover-border',
            )}
          />
        </li>
      ))}
    </ol>
  )
}

function Meta({ skill, difficulty }: { skill?: string; difficulty?: QuizItem['difficulty'] }) {
  if (!skill && !difficulty) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {skill && <Chip className="max-w-full break-words text-sm">{skill}</Chip>}
      {difficulty && <Chip tone="sun" className="text-sm">{DIFFICULTY[difficulty]}</Chip>}
    </div>
  )
}

function QuizView({ item, skill }: { item: QuizItem; skill?: string }) {
  return (
    <article className="rounded-[2rem] border-2 border-border bg-surface p-5 shadow-sm md:p-7">
      <Meta skill={skill} difficulty={item.difficulty} />
      <h2 className="mt-3 break-words font-display text-2xl font-bold leading-snug md:text-3xl">{item.prompt}</h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {item.options.map((option, i) => {
          const right = i === item.answer
          const look = OPTION_LOOKS[i % OPTION_LOOKS.length]
          return (
            <li
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-2xl border-2 p-3 font-semibold',
                right ? 'border-correct bg-correct-soft' : 'border-border',
              )}
            >
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold', look.tile)} aria-hidden>
                {look.letter}
              </span>
              <span className="min-w-0 flex-1 break-words">{option}</span>
              {right && (
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-correct">
                  <Check weight="bold" className="size-5" aria-hidden /> Answer
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {item.explanation && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-muted p-4">
          <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-sun-600 dark:text-sun-300" aria-hidden />
          <p className="min-w-0 break-words">
            <span className="font-bold">Why: </span>
            {item.explanation}
          </p>
        </div>
      )}
    </article>
  )
}

function CardView({ item, skill }: { item: FlashcardItem; skill?: string }) {
  return (
    <article className="space-y-4">
      <Meta skill={skill} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Side label="Front" text={item.front} className="border-kind-flashcard-vivid/40 bg-surface" />
        <Side label="Back" text={item.back} className="border-kind-flashcard-vivid bg-kind-flashcard-vivid/10" />
      </div>
      {item.hint && (
        <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
          <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-sun-600 dark:text-sun-300" aria-hidden />
          <p className="min-w-0 break-words">
            <span className="font-bold">Hint: </span>
            {item.hint}
          </p>
        </div>
      )}
    </article>
  )
}

function Side({ label, text, className }: { label: string; text: string; className: string }) {
  return (
    <div className={cn('flex min-h-40 flex-col rounded-[2rem] border-2 p-5 shadow-sm', className)}>
      <p className="text-sm font-bold uppercase tracking-wider text-kind-flashcard">{label}</p>
      <p className="mt-2 flex-1 break-words font-display text-xl font-semibold leading-snug md:text-2xl">{text}</p>
    </div>
  )
}

function End({ count, kind, back, onAgain, onPlay }: { count: number; kind: string; back: string; onAgain: () => void; onPlay: () => void }) {
  return (
    <div className="rounded-[2rem] border-2 border-border bg-surface p-6 text-center shadow-sm md:p-8">
      <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.bouncy} className="mx-auto grid size-16 place-items-center rounded-3xl bg-correct-soft text-correct">
        <CheckCircle weight="fill" className="size-9" aria-hidden />
      </motion.span>
      <p className="mt-3 font-display text-2xl font-semibold">
        That's all {nounOf(kind, count)}
      </p>
      <p className="mt-1 text-muted-foreground">Look through them again, or play it the way a student will.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onAgain}>
          <ArrowClockwise weight="bold" className="size-4" aria-hidden /> From the start
        </Button>
        <Button variant="sun" onClick={onPlay}>
          <GameController weight="bold" className="size-4" aria-hidden /> Play as a student
        </Button>
        <Link to={back} className="inline-flex items-center gap-1.5 px-3 font-bold text-primary hover:underline">
          <ArrowLeft weight="bold" className="size-4" aria-hidden /> Back to editing
        </Link>
      </div>
    </div>
  )
}
