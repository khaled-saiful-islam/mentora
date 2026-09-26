/**
 * The pieces of the live room: classmates (seen, never messaged), the hand,
 * the quick check, and the end of the lesson.
 */
import { CheckCircle, HandWaving, PaperPlaneRight, Sparkle, SpeakerHigh, Trophy } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { Buddy } from '@/features/buddies'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion } from '@/motion'
import type { RosterEntry, RoomEvent } from './api'
import { VoiceInput } from '@/features/voice/VoiceInput'
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
  myQuestion,
  onSend,
  onLower,
  onAsk,
}: {
  mine: MyHand
  left: number
  position: number
  mode: 'anytime' | 'pauses'
  calledName: string | null
  myQuestion: string | null
  /** Send a question — said or typed — into the queue. */
  onSend: (question: string) => void
  onLower: () => void
  /** The question from a student called on without one. */
  onAsk: (text: string) => void
}) {
  const calm = useCalmMotion()
  const [text, setText] = useState('')
  const ready = text.trim().length > 1

  if (mine === 'called') {
    return (
      <QuestionBox
        title="Astra is listening — ask your question"
        text={text}
        setText={setText}
        onSubmit={() => ready && onAsk(text.trim())}
        action="Ask"
      />
    )
  }
  if (mine === 'asked') {
    return (
      <div className="rounded-3xl bg-white/10 p-4 text-center">
        <p className="font-display text-lg font-bold text-sun-300">Astra is answering your question</p>
        {myQuestion && <p className="mt-1 break-words text-white/85">“{myQuestion}”</p>}
      </div>
    )
  }
  if (mine === 'up') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white/10 p-4">
        <motion.span
          animate={calm ? undefined : { rotate: [0, 16, -8, 16, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.5 }}
          style={{ originX: 0.7, originY: 0.9 }}
          className="inline-flex shrink-0"
        >
          <HandWaving weight="fill" className="size-8 text-sun-300" aria-hidden />
        </motion.span>
        <div className="min-w-[min(100%,14rem)] flex-1">
          <p className="font-bold">
            {position <= 1 ? "You're next — Astra will read your question out." : `You're ${ordinal(position)} in line.`}
            {mode === 'pauses' && ' Questions are answered at the end of each part.'}
          </p>
          {myQuestion && <p className="mt-0.5 break-words text-sm text-white/80">“{myQuestion}”</p>}
        </div>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onLower}>
          Take it back
        </Button>
      </div>
    )
  }
  if (left <= 0) {
    return <p className="rounded-3xl bg-white/10 p-4 text-center text-sm font-semibold text-white/85">You've asked all your questions for this lesson.</p>
  }
  return (
    <QuestionBox
      title="Ask Astra a question"
      hint={`Tap the mic and say it, or type it. ${left} question${left === 1 ? '' : 's'} left.${calledName ? ` (${calledName} is asking now.)` : ''}`}
      text={text}
      setText={setText}
      onSubmit={() => {
        if (!ready) return
        onSend(text.trim())
        setText('')
      }}
      action="Send"
    />
  )
}

function QuestionBox({
  title,
  hint,
  text,
  setText,
  onSubmit,
  action,
}: {
  title: string
  hint?: string
  text: string
  setText: (t: string) => void
  onSubmit: () => void
  action: string
}) {
  const ready = text.trim().length > 1
  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-2 rounded-3xl bg-white/10 p-4 ring-2 ring-white/20 focus-within:ring-sun-400"
    >
      <p className="font-display text-lg font-bold text-sun-300">{title}</p>
      {hint && <p className="text-sm text-white/80">{hint}</p>}
      <div className="flex flex-wrap items-start gap-2">
        <VoiceInput
          id="room-question"
          label="Your question"
          value={text}
          onChange={setText}
          placeholder="What would you like to ask?"
          tone="dark"
          onEnter={onSubmit}
          className="min-w-[min(100%,16rem)] flex-1"
        />
        <Button type="submit" variant="sun" size="lg" disabled={!ready}>
          <PaperPlaneRight weight="fill" className="size-4" aria-hidden />
          {action}
        </Button>
      </div>
    </motion.form>
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
  const total = shown?.seconds ?? 20
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
      <div className="mb-2 flex items-center gap-3">
        <p className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-kind-live">
          <Sparkle weight="fill" className="size-3.5" aria-hidden />
          Quick check
        </p>
        {shown && (
          <>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="timer" aria-label={`${secondsLeft} seconds left`}>
              <motion.div
                className={cn('h-full rounded-full', secondsLeft <= 5 ? 'bg-coral-400' : 'bg-kind-live-vivid')}
                initial={false}
                animate={{ width: `${(secondsLeft / total) * 100}%` }}
                transition={{ duration: 0.5, ease: 'linear' }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums">{secondsLeft}s</span>
          </>
        )}
      </div>
      {shown && <h3 className={cn('mb-3 break-words font-display font-bold leading-snug', total <= 15 ? 'text-base' : 'text-lg')}>{shown.question}</h3>}
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
                'break-words rounded-2xl border-2 px-3 py-2 text-left text-sm font-bold transition-colors',
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
