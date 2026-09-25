/**
 * A quiz, one question at a time. Four big answer tiles, each with its own
 * shape and colour so a child can find "the blue diamond" before they can
 * read it; keys 1–4 for those who can.
 *
 * Instant mode says right or wrong straight away and explains. End mode only
 * locks the answer in; the verdicts wait for the finish screen.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Circle, Diamond, Lightbulb, Square, Triangle, X } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Chip } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion, wobble } from '@/motion'
import { playApi, type Played, type QuizItem } from './api'
import { PlayHeader } from './PlayChrome'
import type { PlayerProps } from './players'
import { playedById, quizItems, resumeAt, segments, skillLabel } from './session'

interface Marker {
  Icon: Icon
  tile: string
  key: string
}

// Shape, colour and key for each position — the same everywhere.
const MARKERS: Marker[] = [
  { Icon: Triangle, tile: 'bg-coral-400', key: '1' },
  { Icon: Diamond, tile: 'bg-sky-400', key: '2' },
  { Icon: Circle, tile: 'bg-sun-400', key: '3' },
  { Icon: Square, tile: 'bg-mint-400', key: '4' },
]

const END_MODE_ADVANCE_MS = 650

export function QuizPlayer({ attempt, buddy, exitTo, onFinished }: PlayerProps) {
  const items = quizItems(attempt)
  const [played, setPlayed] = useState<Record<string, Played>>(() => playedById(attempt.answered))
  const [index, setIndex] = useState(() => resumeAt(items, playedById(attempt.answered)))
  const [streak, setStreak] = useState(0)
  const [sending, setSending] = useState(false)
  const shownAt = useRef(Date.now())
  const { toast } = useToast()
  const sound = useSound()
  const calm = useCalmMotion()
  const instant = attempt.feedback_mode === 'instant'
  const item = items[index]
  const answer = item ? played[item.id] : undefined

  useEffect(() => {
    shownAt.current = Date.now()
  }, [index])

  const next = useCallback(() => {
    const after = resumeAt(items, played)
    if (after >= items.length) onFinished()
    else setIndex(after)
  }, [items, played, onFinished])

  async function choose(choice: number) {
    if (!item || answer || sending) return
    setSending(true)
    sound('tap')
    try {
      const result = await playApi.answer(attempt.id, { item_id: item.id, choice, time_ms: Date.now() - shownAt.current })
      setPlayed((now) => ({ ...now, [item.id]: result.played }))
      setStreak(result.streak)
      react(result.played, result.streak)
      if (!instant) window.setTimeout(() => setIndex((i) => i + 1), END_MODE_ADVANCE_MS)
    } catch (error) {
      toast('That answer did not send', { tone: 'error', body: errorMessage(error) })
    } finally {
      setSending(false)
    }
  }

  function react(result: Played, streakNow: number) {
    if (result.correct === true) {
      sound(streakNow >= 3 && streakNow % 3 === 0 ? 'streak' : 'correct')
      buddy.current?.cue('correct', { streak: streakNow })
      if (streakNow >= 3 && streakNow % 3 === 0) celebrate({ calm, power: 0.6, origin: { x: 0.5, y: 0.7 } })
    } else if (result.correct === false) {
      sound('wrong')
      buddy.current?.cue('wrong')
    } else {
      buddy.current?.play('happy')
    }
  }

  // An end-mode quiz advances by itself; past the last question, finish.
  useEffect(() => {
    if (index >= items.length && items.length > 0) onFinished()
  }, [index, items.length, onFinished])

  useKeys(item?.options.length ?? 0, (n) => void choose(n), answer && instant ? next : null)

  if (!item) return null
  return (
    <div className="flex min-h-dvh flex-col">
      <PlayHeader title={attempt.title} kind="quiz" parts={segments(items, played, index)} streak={instant ? streak : 0} exitTo={exitTo} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-40 md:pt-10">
        <AnimatePresence mode="wait">
          <motion.section
            key={item.id}
            initial={{ opacity: 0, x: 60, rotate: 2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -60, rotate: -2, transition: { duration: 0.18 } }}
            transition={spring.gentle}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="sun" className="text-sm">
                Question {index + 1} of {items.length}
              </Chip>
              <Chip className="text-sm capitalize">{skillLabel(attempt, item.skill)}</Chip>
            </div>
            <h1 className="mt-4 font-display text-2xl leading-snug font-semibold md:text-3xl">{item.prompt}</h1>
            <Options item={item} answer={answer} instant={instant} disabled={sending} onChoose={(n) => void choose(n)} />
          </motion.section>
        </AnimatePresence>
      </main>
      <AnimatePresence>
        {answer && instant && <Verdict key={item.id} item={item} answer={answer} last={resumeAt(items, played) >= items.length} onNext={next} />}
      </AnimatePresence>
    </div>
  )
}

function Options({
  item,
  answer,
  instant,
  disabled,
  onChoose,
}: {
  item: QuizItem
  answer: Played | undefined
  instant: boolean
  disabled: boolean
  onChoose: (choice: number) => void
}) {
  const right = answer?.reveal?.answer
  return (
    <motion.ul
      className="mt-6 grid gap-3 sm:grid-cols-2"
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
    >
      {item.options.map((option, i) => {
        const chosen = answer?.choice === i
        const state = !answer
          ? 'open'
          : !instant
            ? chosen
              ? 'locked'
              : 'dim'
            : chosen && answer.correct
              ? 'right'
              : chosen
                ? 'wrong'
                : right === i
                  ? 'reveal'
                  : 'dim'
        return (
          <motion.li key={i} variants={{ hidden: { opacity: 0, y: 16, scale: 0.96 }, shown: { opacity: 1, y: 0, scale: 1 } }}>
            <OptionTile marker={MARKERS[i % MARKERS.length]} text={option} state={state} disabled={disabled || Boolean(answer)} onClick={() => onChoose(i)} />
          </motion.li>
        )
      })}
    </motion.ul>
  )
}

type TileState = 'open' | 'locked' | 'right' | 'wrong' | 'reveal' | 'dim'

const TILE: Record<TileState, string> = {
  open: 'border-border bg-surface hover:border-hover-border hover:shadow-lg',
  locked: 'border-primary bg-selected ring-4 ring-primary/25',
  right: 'border-correct bg-correct-soft ring-4 ring-correct/30',
  wrong: 'border-wrong bg-wrong-soft',
  reveal: 'border-correct bg-surface ring-4 ring-correct/30',
  dim: 'border-border bg-surface opacity-55',
}

function OptionTile({
  marker,
  text,
  state,
  disabled,
  onClick,
}: {
  marker: Marker
  text: string
  state: TileState
  disabled: boolean
  onClick: () => void
}) {
  const verdict = state === 'right' || state === 'reveal' ? Check : state === 'wrong' ? X : null
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'locked' || state === 'right' || state === 'wrong'}
      whileHover={state === 'open' ? { y: -3 } : undefined}
      whileTap={state === 'open' ? { scale: 0.97, y: 1 } : undefined}
      animate={state === 'wrong' ? wobble : state === 'right' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={spring.snappy}
      className={cn(
        'group flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 p-3 pr-4 text-left shadow-sm transition-[border-color,background-color,box-shadow,opacity]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-default',
        TILE[state],
      )}
    >
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl text-white shadow-press', marker.tile)} aria-hidden>
        <marker.Icon weight="fill" className="size-6" />
      </span>
      <span className="flex-1 text-lg leading-snug font-bold">{text}</span>
      {verdict ? (
        <motion.span
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring.bouncy}
          className={cn('grid size-9 place-items-center rounded-full text-white', verdict === Check ? 'bg-correct' : 'bg-wrong')}
        >
          {verdict === Check ? <Check weight="bold" className="size-5" /> : <X weight="bold" className="size-5" />}
        </motion.span>
      ) : (
        <kbd className="hidden size-7 place-items-center rounded-lg border-2 border-border font-sans text-sm font-bold text-muted-foreground md:grid">
          {marker.key}
        </kbd>
      )}
    </motion.button>
  )
}

function Verdict({ item, answer, last, onNext }: { item: QuizItem; answer: Played; last: boolean; onNext: () => void }) {
  const right = answer.correct === true
  const correctText = typeof answer.reveal?.answer === 'number' ? item.options[answer.reveal.answer] : null
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => next.current?.focus(), [])
  return (
    <motion.aside
      initial={{ y: '110%' }}
      animate={{ y: 0 }}
      exit={{ y: '110%', transition: { duration: 0.18 } }}
      transition={spring.gentle}
      className={cn('fixed inset-x-0 bottom-0 z-40 border-t-4 pb-[env(safe-area-inset-bottom)]', right ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft')}
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-4 pr-24 pl-4 sm:flex-row sm:items-center md:pr-40 xl:pr-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <motion.span
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...spring.bouncy, delay: 0.08 }}
            className={cn('grid size-11 shrink-0 place-items-center rounded-full text-white', right ? 'bg-correct' : 'bg-wrong')}
          >
            {right ? <Check weight="bold" className="size-6" /> : <X weight="bold" className="size-6" />}
          </motion.span>
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold">{right ? 'Correct!' : 'Not quite'}</p>
            {!right && correctText && (
              <p className="font-bold">
                The answer is <span className="underline decoration-correct decoration-4 underline-offset-4">{correctText}</span>
              </p>
            )}
            {answer.reveal?.explanation && (
              <p className="mt-1 flex gap-1.5 text-foreground/80">
                <Lightbulb weight="duotone" className="mt-0.5 size-5 shrink-0" aria-hidden />
                {answer.reveal.explanation}
              </p>
            )}
          </div>
        </div>
        <Button ref={next} size="lg" variant={right ? 'primary' : 'sun'} onClick={onNext} className="shrink-0">
          {last ? 'See my score' : 'Next'}
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </div>
    </motion.aside>
  )
}

/** 1–4 or A–D to answer, Enter to go on. Ignored while typing elsewhere. */
function useKeys(options: number, onChoose: (n: number) => void, onNext: (() => void) | null) {
  const latest = useRef({ onChoose, onNext })
  latest.current = { onChoose, onNext }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      const n = '1234'.indexOf(key) >= 0 ? Number(key) - 1 : 'abcd'.indexOf(key)
      if (n >= 0 && n < options) {
        event.preventDefault()
        latest.current.onChoose(n)
      } else if (key === 'enter' && latest.current.onNext && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        latest.current.onNext()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [options])
}
