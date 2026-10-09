/**
 * Boss Battle (§26.8): the last island of a game, a boss to beat with what
 * the child has learnt. One question at a time; a right answer hits the boss
 * and takes a block off its health. A wrong one and the boss hits back: a
 * heart goes, the buddy says why, and the question comes round again later.
 * Never a game over — out of hearts, the buddy brings them back. Played on
 * the class screen, the class shares the hearts.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Heart, Lightning, Trophy } from '@phosphor-icons/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { spring, wobble } from '@/motion'
import { SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { shuffled, type Shuffled } from './shuffle'
import type { Band, BossContent, BossQuestion, RoundProps } from './types'

const HEARTS = 3

/** Each question's options in the order they are shown, by question id. */
function orders(questions: BossQuestion[], shuffle: NonNullable<Shuffled['shuffle']>): Record<string, number[]> {
  return Object.fromEntries(questions.map((q) => [q.id, shuffle(q.options.map((_, n) => n))]))
}

/** The battle as it goes: the questions still to beat, the hearts, the hits. */
function useBattle({ questions, say, sound, onMove, shake }: Pick<RoundProps<BossContent>, 'say' | 'sound' | 'onMove'> & { questions: BossQuestion[]; shake: (piece: string) => void }) {
  // Question ids still to beat, the next one first; a missed one goes last.
  const [queue, setQueue] = useState(() => questions.map((q) => q.id))
  const [hearts, setHearts] = useState(HEARTS)
  const [refilled, setRefilled] = useState(false)
  const [hits, setHits] = useState(0)

  function hit(q: BossQuestion) {
    sound('correct')
    setHits((n) => n + 1)
    setRefilled(false)
    setQueue((all) => all.filter((id) => id !== q.id))
  }

  function miss(q: BossQuestion, option: number) {
    sound('wrong')
    say(q.why)
    shake(`${q.id}:${option}`)
    // The boss hits back; out of hearts, the buddy brings them all back.
    setRefilled(hearts <= 1)
    setHearts((left) => (left <= 1 ? HEARTS : left - 1))
    setQueue((all) => [...all.filter((id) => id !== q.id), q.id])
  }

  function answer(q: BossQuestion, option: number) {
    const right = option === q.answer
    onMove({ piece: q.id, right })
    if (right) hit(q)
    else miss(q, option)
  }

  return { queue, hearts, refilled, hits, hit, answer }
}

export function BossBattle({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<BossContent> & Shuffled) {
  const questions = content.questions
  const [order] = useState(() => orders(questions, shuffle))
  const [showing, setShowing] = useState<number | null>(null)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  const battle = useBattle({ questions, say, sound, onMove, shake })
  const current = questions.find((q) => q.id === battle.queue[0]) ?? null
  useFinish(questions.length > 0 && battle.queue.length === 0, onDone)

  useShowMe(showMe, () => {
    if (!current || showing !== null) return
    setShowing(current.answer)
    later(() => {
      setShowing(null)
      battle.hit(current)
    }, SHOW_ME_MS)
  })

  const beaten = questions.length - battle.queue.length
  return (
    <div ref={scope} className="flex h-full min-h-0 flex-col items-center gap-4 overflow-y-auto p-3 sm:p-6">
      <Boss content={content} band={band} calm={calm} left={battle.queue.length} total={questions.length} hits={battle.hits} />
      <Hearts hearts={battle.hearts} refilled={battle.refilled} calm={calm} />
      <AnimatePresence mode="wait">
        {current ? (
          <QuestionCard key={`${current.id}:${beaten}`} question={current} order={order[current.id]} band={band} calm={calm} showing={showing} onAnswer={(n) => showing === null && battle.answer(current, n)} />
        ) : (
          <Victory key="won" name={content.name} calm={calm} />
        )}
      </AnimatePresence>
    </div>
  )
}

function Boss({ content, band, calm, left, total, hits }: { content: BossContent; band: Band; calm: boolean; left: number; total: number; hits: number }) {
  return (
    <section aria-label={`${content.name}: health ${left} of ${total}`} className="flex w-full max-w-xl flex-col items-center gap-2 rounded-3xl bg-surface/90 p-4 shadow-sm">
      <motion.span
        key={hits}
        aria-hidden
        initial={false}
        animate={calm || hits === 0 ? undefined : { x: wobble.x, scale: [1, 0.86, 1.04, 1], opacity: [1, 0.55, 1, 1] }}
        transition={{ duration: 0.5 }}
        className={cn('leading-none', SIZE[band].bigIcon, left === 0 && 'opacity-40 grayscale')}
      >
        {content.icon || '👾'}
      </motion.span>
      <p className="break-words text-center font-display text-xl font-bold">{content.name}</p>
      <div aria-hidden className="flex w-full max-w-sm gap-1">
        {Array.from({ length: total }, (_, n) => (
          <span key={n} className={cn('h-4 flex-1 rounded-full transition-colors', n < left ? 'bg-wrong' : 'bg-muted')} />
        ))}
      </div>
    </section>
  )
}

function Hearts({ hearts, refilled, calm }: { hearts: number; refilled: boolean; calm: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1" aria-live="polite">
      <p className="flex items-center gap-1 rounded-full bg-surface/90 px-4 py-1" aria-label={`Your hearts: ${hearts} of ${HEARTS}`}>
        {Array.from({ length: HEARTS }, (_, n) => (
          <motion.span key={`${n}:${n < hearts}`} initial={calm ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={spring.bouncy}>
            <Heart weight={n < hearts ? 'fill' : 'regular'} className={cn('size-7', n < hearts ? 'text-wrong' : 'text-border')} aria-hidden />
          </motion.span>
        ))}
      </p>
      {refilled && <p className="rounded-full bg-star-soft px-4 py-1 text-center font-bold">Your buddy brings the hearts back!</p>}
    </div>
  )
}

function QuestionCard({ question, order, band, calm, showing, onAnswer }: {
  question: BossQuestion; order: number[]; band: Band; calm: boolean; showing: number | null; onAnswer: (option: number) => void
}) {  // fmt: skip
  return (
    <motion.section
      aria-label="The boss asks"
      initial={calm ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={calm ? undefined : { opacity: 0, y: -12 }}
      transition={spring.gentle}
      className="w-full max-w-2xl rounded-3xl bg-surface p-4 shadow-md sm:p-5"
    >
      <p className="flex items-start gap-2 break-words font-display text-xl font-semibold sm:text-2xl">
        <Lightning weight="fill" className="mt-1 size-6 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0">{question.ask}</span>
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {order.map((n) => (
          <button
            key={n}
            type="button"
            data-piece={`${question.id}:${n}`}
            onClick={() => onAnswer(n)}
            className={cn(
              'min-h-14 w-full min-w-0 break-words rounded-2xl border-2 px-4 py-3 text-left font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
              band === 'secondary' ? 'text-lg' : SIZE[band].piece,
              showing === n ? 'border-primary bg-selected ring-4 ring-primary/40' : 'border-border bg-surface hover:border-hover-border hover:bg-hover',
            )}
          >
            {question.options[n]}
          </button>
        ))}
      </div>
    </motion.section>
  )
}

function Victory({ name, calm }: { name: string; calm: boolean }) {
  return (
    <motion.p
      initial={calm ? false : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.bouncy}
      className="flex max-w-xl flex-col items-center gap-2 rounded-3xl bg-correct-soft px-6 py-5 text-center font-display text-2xl font-bold"
    >
      <Trophy weight="fill" className="size-12 text-warning" aria-hidden />
      <span className="break-words">{name} is beaten!</span>
    </motion.p>
  )
}
