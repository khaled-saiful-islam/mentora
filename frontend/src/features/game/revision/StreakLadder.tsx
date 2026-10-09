/**
 * The Streak Ladder (§26.8): revise a game by climbing — one question at a
 * time, easiest first and harder as you go, until the first slip. Each right
 * answer is a rung. The slip shows the right answer and why, and how high
 * you got; Play again to beat it. Practice: nothing is kept.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowClockwise, Check, SpeakerHigh, SpeakerSlash, Trophy, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { playSound, type Sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { celebrate, spring } from '@/motion'
import { shuffled, type Shuffler } from '../rounds/shuffle'
import type { Question } from './questions'

interface LadderProps {
  title: string
  questions: Question[]
  calm: boolean
  onExit: () => void
  /** For tests: an order that is not random. */
  shuffle?: Shuffler
}

/** A climb: the questions easiest first (shuffled within a level), each with its options' order. */
interface Climb {
  questions: Question[]
  orders: number[][]
}

function climbOf(questions: Question[], shuffle: Shuffler): Climb {
  const levels = [...new Set(questions.map((q) => q.level))].sort((a, b) => a - b)
  const ordered = levels.flatMap((level) => shuffle(questions.filter((q) => q.level === level)))
  return { questions: ordered, orders: ordered.map((q) => shuffle(q.options.map((_, n) => n))) }
}

/** A climb as it goes: the rung reached, the slip that ended it, the best. */
function useClimb(questions: Question[], shuffle: Shuffler, calm: boolean, ring: (name: Sound) => void) {
  const [climb, setClimb] = useState(() => climbOf(questions, shuffle))
  const [rung, setRung] = useState(0)
  const [slip, setSlip] = useState<{ question: Question; chosen: number } | null>(null)
  const [best, setBest] = useState(0)

  function answer(question: Question, option: number) {
    if (option !== question.answer) {
      ring('wrong')
      setSlip({ question, chosen: option })
      return
    }
    ring('correct')
    const climbed = rung + 1
    setRung(climbed)
    setBest((b) => Math.max(b, climbed))
    if (climbed < climb.questions.length) return
    ring('finish')
    celebrate({ calm })
  }

  function again() {
    setClimb(climbOf(questions, shuffle))
    setRung(0)
    setSlip(null)
  }

  return { climb, rung, slip, best, answer, again }
}

export function StreakLadder({ title, questions, calm, onExit, shuffle = shuffled }: LadderProps) {
  const [sound, setSound] = useState(true)
  const ring = (name: Sound) => sound && playSound(name)
  const { climb, rung, slip, best, answer, again } = useClimb(questions, shuffle, calm, ring)
  const total = climb.questions.length
  const current = slip || rung >= total ? null : climb.questions[rung]
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-game>
      <TopBar title={title} label="Streak Ladder" sound={sound} onSound={() => setSound((on) => !on)} onExit={onExit} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:flex-row sm:p-6">
        <Ladder rung={rung} total={total} best={best} calm={calm} />
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4">
          <AnimatePresence mode="wait">
            {current ? (
              <Ask key={current.id} question={current} order={climb.orders[rung]} calm={calm} onAnswer={(n) => answer(current, n)} />
            ) : (
              <Result key="end" slip={slip} rung={rung} best={best} total={total} calm={calm} onAgain={again} onDone={onExit} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/** The rungs, climbed from the bottom; on a phone, a single line. */
function Ladder({ rung, total, best, calm }: { rung: number; total: number; best: number; calm: boolean }) {
  return (
    <aside aria-label={`Rung ${rung} of ${total}`} className="flex shrink-0 items-center gap-3 rounded-3xl bg-surface p-3 shadow-sm sm:w-28 sm:flex-col-reverse sm:justify-start">
      <ol aria-hidden className="flex flex-1 gap-1 sm:w-full sm:flex-col-reverse">
        {Array.from({ length: total }, (_, n) => (
          <motion.li
            key={n}
            initial={false}
            animate={n < rung && !calm ? { scale: [1, 1.15, 1] } : undefined}
            className={cn('h-3 min-w-0 flex-1 rounded-full sm:h-auto sm:min-h-3 sm:w-full', n < rung ? 'bg-correct' : 'bg-muted')}
          />
        ))}
      </ol>
      <p className="shrink-0 text-center font-display font-bold">
        <span className="block text-2xl tabular-nums">{rung}</span>
        <span className="block text-xs uppercase tracking-wide text-muted-foreground">Best {best}</span>
      </p>
    </aside>
  )
}

function Ask({ question, order, calm, onAnswer }: { question: Question; order: number[]; calm: boolean; onAnswer: (option: number) => void }) {
  return (
    <motion.section
      aria-label="The question"
      initial={calm ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={calm ? undefined : { opacity: 0, y: -16 }}
      transition={spring.gentle}
      className="w-full max-w-2xl rounded-3xl bg-surface p-5 shadow-md"
    >
      <p className="break-words font-display text-2xl font-semibold">{question.ask}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {order.map((n) => (
          <Button key={n} variant="outline" size="lg" className="h-auto min-h-14 w-full justify-start whitespace-normal break-words rounded-2xl py-3 text-left text-lg" onClick={() => onAnswer(n)}>
            {question.options[n]}
          </Button>
        ))}
      </div>
    </motion.section>
  )
}

function Result({ slip, rung, best, total, calm, onAgain, onDone }: {
  slip: { question: Question; chosen: number } | null; rung: number; best: number; total: number; calm: boolean; onAgain: () => void; onDone: () => void
}) {  // fmt: skip
  const top = !slip && rung >= total
  return (
    <motion.section
      aria-label="How high you climbed"
      initial={calm ? false : { scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.bouncy}
      className="w-full max-w-xl rounded-3xl bg-surface p-5 text-center shadow-md"
    >
      {top && <Trophy weight="fill" className="mx-auto size-12 text-warning" aria-hidden />}
      <h2 className="font-display text-3xl font-semibold">{top ? 'You reached the top!' : `You climbed ${rung} ${rung === 1 ? 'rung' : 'rungs'}!`}</h2>
      {slip && (
        <div className="mt-4 rounded-2xl bg-correct-soft px-4 py-3 text-left">
          <p className="flex items-start gap-2 font-bold">
            <Check weight="bold" className="mt-1 size-5 shrink-0 text-success" aria-hidden />
            <span className="min-w-0 break-words">The answer: {slip.question.options[slip.question.answer]}</span>
          </p>
          {slip.question.why && <p className="mt-1 break-words">{slip.question.why}</p>}
        </div>
      )}
      <p className="mt-3 font-semibold text-muted-foreground">Your best: {best}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button variant="outline" size="lg" onClick={onDone}>Done</Button>
        <Button variant="sun" size="lg" onClick={onAgain} autoFocus>
          <ArrowClockwise weight="bold" className="size-5" />
          Play again
        </Button>
      </div>
    </motion.section>
  )
}

/** A revision game's own bar: the way out, its name, and sound. */
export function TopBar({ title, label, sound, onSound, onExit }: { title: string; label: string; sound: boolean; onSound: () => void; onExit: () => void }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-border bg-surface px-3 py-2">
      <Button variant="ghost" size="icon" aria-label={`Close the ${label}`} onClick={onExit}>
        <X weight="bold" className="size-5" />
      </Button>
      <h1 className="min-w-0 flex-1 break-words font-display text-lg font-semibold">
        <span className="mr-2 text-primary">{label}</span>
        {title}
      </h1>
      <Button variant="ghost" size="icon" onClick={onSound} aria-label={sound ? 'Sound off' : 'Sound on'} aria-pressed={!sound}>
        {sound ? <SpeakerHigh weight="bold" className="size-5" /> : <SpeakerSlash weight="bold" className="size-5" />}
      </Button>
    </header>
  )
}
