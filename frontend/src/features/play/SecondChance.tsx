/**
 * Second chance, at your level (§28.3.7). After a wrong answer the buddy says
 * "Let's look at it together": why the right answer is right, at the level
 * the child picks — Simpler, Just right or Challenge — with a worked example
 * stepped through, then **one like it** to try. Right on the second try is a
 * comeback: the buddy cheers and grows a little. The score stands either way.
 *
 * A sheet over the quiz that takes the keyboard while open; Escape or "Back"
 * returns to the verdict, and "Next" goes on with the quiz.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowCounterClockwise, ArrowRight, Check, Lightbulb, Plant, PushPin, Sparkle, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Alert, Button, Chip, Skeleton } from '@/components/ui'
import { trapTab } from '@/components/ui/Dialog'
import { errorMessage } from '@/features/auth/errors'
import { Buddy, profileOf, type BuddyHandle } from '@/features/buddies'
import { useGrowth } from '@/features/buddies/GrowthProvider'
import { InsideSceneProvider, useCoversScreen } from '@/features/celebrate/Scene'
import { LevelSwitch } from '@/features/guide/LevelSwitch'
import { rememberedLevel, rememberLevel } from '@/features/guide/level'
import type { ReadingLevel } from '@/features/learning/api'
import { useAuth } from '@/lib/auth'
import { buzz, BUZZ } from '@/lib/haptics'
import { usePreferences } from '@/lib/prefs'
import { useSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { celebrate, rise, spring, stagger, useCalmMotion } from '@/motion'
import type { Attempt, Played, QuizItem } from './api'
import type { PlayLook } from './level'
import { Options } from './QuizOptions'
import { secondChanceApi, type Explanation, type Twin } from './secondChanceApi'

interface Props {
  attempt: Attempt
  item: QuizItem
  /** The right answer's words, as the verdict said them. */
  answerText: string | null
  look: PlayLook
  /** The last question: "Next" sees the score. */
  last: boolean
  onClose: () => void
  onNext: () => void
}

export function SecondChance({ attempt, item, answerText, look, last, onClose, onNext }: Props) {
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const panel = useRef<HTMLElement>(null)
  const buddyRef = useRef<BuddyHandle>(null)
  const { user } = useAuth()
  const [twin, setTwin] = useState<Twin | null | 'asking' | 'none'>(null)
  const name = profileOf(user?.buddy).name
  useCoversScreen()

  // Takes the keyboard while open, and gives it back on close.
  useEffect(() => {
    const returnTo = document.activeElement
    heading.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') trapTab(event, panel.current)
    }
    window.addEventListener('keydown', onKey)
    const scrolled = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = scrolled
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus()
    }
  }, [onClose])

  async function askTwin() {
    setTwin('asking')
    try {
      const found = (await secondChanceApi.twin(attempt.id, item.id)).twin
      setTwin(found ?? 'none')
    } catch {
      setTwin('none')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div className="absolute inset-0 bg-grape-900/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
      <motion.section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border-t-4 border-primary bg-surface shadow-lg"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: spring.gentle }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <header className="flex items-start gap-3 px-4 pt-4 pb-2 sm:px-6">
          <InsideSceneProvider value>
            <Buddy ref={buddyRef} buddy={user?.buddy} size={88} mood="think" interactive={false} track={false} own />
          </InsideSceneProvider>
          <div className="min-w-0 flex-1 pt-1">
            <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.18em] text-primary">
              <ArrowCounterClockwise weight="bold" className="size-4 shrink-0" aria-hidden />
              Second chance
            </p>
            <h2 id={titleId} ref={heading} tabIndex={-1} className="font-display text-2xl leading-tight font-semibold outline-none sm:text-3xl">
              Let's look at it together
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Back to the quiz" className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground">
            <X weight="bold" className="size-5" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 sm:px-6">
          <Recap item={item} answerText={answerText} />
          <Explained attempt={attempt} item={item} />
          {twin === null && (
            <Button size="lg" onClick={() => void askTwin()} className="w-full sm:w-auto">
              <Sparkle weight="fill" className="size-5" />
              Try one like it
            </Button>
          )}
          {twin === 'asking' && <Skeleton className="h-56 rounded-3xl" />}
          {twin === 'none' && <p className="rounded-2xl bg-muted px-4 py-3 font-bold">No question like it just now. Keep going: the next one is yours!</p>}
          {twin && typeof twin === 'object' && <TwinQuestion attempt={attempt} item={item} start={twin} look={look} name={name} buddy={buddyRef} />}
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t-2 border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button size="lg" variant="sun" onClick={onNext}>
            {last ? 'See my score' : 'Next question'}
            <ArrowRight weight="bold" className="size-5" />
          </Button>
        </footer>
      </motion.section>
    </div>
  )
}

/** The question missed, and its answer, so the explanation has something to point at. */
function Recap({ item, answerText }: { item: QuizItem; answerText: string | null }) {
  return (
    <div className="rounded-3xl border-2 border-border bg-muted/40 p-4">
      <p className="text-sm font-bold text-muted-foreground">The question</p>
      <p className="mt-0.5 text-lg font-bold break-words">{item.prompt}</p>
      {answerText && (
        <p className="mt-2 flex items-start gap-2 font-bold">
          <Check weight="bold" className="mt-0.5 size-5 shrink-0 text-correct" aria-hidden />
          <span className="min-w-0 break-words">The answer: {answerText}</span>
        </p>
      )}
    </div>
  )
}

function Explained({ attempt, item }: { attempt: Attempt; item: QuizItem }) {
  const [level, setLevel] = useState<ReadingLevel>(() => rememberedLevel())
  const [found, setFound] = useState<Partial<Record<ReadingLevel, Explanation>>>({})
  const [error, setError] = useState<string | null>(null)
  const shown = found[level]

  const load = useCallback(
    async (at: ReadingLevel) => {
      setError(null)
      try {
        const explained = await secondChanceApi.explain(attempt.id, item.id, at)
        setFound((now) => ({ ...now, [at]: explained }))
      } catch (caught) {
        setError(errorMessage(caught))
      }
    },
    [attempt.id, item.id],
  )

  useEffect(() => {
    if (!found[level]) void load(level)
    // Each level once; the server keeps what it wrote.
  }, [level, load])

  function choose(next: ReadingLevel) {
    setLevel(next)
    rememberLevel(next)
  }

  return (
    <section aria-label="Why" className="space-y-3">
      <LevelSwitch value={level} onChange={choose} block />
      {error ? (
        <Alert>
          {error}{' '}
          <button type="button" className="font-bold underline" onClick={() => void load(level)}>
            Try again
          </button>
        </Alert>
      ) : !shown ? (
        <Thinking />
      ) : (
        <AnimatePresence mode="wait">
          <ExplanationView key={level} explanation={shown} />
        </AnimatePresence>
      )}
    </section>
  )
}

function Thinking() {
  return (
    <div role="status" className="space-y-2">
      <p className="text-sm font-bold text-muted-foreground">Writing it just for you…</p>
      <Skeleton className="h-6 w-4/5 rounded-xl" />
      <Skeleton className="h-28 rounded-3xl" />
    </div>
  )
}

function ExplanationView({ explanation }: { explanation: Explanation }) {
  const { why, example, remember } = explanation
  return (
    <motion.div variants={stagger(0.12)} initial="hidden" animate="shown" exit={{ opacity: 0, transition: { duration: 0.12 } }} className="space-y-3">
      <motion.p variants={rise} className="flex gap-2 text-lg leading-snug">
        <Lightbulb weight="duotone" className="mt-1 size-6 shrink-0 text-sun-600" aria-hidden />
        <span className="min-w-0 break-words">{why}</span>
      </motion.p>
      {example && (
        <motion.div variants={rise} className="rounded-3xl border-2 border-primary/30 bg-selected p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">Worked example</p>
          <p className="mt-1 text-lg font-bold break-words">{example.problem}</p>
          <motion.ol variants={stagger(0.35)} className="mt-3 space-y-2">
            {example.steps.map((step, n) => (
              <motion.li key={n} variants={rise} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
                  {n + 1}
                </span>
                <span className="min-w-0 pt-0.5 break-words">{step}</span>
              </motion.li>
            ))}
            <motion.li variants={rise} className="flex flex-wrap items-center gap-2 rounded-2xl bg-correct-soft px-3 py-2 font-bold">
              <Check weight="bold" className="size-5 shrink-0 text-correct" aria-hidden />
              <span className="min-w-0 break-words">{example.answer}</span>
            </motion.li>
          </motion.ol>
        </motion.div>
      )}
      {remember && (
        <motion.p variants={rise} className="flex gap-2 rounded-2xl bg-sun-100 px-3 py-2 font-bold dark:bg-sun-600/20">
          <PushPin weight="fill" className="mt-0.5 size-5 shrink-0 text-sun-600" aria-hidden />
          <span className="min-w-0 break-words">{remember}</span>
        </motion.p>
      )}
    </motion.div>
  )
}

function TwinQuestion({
  attempt,
  item,
  start,
  look,
  name,
  buddy,
}: {
  attempt: Attempt
  item: QuizItem
  start: Twin
  look: PlayLook
  name: string
  buddy: React.RefObject<BuddyHandle>
}) {
  const [twin, setTwin] = useState(start)
  const [sending, setSending] = useState(false)
  const shown = useRef<HTMLElement>(null)
  useInView(shown)
  const [error, setError] = useState<string | null>(null)
  const react = useTwinReaction(buddy)
  const tried = twin.correct !== null
  const asked: QuizItem = { id: `${item.id}-twin`, prompt: twin.prompt, options: twin.options, skill: item.skill, difficulty: item.difficulty }
  const answer: Played | undefined = tried
    ? { item_id: asked.id, choice: twin.choice, knew: null, correct: twin.correct, reveal: { answer: twin.answer ?? undefined, explanation: twin.explanation ?? '' } }
    : undefined

  async function choose(choice: number) {
    if (tried || sending) return
    setSending(true)
    setError(null)
    try {
      const result = (await secondChanceApi.tryTwin(attempt.id, item.id, choice)).twin
      setTwin(result)
      react(result)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.section ref={shown} aria-label="One like it" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} className="rounded-3xl border-2 border-border p-4">
      <Chip tone="sun" className="text-sm">
        One like it
      </Chip>
      <h3 className="mt-2 font-display text-xl leading-snug font-semibold break-words sm:text-2xl">{twin.prompt}</h3>
      <Options item={asked} answer={answer} instant disabled={sending} look={look} onChoose={(n) => void choose(n)} />
      {error && <Alert className="mt-3">{error}</Alert>}
      {tried && <TwinVerdict twin={twin} name={name} />}
    </motion.section>
  )
}

function TwinVerdict({ twin, name }: { twin: Twin; name: string }) {
  const right = twin.correct === true
  const answerText = twin.answer !== null ? twin.options[twin.answer] : null
  const shown = useRef<HTMLDivElement>(null)
  useInView(shown)
  return (
    <motion.div ref={shown} role="status" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy} className={cn('mt-4 rounded-2xl p-4', right ? 'bg-correct-soft' : 'bg-wrong-soft')}>
      <p className={cn('font-display text-2xl font-semibold', right && 'text-correct')}>{right ? 'You got it! What a comeback.' : 'Nearly there.'}</p>
      {!right && <p className="break-words">That one was tricky. Trying again is how we learn.</p>}
      {!right && answerText && (
        <p className="font-bold break-words">
          The answer is <span className="underline decoration-correct decoration-4 underline-offset-4">{answerText}</span>
        </p>
      )}
      {twin.explanation && <p className="mt-1 break-words text-foreground/80">{twin.explanation}</p>}
      {twin.grew && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-bold">
          <Plant weight="fill" className="size-4 text-correct" aria-hidden />
          {name} grew a little!
        </p>
      )}
    </motion.div>
  )
}

/** Brings something new in the sheet into view, gently unless motion is calm. */
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const calm = useCalmMotion()
  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' })
    // Once, as it appears.
  }, [])
}

/** The buddy, sound and a buzz for the second try: a cheer and confetti for
 *  a comeback, an "oops" and a kind word otherwise. Its words go in the
 *  sheet, not a bubble over it. */
function useTwinReaction(buddy: React.RefObject<BuddyHandle>) {
  const sound = useSound()
  const calm = useCalmMotion()
  const { prefs } = usePreferences()
  const growth = useGrowth()
  return useCallback(
    (twin: Twin) => {
      if (twin.correct) {
        sound('correct')
        buzz(BUZZ.right, prefs.sound)
        buddy.current?.play('cheer', 2400)
        celebrate({ calm, power: 0.7, origin: { x: 0.5, y: 0.75 } })
        if (twin.grew) void growth?.refresh()
      } else {
        sound('wrong')
        buddy.current?.play('oops', 1600)
      }
    },
    [buddy, sound, calm, prefs.sound, growth],
  )
}
