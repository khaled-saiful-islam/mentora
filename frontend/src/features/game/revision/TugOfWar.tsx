/**
 * Tug-of-War (§26.8): a game's questions on the class screen, two teams on
 * one screen — Team Harimau on the left, Team Kancil on the right. Each
 * question shows once in the middle and each team has its own buttons for
 * it. The first team to tap the right answer pulls the rope a step their way;
 * a team that taps a wrong one is frozen for the rest of that question, and
 * the other may still answer. Both wrong, and nobody pulls: the answer and
 * why show for a moment. Questions get harder as the rope nears an edge;
 * five steps wins. Practice: nothing is kept.
 */
import { motion } from 'motion/react'
import { ArrowClockwise, Snowflake, Trophy } from '@phosphor-icons/react'
import { useEffect, useReducer, useState } from 'react'
import { Button } from '@/components/ui'
import { playSound, type Sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { celebrate, spring } from '@/motion'
import { useLater } from '../rounds/parts'
import { shuffled, type Shuffler } from '../rounds/shuffle'
import type { Question } from './questions'
import { TopBar } from './StreakLadder'

export type Side = 'left' | 'right'
export const TEAMS: Record<Side, { name: string; icon: string }> = {
  left: { name: 'Team Harimau', icon: '🐯' },
  right: { name: 'Team Kancil', icon: '🦌' },
}
/** Steps from the middle that win. */
export const WIN = 5
/** How long a pull shows before the next question, and the answer when both were wrong. */
export const PULLED_MS = 1500
export const REVEAL_MS = 3000

interface Turn {
  question: Question
  /** Each team's own order of the options. */
  orders: Record<Side, number[]>
}

type Winner = Side | 'draw' | null

/** The next question: the easiest left near the middle, the hardest left near an edge. */
function pick(questions: Question[], used: string[], rope: number, shuffle: Shuffler): Turn | null {
  const left = questions.filter((q) => !used.includes(q.id))
  if (left.length === 0) return null
  const levels = left.map((q) => q.level)
  const target = Math.abs(rope) >= 2 ? Math.max(...levels) : Math.min(...levels)
  const [question] = shuffle(left.filter((q) => q.level === target))
  const options = question.options.map((_, n) => n)
  return { question, orders: { left: shuffle(options), right: shuffle(options) } }
}

const NOBODY: Record<Side, number | null> = { left: null, right: null }

interface TugState {
  rope: number
  used: string[]
  turn: Turn | null
  /** The option each team tried and got wrong this question, if any. */
  tried: Record<Side, number | null>
  puller: Side | null
  /** The question is over: who pulled, or the answer, is showing. */
  reveal: boolean
  winner: Winner
}

type TugAction = { type: 'answer'; side: Side; option: number } | { type: 'next' } | { type: 'again' }

function start(questions: Question[], shuffle: Shuffler): TugState {
  return { rope: 0, used: [], turn: pick(questions, [], 0, shuffle), tried: NOBODY, puller: null, reveal: false, winner: null }
}

/** What an answer does: nothing (not now), a pull, a miss, or both teams missed. */
function judge(state: TugState, side: Side, option: number): 'ignored' | 'pulled' | 'missed' | 'both' {
  if (!state.turn || state.reveal || state.winner || state.tried[side] !== null) return 'ignored'
  if (option === state.turn.question.answer) return 'pulled'
  const other = side === 'left' ? state.tried.right : state.tried.left
  return other === null ? 'missed' : 'both'
}

/** The match's rules, as one step at a time. */
function step(state: TugState, action: TugAction, questions: Question[], shuffle: Shuffler): TugState {
  if (action.type === 'again') return start(questions, shuffle)
  if (action.type === 'next') {
    const fresh = { ...state, tried: NOBODY, puller: null, reveal: false }
    const following = Math.abs(state.rope) >= WIN ? null : pick(questions, state.used, state.rope, shuffle)
    if (following) return { ...fresh, turn: following }
    return { ...fresh, winner: state.rope < 0 ? 'left' : state.rope > 0 ? 'right' : 'draw' }
  }
  const outcome = judge(state, action.side, action.option)
  if (outcome === 'ignored' || !state.turn) return state
  const used = [...state.used, state.turn.question.id]
  if (outcome === 'pulled') return { ...state, used, rope: state.rope + (action.side === 'left' ? -1 : 1), puller: action.side, reveal: true }
  const tried = { ...state.tried, [action.side]: action.option }
  return outcome === 'both' ? { ...state, used, tried, reveal: true } : { ...state, tried }
}

/** The match as it goes, with its sounds and the pause after each question. */
function useTug(questions: Question[], calm: boolean, ring: (name: Sound) => void, shuffle: Shuffler) {
  const [state, dispatch] = useReducer((s: TugState, a: TugAction) => step(s, a, questions, shuffle), undefined, () => start(questions, shuffle))
  const later = useLater()

  function answer(side: Side, option: number) {
    const outcome = judge(state, side, option)
    if (outcome === 'ignored') return
    ring(outcome === 'pulled' ? 'correct' : 'wrong')
    dispatch({ type: 'answer', side, option })
    if (outcome !== 'missed') later(() => dispatch({ type: 'next' }), outcome === 'pulled' ? PULLED_MS : REVEAL_MS)
  }

  useEffect(() => {
    if (!state.winner) return
    ring('finish')
    celebrate({ calm, power: 1.4 })
    // Once, when the match is won: the sound and confetti are not state.
  }, [state.winner])

  return { ...state, answer, again: () => dispatch({ type: 'again' }) }
}

export function TugOfWar({ title, questions, calm, onExit, shuffle = shuffled }: {
  title: string; questions: Question[]; calm: boolean; onExit: () => void; shuffle?: Shuffler
}) {  // fmt: skip
  const [sound, setSound] = useState(true)
  const ring = (name: Sound) => sound && playSound(name)
  const tug = useTug(questions, calm, ring, shuffle)
  const turn = tug.turn
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-game>
      <TopBar title={title} label="Tug-of-War" sound={sound} onSound={() => setSound((on) => !on)} onExit={onExit} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-6">
        <Rope rope={tug.rope} calm={calm} />
        {tug.winner ? (
          <Won winner={tug.winner} calm={calm} onAgain={tug.again} onDone={onExit} />
        ) : turn ? (
          <>
            <Middle turn={turn} puller={tug.puller} reveal={tug.reveal} />
            <div className="grid gap-3 md:grid-cols-2">
              {(['left', 'right'] as const).map((side) => (
                <Team key={side} side={side} turn={turn} tried={tug.tried[side]} puller={tug.puller} reveal={tug.reveal} onAnswer={(n) => tug.answer(side, n)} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Rope({ rope, calm }: { rope: number; calm: boolean }) {
  const toward = rope < 0 ? TEAMS.left.name : TEAMS.right.name
  const said = rope === 0 ? 'in the middle' : `${Math.abs(rope)} ${Math.abs(rope) === 1 ? 'step' : 'steps'} toward ${toward}`
  return (
    <section aria-label={`The rope: ${said}`} className="flex items-center gap-2 rounded-3xl bg-surface p-3 shadow-sm sm:gap-4 sm:p-4">
      <span aria-hidden className="text-4xl sm:text-6xl">{TEAMS.left.icon}</span>
      <div aria-hidden className="relative h-12 flex-1">
        <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-border" />
        <span className="absolute inset-y-0 left-[10%] w-1 rounded-full bg-wrong/60" />
        <span className="absolute inset-y-0 right-[10%] w-1 rounded-full bg-wrong/60" />
        <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-sun-600/70" />
        <motion.span
          className="absolute top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-surface bg-primary text-xl shadow-md"
          initial={false}
          animate={{ left: `${50 + (rope / WIN) * 40}%` }}
          transition={calm ? { duration: 0 } : spring.bouncy}
        >
          🚩
        </motion.span>
      </div>
      <span aria-hidden className="text-4xl sm:text-6xl">{TEAMS.right.icon}</span>
    </section>
  )
}

function Middle({ turn, puller, reveal }: { turn: Turn; puller: Side | null; reveal: boolean }) {
  const q = turn.question
  return (
    <section aria-label="The question" aria-live="polite" className="rounded-3xl bg-surface p-4 text-center shadow-md sm:p-6">
      <p className="break-words font-display text-2xl font-semibold md:text-4xl">{q.ask}</p>
      {reveal && puller && <p className="mt-3 font-display text-xl font-bold text-success md:text-2xl">{TEAMS[puller].name} pulls!</p>}
      {reveal && !puller && (
        <p className="mt-3 break-words rounded-2xl bg-correct-soft px-4 py-2 text-lg md:text-xl">
          <b>Nobody pulls. The answer: {q.options[q.answer]}.</b> {q.why}
        </p>
      )}
    </section>
  )
}

function Team({ side, turn, tried, puller, reveal, onAnswer }: {
  side: Side; turn: Turn; tried: number | null; puller: Side | null; reveal: boolean; onAnswer: (option: number) => void
}) {  // fmt: skip
  const team = TEAMS[side]
  const frozen = tried !== null
  return (
    <section aria-label={team.name} className={cn('rounded-3xl border-4 bg-surface p-3 transition-opacity sm:p-4', puller === side ? 'border-correct' : 'border-border', frozen && !reveal && 'opacity-60')}>
      <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold md:text-2xl">
        <span aria-hidden>{team.icon}</span>
        {team.name}
        {frozen && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-0.5 text-base dark:bg-sky-700/30">
            <Snowflake weight="bold" className="size-4" aria-hidden /> Frozen!
          </span>
        )}
      </p>
      <div className="mt-3 grid gap-2">
        {turn.orders[side].map((n) => (
          <Button
            key={n}
            variant="outline"
            size="lg"
            aria-label={`${team.name}: ${turn.question.options[n]}`}
            disabled={frozen || reveal}
            onClick={() => onAnswer(n)}
            className={cn('h-auto min-h-14 w-full justify-start whitespace-normal break-words rounded-2xl py-3 text-left text-lg md:text-2xl', reveal && n === turn.question.answer && 'border-correct bg-correct-soft', n === tried && 'border-wrong bg-wrong-soft line-through')}
          >
            {turn.question.options[n]}
          </Button>
        ))}
      </div>
    </section>
  )
}

function Won({ winner, calm, onAgain, onDone }: { winner: Side | 'draw'; calm: boolean; onAgain: () => void; onDone: () => void }) {
  return (
    <motion.section
      aria-label="The end of the match"
      initial={calm ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.bouncy}
      className="mx-auto w-full max-w-xl rounded-3xl bg-surface p-6 text-center shadow-md"
    >
      <Trophy weight="fill" className="mx-auto size-14 text-warning" aria-hidden />
      <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
        {winner === 'draw' ? "It's a draw!" : `${TEAMS[winner].icon} ${TEAMS[winner].name} wins!`}
      </h2>
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
