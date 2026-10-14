/**
 * A quiz, one question at a time. Four big answer tiles, each with its own
 * shape and colour so a child can find "the blue diamond" before they can
 * read it; keys 1–4 for those who can.
 *
 * Instant mode says right or wrong straight away and explains. End mode only
 * locks the answer in; the verdicts wait for the finish screen.
 *
 * How it looks follows the child's year (`level.ts`): bright bobbing tiles, a
 * star path and "read it to me" for Year 1–3, points for Year 4–6, and the
 * clean look for Forms.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ChatCircleDots, Check, Lightbulb, Sparkle, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Chip } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion } from '@/motion'
import type { Attempt, Played, QuizItem } from './api'
import { usePlayBackend } from './backend'
import { pick, POINTS_EACH, usePlayLook, type PlayLook } from './level'
import { BuddySpot } from './BuddyDock'
import { useAnswerCoach, useCoach } from './coach'
import { PlayHeader } from './PlayChrome'
import { PlayBackdrop, PointsBurst, ReadAloudButton } from './PlayFun'
import { MARKERS, Options } from './QuizOptions'
import { ExplainWhy, useWhy } from './ExplainWhy'
import { SecondChance } from './SecondChance'
import { usePlayVoice, type Line, type PlayVoice } from './usePlayVoice'
import type { PlayerProps } from './players'
import { playedById, quizItems, resumeAt, segments, skillLabel } from './session'

const END_MODE_ADVANCE_MS = 650

export function QuizPlayer({ attempt, buddy, exitTo, onFinished }: PlayerProps) {
  const items = quizItems(attempt)
  const [played, setPlayed] = useState<Record<string, Played>>(() => playedById(attempt.answered))
  const [index, setIndex] = useState(() => resumeAt(items, playedById(attempt.answered)))
  const [streak, setStreak] = useState(0)
  const [sending, setSending] = useState(false)
  const shownAt = useRef(Date.now())
  const [burst, setBurst] = useState(0)
  // "Let's look at it together" is open (§28.3.7).
  const [helping, setHelping] = useState(false)
  // "Tell me why" is open (§28.3.5).
  const [explaining, setExplaining] = useState(false)
  const { toast } = useToast()
  const sound = useSound()
  const calm = useCalmMotion()
  const backend = usePlayBackend()
  const look = usePlayLook()
  const voice = usePlayVoice(attempt.id, attempt.language)
  const instant = attempt.feedback_mode === 'instant'
  const item = items[index]
  const answer = item ? played[item.id] : undefined
  const coachAnswer = useAnswerCoach()
  useCoach(buddy, { index, total: items.length, waiting: Boolean(item) && !answer, readAloud: look.readAloud })
  const points = Object.values(played).filter((p) => p.correct === true).length * POINTS_EACH

  useEffect(() => {
    shownAt.current = Date.now()
    voice.stop()
    setHelping(false)
    setExplaining(false)
    // A new question starts quiet; `voice.stop` is stable.
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
      const result = await backend.answer(attempt.id, { item_id: item.id, choice, time_ms: Date.now() - shownAt.current })
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
      // Back on track after a miss gets its own cheer.
      buddy.current?.cue(coachAnswer(true, streakNow).cue, { streak: streakNow })
      if (streakNow >= 3 && streakNow % 3 === 0) celebrate({ calm, power: 0.6, origin: { x: 0.5, y: 0.7 } })
      else if (look.cheerEveryRight) celebrate({ calm, power: 0.35, origin: { x: 0.5, y: 0.75 } })
      if (look.points) setBurst((n) => n + 1)
    } else if (result.correct === false) {
      sound('wrong')
      // Two in a row: a kind word and a way to think about it.
      const reply = coachAnswer(false, streakNow)
      buddy.current?.cue(reply.cue, { strategy: reply.strategy })
    } else {
      buddy.current?.play('happy')
    }
  }

  // An end-mode quiz advances by itself; past the last question, finish.
  useEffect(() => {
    if (index >= items.length && items.length > 0) onFinished()
  }, [index, items.length, onFinished])

  // The second chance's own question takes the keys while it is open.
  const sheetOpen = helping || explaining
  useKeys(sheetOpen ? 0 : (item?.options.length ?? 0), (n) => void choose(n), answer && instant && !sheetOpen ? next : null)
  const closeHelp = useCallback(() => setHelping(false), [])
  const closeWhy = useCallback(() => setExplaining(false), [])
  const why = useWhy(attempt, played)

  if (!item) return null
  return (
    <div className="flex min-h-dvh flex-col">
      <PlayBackdrop kind={look.backdrop} />
      <PlayHeader
        title={attempt.title}
        kind="quiz"
        parts={segments(items, played, index)}
        streak={instant ? streak : 0}
        points={instant ? points : undefined}
        exitTo={exitTo}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-40 md:pt-10">
        <AnimatePresence mode="wait">
          <motion.section
            key={item.id}
            initial={{ opacity: 0, x: 60, rotate: 2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -60, rotate: -2, transition: { duration: 0.18 } }}
            transition={spring.gentle}
          >
            <QuizQuestion attempt={attempt} item={item} index={index} total={items.length} answer={answer} instant={instant} disabled={sending} voice={voice} onChoose={(n) => void choose(n)} />
          </motion.section>
        </AnimatePresence>
        <BuddySpot />
      </main>
      <AnimatePresence>
        {answer && instant && (
          <Verdict
            key={item.id}
            item={item}
            answer={answer}
            look={look}
            burst={look.points && answer.correct === true && burst > 0}
            last={resumeAt(items, played) >= items.length}
            onHelp={attempt.second_chance && answer.correct === false ? () => setHelping(true) : null}
            onWhy={why.offer(answer) ? () => setExplaining(true) : null}
            onNext={next}
          />
        )}
      </AnimatePresence>
      {explaining && answer && (
        <ExplainWhy
          key={item.id}
          item={item}
          answerText={correctAnswer(item, answer)}
          last={resumeAt(items, played) >= items.length}
          judge={(words) => why.judge(item.id, words)}
          onJudged={why.used}
          onClose={closeWhy}
          onNext={next}
        />
      )}
      <AnimatePresence>
        {helping && answer && (
          <SecondChance
            key={item.id}
            attempt={attempt}
            item={item}
            answerText={correctAnswer(item, answer)}
            look={look}
            last={resumeAt(items, played) >= items.length}
            onClose={closeHelp}
            onNext={next}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One question as a student sees it: the card with its number and skill,
 * and the four tiles. The player and the preview both show it.
 */
export function QuizQuestion({
  attempt,
  item,
  index,
  total,
  answer,
  instant,
  disabled,
  voice,
  onChoose,
}: {
  attempt: Attempt
  item: QuizItem
  index: number
  total: number
  answer: Played | undefined
  instant: boolean
  disabled: boolean
  voice: PlayVoice
  onChoose: (choice: number) => void
}) {
  const look = usePlayLook()
  // The server says the same words, by the same shape names (`read_aloud.py`).
  const heard: Line[] = [
    { spoken: { item: item.id, part: 'question' }, text: item.prompt },
    ...item.options.map((o, n): Line => ({ spoken: { item: item.id, part: 'option', n }, text: `${MARKERS[n % MARKERS.length].name}: ${o}` })),
  ]
  return (
    <>
      <div className={cn(look.questionCard && 'relative overflow-hidden rounded-3xl border-2 border-border bg-surface p-5 shadow-sm')}>
        {look.questionCard && <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-kind-quiz-vivid via-sun-400 to-mint-400" />}
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="sun" className="text-sm">
            Question {index + 1} of {total}
          </Chip>
          <Chip className="text-sm capitalize">{skillLabel(attempt, item.skill)}</Chip>
          {look.readAloud && <ReadAloudButton voice={voice} id={item.id} lines={heard} className="ml-auto" />}
        </div>
        <h1 className={cn(look.questionCard ? 'mt-3' : 'mt-4', look.question)}>{item.prompt}</h1>
      </div>
      <Options item={item} answer={answer} instant={instant} disabled={disabled} look={look} onChoose={onChoose} />
    </>
  )
}

function Verdict({
  item,
  answer,
  look,
  burst,
  last,
  onHelp,
  onWhy,
  onNext,
}: {
  item: QuizItem
  answer: Played
  look: PlayLook
  /** Points just won, rising out of the verdict. */
  burst: boolean
  last: boolean
  /** A second chance, after a wrong answer where the quiz offers one. */
  onHelp: (() => void) | null
  /** "Tell me why", sometimes, after a right one (Form 1–5). */
  onWhy: (() => void) | null
  onNext: () => void
}) {
  const right = answer.correct === true
  const said = pick(right ? look.rightWords : look.wrongWords, item.id)
  const correctText = correctAnswer(item, answer)
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
      <div className={cn('relative mx-auto flex w-full max-w-3xl flex-col gap-3 py-4 pr-24 pl-4 md:pr-40 xl:pr-4', !onHelp && !onWhy && 'sm:flex-row sm:items-center')}>
        <PointsBurst amount={POINTS_EACH} show={burst} />
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
            <p className={cn(look.level === 'little' ? 'font-celebrate text-3xl' : 'font-display text-2xl font-semibold')}>{said}</p>
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
        <div className={cn('flex shrink-0 flex-wrap gap-2', (onHelp || onWhy) && 'sm:justify-end')}>
          {onWhy && (
            <Button size="lg" variant="secondary" onClick={onWhy}>
              <ChatCircleDots weight="fill" className="size-5" />
              Tell me why
            </Button>
          )}
          {onHelp && (
            <Button size="lg" variant="secondary" onClick={onHelp}>
              <Sparkle weight="fill" className="size-5" />
              Let's look at it together
            </Button>
          )}
          <Button ref={next} size="lg" variant={right ? 'primary' : 'sun'} onClick={onNext}>
            {last ? 'See my score' : 'Next'}
            <ArrowRight weight="bold" className="size-5" />
          </Button>
        </div>
      </div>
    </motion.aside>
  )
}

function correctAnswer(item: QuizItem, answer: Played): string | null {
  return typeof answer.reveal?.answer === 'number' ? (item.options[answer.reveal.answer] ?? null) : null
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
