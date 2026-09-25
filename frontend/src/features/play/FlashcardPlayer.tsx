/**
 * Flashcards: flip, then say honestly whether you knew it — tap a button,
 * swipe the card, or press ← / →. The ones you did not know come back for a
 * second round at the end, which is practice only; the first answer is the
 * one that counts.
 */
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { ArrowCounterClockwise, ArrowsClockwise, Check, Lightbulb } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button, Chip } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { playApi, type CardItem, type Played } from './api'
import { PlayHeader } from './PlayChrome'
import type { PlayerProps } from './players'
import { cardItems, playedById, resumeAt, segments, skillLabel, type Segment } from './session'

const SWIPE_PX = 110

type Phase = 'first' | 'between' | 'second'

export function FlashcardPlayer({ attempt, buddy, exitTo, onFinished }: PlayerProps) {
  const cards = cardItems(attempt)
  const [played, setPlayed] = useState<Record<string, Played>>(() => playedById(attempt.answered))
  const [index, setIndex] = useState(() => resumeAt(cards, playedById(attempt.answered)))
  const [phase, setPhase] = useState<Phase>('first')
  const [again, setAgain] = useState<CardItem[]>([])
  const [flipped, setFlipped] = useState(false)
  const [leaving, setLeaving] = useState<'knew' | 'notYet' | null>(null)
  const [sending, setSending] = useState(false)
  const shownAt = useRef(Date.now())
  const { toast } = useToast()
  const sound = useSound()

  const deck = phase === 'second' ? again : cards
  const card = deck[index]

  useEffect(() => {
    shownAt.current = Date.now()
    setFlipped(false)
    setLeaving(null)
  }, [index, phase])

  useEffect(() => {
    if (phase === 'first' && index >= cards.length && cards.length > 0) {
      const missed = cards.filter((c) => played[c.id]?.knew === false)
      if (missed.length > 0) {
        setAgain(missed)
        setPhase('between')
      } else onFinished()
    }
    if (phase === 'second' && index >= again.length) onFinished()
  }, [phase, index, cards, again, played, onFinished])

  function flip() {
    if (!card || leaving) return
    sound('flip')
    setFlipped((f) => !f)
  }

  async function mark(knew: boolean) {
    if (!card || sending || leaving) return
    if (!flipped) return flip()
    setLeaving(knew ? 'knew' : 'notYet')
    buddy.current?.cue(knew ? 'knew' : 'notYet')
    sound(knew ? 'correct' : 'tap')
    if (phase === 'first') {
      setSending(true)
      try {
        const result = await playApi.answer(attempt.id, { item_id: card.id, knew, time_ms: Date.now() - shownAt.current })
        setPlayed((now) => ({ ...now, [card.id]: result.played }))
      } catch (error) {
        setLeaving(null)
        toast('That did not save', { tone: 'error', body: errorMessage(error) })
        return
      } finally {
        setSending(false)
      }
    }
    window.setTimeout(() => setIndex((i) => i + 1), 260)
  }

  useCardKeys(phase !== 'between', { flip, knew: () => void mark(true), notYet: () => void mark(false) })

  const parts: Segment[] =
    phase === 'second'
      ? again.map((_, i): Segment => (i < index ? 'correct' : i === index ? 'current' : 'todo'))
      : segments(cards, played, index)

  return (
    <div className="flex min-h-dvh flex-col">
      <PlayHeader title={phase === 'second' ? `${attempt.title} · round 2` : attempt.title} kind="flashcard" parts={parts} exitTo={exitTo} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 pt-6 pb-10 md:pt-10">
        {phase === 'between' ? (
          <RoundTwo count={again.length} onGo={() => (setIndex(0), setPhase('second'))} onSkip={onFinished} />
        ) : (
          card && (
            <>
              <div className="flex w-full flex-wrap items-center justify-center gap-2">
                <Chip tone="mint" className="text-sm">
                  Card {index + 1} of {deck.length}
                </Chip>
                <Chip className="text-sm capitalize">{skillLabel(attempt, card.skill)}</Chip>
              </div>
              <Deck left={deck.length - index - 1}>
                <AnimatePresence mode="wait">
                  <Flashcard key={`${phase}-${card.id}`} card={card} flipped={flipped} leaving={leaving} onFlip={flip} onSwipe={(knew) => void mark(knew)} />
                </AnimatePresence>
              </Deck>
              <Controls flipped={flipped} disabled={sending || Boolean(leaving)} onFlip={flip} onMark={(knew) => void mark(knew)} />
            </>
          )
        )}
      </main>
    </div>
  )
}

/** A few cards peeking out underneath, so the pile shows how much is left. */
function Deck({ left, children }: { left: number; children: React.ReactNode }) {
  return (
    <div className="relative mt-6 w-full max-w-lg">
      {[2, 1].filter((n) => n <= left).map((n) => (
        <div
          key={n}
          aria-hidden
          className="absolute inset-0 rounded-[2rem] border-2 border-border bg-surface shadow"
          style={{ transform: `translateY(${n * 10}px) scale(${1 - n * 0.04}) rotate(${n % 2 ? 2 : -2}deg)` }}
        />
      ))}
      {children}
    </div>
  )
}

function Flashcard({
  card,
  flipped,
  leaving,
  onFlip,
  onSwipe,
}: {
  card: CardItem
  flipped: boolean
  leaving: 'knew' | 'notYet' | null
  onFlip: () => void
  onSwipe: (knew: boolean) => void
}) {
  const [hint, setHint] = useState(false)
  const x = useMotionValue(0)
  const tilt = useTransform(x, [-200, 200], [-12, 12])
  const knewGlow = useTransform(x, [20, SWIPE_PX], [0, 1])
  const notYetGlow = useTransform(x, [-SWIPE_PX, -20], [1, 0])

  function release(_: unknown, info: PanInfo) {
    if (!flipped) return
    if (info.offset.x > SWIPE_PX) onSwipe(true)
    else if (info.offset.x < -SWIPE_PX) onSwipe(false)
  }

  const away = leaving === 'knew' ? 520 : leaving === 'notYet' ? -520 : 0
  return (
    <motion.div
      className="relative aspect-[4/5] w-full touch-pan-y sm:aspect-[3/2]"
      // Perspective here, on the flipping card's own parent: a transformed
      // ancestor further up flattens 3D, and the flip would read as a squash.
      style={{ x, rotate: tilt, perspective: 1400 }}
      drag={flipped && !leaving ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={release}
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={leaving ? { x: away, opacity: 0, rotate: away / 20 } : { opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={spring.gentle}
    >
      <motion.button
        type="button"
        onClick={onFlip}
        aria-label={flipped ? 'Show the front' : 'Flip the card'}
        className="relative block size-full cursor-pointer rounded-[2rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <Face side="front">
          <p className="text-sm font-bold tracking-wide text-kind-flashcard uppercase">Front</p>
          <p className="mt-3 font-display text-3xl leading-tight font-semibold md:text-4xl">{card.front}</p>
          {card.hint && (
            <span className="mt-5">
              {hint ? (
                <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 rounded-full bg-sun-100 px-3 py-1 font-bold text-sun-600 dark:bg-sun-600/25 dark:text-sun-300">
                  <Lightbulb weight="fill" className="size-4" />
                  {card.hint}
                </motion.span>
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => (event.stopPropagation(), setHint(true))}
                  onKeyDown={(event) => event.key === 'Enter' && (event.stopPropagation(), setHint(true))}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-muted-foreground hover:bg-hover"
                >
                  <Lightbulb weight="duotone" className="size-4" />
                  Need a hint?
                </span>
              )}
            </span>
          )}
          <span className="absolute bottom-5 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <ArrowsClockwise weight="bold" className="size-4" />
            Tap to flip
          </span>
        </Face>
        <Face side="back">
          <p className="text-sm font-bold tracking-wide text-kind-flashcard uppercase">Back</p>
          <p className="mt-3 text-2xl leading-snug font-bold md:text-3xl">{card.back}</p>
          <motion.span style={{ opacity: knewGlow }} className="pointer-events-none absolute inset-0 rounded-[2rem] ring-8 ring-correct ring-inset" />
          <motion.span style={{ opacity: notYetGlow }} className="pointer-events-none absolute inset-0 rounded-[2rem] ring-8 ring-wrong ring-inset" />
        </Face>
      </motion.button>
    </motion.div>
  )
}

function Face({ side, children }: { side: 'front' | 'back'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] border-2 p-8 text-center shadow-lg [backface-visibility:hidden]',
        side === 'front' ? 'border-border bg-surface' : 'border-kind-flashcard-vivid [transform:rotateY(180deg)]',
      )}
      style={side === 'back' ? { backgroundColor: 'hsl(var(--surface))', backgroundImage: 'linear-gradient(hsl(var(--kind-flashcard-vivid) / 0.12), hsl(var(--kind-flashcard-vivid) / 0.12))' } : undefined}
    >
      {children}
    </span>
  )
}

function Controls({ flipped, disabled, onFlip, onMark }: { flipped: boolean; disabled: boolean; onFlip: () => void; onMark: (knew: boolean) => void }) {
  return (
    <div className="mt-8 flex w-full max-w-lg items-center justify-center gap-3">
      <AnimatePresence mode="wait" initial={false}>
        {flipped ? (
          <motion.div key="mark" className="flex w-full gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <Button size="lg" variant="outline" className="flex-1 border-wrong text-wrong" disabled={disabled} onClick={() => onMark(false)}>
              <ArrowCounterClockwise weight="bold" className="size-5" />
              Not yet
            </Button>
            <Button size="lg" className="flex-1 bg-correct text-white" disabled={disabled} onClick={() => onMark(true)}>
              <Check weight="bold" className="size-5" />
              Knew it!
            </Button>
          </motion.div>
        ) : (
          <motion.div key="flip" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <Button size="lg" variant="sun" onClick={onFlip} disabled={disabled}>
              <ArrowsClockwise weight="bold" className="size-5" />
              Flip it
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RoundTwo({ count, onGo, onSkip }: { count: number; onGo: () => void; onSkip: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy} className="mt-10 max-w-md text-center">
      <p className="font-celebrate text-5xl text-kind-flashcard">Round 2!</p>
      <p className="mt-3 text-lg">
        {count === 1 ? 'One card' : `${count} cards`} to go over again. Practice makes them stick!
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button size="lg" onClick={onGo}>Let's go!</Button>
        <Button size="lg" variant="ghost" onClick={onSkip}>Finish now</Button>
      </div>
    </motion.div>
  )
}

function useCardKeys(active: boolean, actions: { flip: () => void; knew: () => void; notYet: () => void }) {
  const latest = useRef(actions)
  latest.current = actions
  useEffect(() => {
    if (!active) return
    const handle = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        latest.current.flip()
      } else if (event.key === 'ArrowRight') latest.current.knew()
      else if (event.key === 'ArrowLeft') latest.current.notYet()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [active])
}
