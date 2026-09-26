/**
 * The pieces of the live room: classmates (seen, never messaged), the hand,
 * the quick check, and the end of the lesson.
 */
import { CheckCircle, HandWaving, PaperPlaneRight, Sparkle, SpeakerHigh, Trophy } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { Buddy } from '@/features/buddies'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion } from '@/motion'
import type { RosterEntry, RoomEvent } from './api'
import type { MyHand } from './useRoom'

/** Who is in the room, each as their buddy. Look, don't talk. */
export function Classmates({ roster, me, className }: { roster: RosterEntry[]; me?: string | null; className?: string }) {
  const here = roster.filter((r) => r.here)
  return (
    <div className={cn('flex flex-wrap items-end justify-center gap-x-4 gap-y-2', className)} aria-label={`${here.length} in the room`}>
      <AnimatePresence>
        {roster.map((r) => (
          <motion.figure
            key={r.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.6 }}
            animate={{ opacity: r.here ? 1 : 0.35, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={spring.bouncy}
            className="flex w-16 flex-col items-center"
          >
            <Buddy buddy={r.buddy} size={56} interactive={false} lively={r.here} track={false} mood={r.here ? 'happy' : 'sleepy'} />
            <figcaption className={cn('mt-1 max-w-full break-words text-center text-xs font-bold', r.id === me ? 'text-sun-300' : 'text-white/85')}>
              {r.id === me ? 'You' : r.name}
            </figcaption>
          </motion.figure>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function SoundGate({ onEnable }: { onEnable: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onEnable}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className="mx-auto flex items-center gap-2 rounded-full bg-sun-400 px-6 py-3 font-display text-lg font-bold text-grape-900 shadow-lg"
    >
      <SpeakerHigh weight="fill" className="size-6" aria-hidden />
      Tap to hear Astra
    </motion.button>
  )
}

export function HandControl({
  mine,
  left,
  position,
  mode,
  calledName,
  onRaise,
  onLower,
  onAsk,
}: {
  mine: MyHand
  left: number
  position: number
  mode: 'anytime' | 'pauses'
  calledName: string | null
  onRaise: () => void
  onLower: () => void
  onAsk: (text: string) => void
}) {
  const calm = useCalmMotion()
  const [text, setText] = useState('')

  if (mine === 'called') {
    return (
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim().length > 1) onAsk(text.trim())
        }}
        className="space-y-2 rounded-3xl bg-sun-400/15 p-4 ring-2 ring-sun-400"
      >
        <label htmlFor="room-question" className="block font-display text-lg font-bold text-sun-300">
          Astra is listening — ask your question
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="room-question"
            autoFocus
            value={text}
            maxLength={400}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your question…"
            className="min-w-[min(100%,14rem)] flex-1 bg-white text-foreground"
          />
          <Button type="submit" variant="sun" disabled={text.trim().length < 2}>
            <PaperPlaneRight weight="fill" className="size-4" aria-hidden />
            Ask
          </Button>
        </div>
      </motion.form>
    )
  }
  if (mine === 'asked') {
    return <p className="rounded-3xl bg-white/10 p-4 text-center font-semibold">Astra is answering your question…</p>
  }
  if (mine === 'up') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-3xl bg-white/10 p-3">
        <motion.span
          animate={calm ? undefined : { rotate: [0, 16, -8, 16, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.5 }}
          style={{ originX: 0.7, originY: 0.9 }}
          className="inline-flex"
        >
          <HandWaving weight="fill" className="size-7 text-sun-300" aria-hidden />
        </motion.span>
        <span className="font-bold">
          {position <= 1 ? "You're next!" : `You're ${ordinal(position)} in line.`}
          {mode === 'pauses' && ' Astra takes hands at the end of each part.'}
        </span>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onLower}>
          Put my hand down
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {calledName && <span className="text-sm font-semibold text-white/80">{calledName} is asking a question…</span>}
      <motion.button
        type="button"
        onClick={onRaise}
        disabled={left <= 0}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.95 }}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-bold text-grape-900 shadow-lg disabled:opacity-50"
      >
        <HandWaving weight="fill" className="size-5 text-kind-live" aria-hidden />
        {left > 0 ? 'Raise my hand' : 'No questions left'}
      </motion.button>
      {left > 0 && <span className="text-sm text-white/70">{left} question{left === 1 ? '' : 's'} left</span>}
    </div>
  )
}

export function CheckinCard({
  checkin,
  result,
  choice,
  answered,
  serverNow,
  onChoose,
  canAnswer,
}: {
  checkin: Extract<RoomEvent, { type: 'checkin' }> | null
  result: Extract<RoomEvent, { type: 'checkin_result' }> | null
  choice: number | null
  answered: number
  serverNow: () => number
  onChoose: (i: number) => void
  canAnswer: boolean
}) {
  const calm = useCalmMotion()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!checkin) return
    const timer = window.setInterval(() => tick((n) => n + 1), 500)
    return () => window.clearInterval(timer)
  }, [checkin])
  useEffect(() => {
    if (result && choice !== null && choice === result.answer) celebrate({ calm, power: 0.6 })
  }, [result, choice, calm])

  const shown = checkin ?? null
  const [kept, setKept] = useState<string[]>([])
  useEffect(() => {
    if (checkin) setKept(checkin.options)
  }, [checkin])
  if (!shown && !result) return null
  const options = shown?.options ?? kept
  const secondsLeft = shown ? Math.max(0, Math.ceil(shown.closes_at - serverNow())) : 0
  return (
    <motion.section
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.bouncy}
      className="rounded-3xl bg-white p-5 text-grape-900 shadow-xl"
      aria-label="Quick check"
    >
      <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-kind-live">
        <Sparkle weight="fill" className="size-3.5" aria-hidden />
        Quick check {shown && `· ${secondsLeft}s`}
      </p>
      {shown && <h3 className="mb-3 break-words font-display text-xl font-bold">{shown.question}</h3>}
      {shown && (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option, i) => (
            <motion.button
              key={i}
              type="button"
              disabled={!canAnswer || choice !== null}
              onClick={() => onChoose(i)}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'break-words rounded-2xl border-2 px-3 py-2.5 text-left font-bold transition-colors',
                choice === i ? 'border-kind-live-vivid bg-kind-live-vivid text-white' : 'border-border hover:border-kind-live-vivid',
              )}
            >
              {option}
            </motion.button>
          ))}
        </div>
      )}
      {shown && choice !== null && <p className="mt-3 text-sm font-semibold text-muted-foreground">Got it! {answered} answered so far…</p>}
      {result && <Result result={result} choice={choice} options={options} />}
    </motion.section>
  )
}

function Result({
  result,
  choice,
  options,
}: {
  result: Extract<RoomEvent, { type: 'checkin_result' }>
  choice: number | null
  options: string[]
}) {
  const most = Math.max(1, ...result.counts)
  return (
    <div className="space-y-2">
      <p className="font-display text-lg font-bold">
        {choice === null ? "Here's how the group did" : choice === result.answer ? 'You got it!' : 'Nearly — have a look'}
      </p>
      {result.counts.map((count, i) => (
        <div key={i} className="flex items-center gap-2">
          {i === result.answer ? <CheckCircle weight="fill" className="size-5 shrink-0 text-mint-700" aria-label="Right answer" /> : <span className="size-5 shrink-0" />}
          <span className={cn('w-[min(45%,14rem)] break-words text-sm font-semibold', i === result.answer && 'font-bold')}>{options[i]}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full', i === result.answer ? 'bg-mint-400' : 'bg-kind-live-vivid/50')}
              initial={{ width: 0 }}
              animate={{ width: `${(count / most) * 100}%` }}
              transition={spring.gentle}
            />
          </div>
          <span className="w-6 text-right text-sm font-bold">{count}</span>
        </div>
      ))}
      {result.explanation && <p className="break-words text-sm text-muted-foreground">{result.explanation}</p>}
    </div>
  )
}

export function Ending({ quiz, student }: { quiz: { assignment_id: string; title: string } | null; student: boolean }) {
  const calm = useCalmMotion()
  useEffect(() => {
    celebrate({ calm, power: 1.2 })
  }, [calm])
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.bouncy}
      className="rounded-3xl bg-white/10 p-6 text-center backdrop-blur-sm"
    >
      <Trophy weight="duotone" className="mx-auto size-14 text-sun-300" aria-hidden />
      <h2 className="mt-2 font-display text-3xl font-semibold">That's the lesson — well done!</h2>
      {student ? (
        quiz ? (
          <>
            <p className="mt-2 text-white/85">Your quiz is ready: {quiz.title}.</p>
            <Link to={`/play/${quiz.assignment_id}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-sun-400 px-6 py-3 font-bold text-grape-900 hover:bg-sun-300">
              Take the quiz
            </Link>
          </>
        ) : (
          <p className="mt-2 text-white/85">Astra is making your quiz from today's lesson. It'll appear here in a moment.</p>
        )
      ) : (
        <p className="mt-2 text-white/85">{quiz ? `The quiz "${quiz.title}" has been shared with the group.` : 'The quiz is being made and shared with the group.'}</p>
      )}
    </motion.section>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
