/**
 * A quiz or deck for the teacher or parent who made it, seen exactly as a
 * student sees it — the same question card and tiles, the same card that
 * turns over, the look for the set's year, the buddy — but walked through
 * with Next and Back, so every question can be seen without answering one.
 *
 * "Show answers" (a quiz's) marks the right tile and says why, for checking.
 * Nothing is sent or saved.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowClockwise, ArrowLeft, ArrowRight, CheckCircle, GameController, Lightbulb } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Chip } from '@/components/ui'
import type { QuizItem as KeyedQuiz, SetDetail } from '@/features/learning/api'
import { nounOf } from '@/features/learning/kinds'
import { useSound } from '@/lib/sound'
import { spring } from '@/motion'
import type { Attempt, Played } from './api'
import { BuddySpot } from './BuddyDock'
import { Deck, Flashcard } from './FlashcardPlayer'
import { usePlayLook } from './level'
import { PlayHeader } from './PlayChrome'
import { PlayBackdrop, ReadAloudButton } from './PlayFun'
import { QuizQuestion } from './QuizPlayer'
import { cardItems, quizItems, skillLabel, type Segment } from './session'
import { usePlayVoice } from './usePlayVoice'

export interface BrowseProps {
  attempt: Attempt
  set: SetDetail
  /** Mark the right answers — a quiz's; a card shows its back when turned. */
  reveal: boolean
  exitTo: string
  onPlay: () => void
}

/** The bar's parts while browsing: seen, this one, still to come. */
export function browseParts(total: number, at: number): Segment[] {
  return Array.from({ length: total }, (_, i) => (i === at ? 'current' : i < at ? 'answered' : 'todo'))
}

/** What the tiles show when answers are revealed: the right one, and why. */
export function revealed(set: SetDetail, itemId: string): Played | undefined {
  const keyed = set.items.find((i): i is KeyedQuiz => i.id === itemId && 'options' in i && !('heading' in i))
  if (!keyed) return undefined
  return { item_id: itemId, choice: null, knew: null, correct: null, reveal: { answer: keyed.answer, explanation: keyed.explanation } }
}

export function BrowseQuiz({ attempt, set, reveal, exitTo, onPlay }: BrowseProps) {
  const items = quizItems(attempt)
  const [at, go] = useStep(items.length)
  const look = usePlayLook()
  const voice = usePlayVoice(attempt.id, attempt.language)
  const item = items[at]
  const answer = item && reveal ? revealed(set, item.id) : undefined

  useEffect(() => {
    voice.stop()
    // A new question starts quiet; `voice.stop` is stable.
  }, [at])

  return (
    <div className="flex min-h-dvh flex-col">
      <PlayBackdrop kind={look.backdrop} />
      <PlayHeader title={attempt.title} kind="quiz" parts={browseParts(items.length, at)} exitTo={exitTo} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-16 md:pt-10">
        <AnimatePresence mode="wait">
          <motion.section
            key={item?.id ?? 'end'}
            initial={{ opacity: 0, x: 60, rotate: 2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -60, rotate: -2, transition: { duration: 0.18 } }}
            transition={spring.gentle}
          >
            {item ? (
              <>
                <QuizQuestion attempt={attempt} item={item} index={at} total={items.length} answer={answer} instant disabled voice={voice} onChoose={() => undefined} />
                {answer?.reveal?.explanation && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl bg-correct-soft p-4">
                    <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-sun-600 dark:text-sun-300" aria-hidden />
                    <p className="min-w-0 break-words">
                      <span className="font-bold">Why: </span>
                      {answer.reveal.explanation}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <End count={items.length} kind="quiz" exitTo={exitTo} onAgain={() => go(0)} onPlay={onPlay} />
            )}
          </motion.section>
        </AnimatePresence>
        {item && <Steps at={at} total={items.length} noun="question" onGo={go} />}
        <BuddySpot />
      </main>
    </div>
  )
}

export function BrowseCards({ attempt, exitTo, onPlay }: BrowseProps) {
  const cards = cardItems(attempt)
  const [at, go] = useStep(cards.length)
  const [flipped, setFlipped] = useState(false)
  const look = usePlayLook()
  const sound = useSound()
  const voice = usePlayVoice(attempt.id, attempt.language)
  const card = cards[at]

  useEffect(() => {
    setFlipped(false)
    voice.stop()
  }, [at])

  const flip = () => {
    sound('flip')
    setFlipped((f) => !f)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PlayBackdrop kind={look.backdrop} />
      <PlayHeader title={attempt.title} kind="flashcard" parts={browseParts(cards.length, at)} exitTo={exitTo} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 pt-6 pb-16 md:pt-10">
        {card ? (
          <>
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <Chip tone="mint" className="text-sm">
                Card {at + 1} of {cards.length}
              </Chip>
              <Chip className="text-sm capitalize">{skillLabel(attempt, card.skill)}</Chip>
              {look.readAloud && (
                <ReadAloudButton voice={voice} id={`${card.id}-${flipped ? 'back' : 'front'}`} lines={[{ spoken: { item: card.id, part: flipped ? 'back' : 'front' }, text: flipped ? card.back : card.front }]} />
              )}
            </div>
            <Deck left={cards.length - at - 1}>
              <AnimatePresence mode="wait">
                <Flashcard key={card.id} card={card} flipped={flipped} leaving={null} look={look} onFlip={flip} />
              </AnimatePresence>
            </Deck>
            <div className="mt-5">
              <Button variant="outline" onClick={flip}>
                {flipped ? 'Turn it back' : 'Turn it over'}
              </Button>
            </div>
            <div className="w-full">
              <Steps at={at} total={cards.length} noun="card" onGo={go} />
            </div>
          </>
        ) : (
          <div className="w-full">
            <End count={cards.length} kind="flashcard" exitTo={exitTo} onAgain={() => go(0)} onPlay={onPlay} />
          </div>
        )}
        <BuddySpot />
      </main>
    </div>
  )
}

/** Where the preview is, and the arrow keys to move it. `total` is the end. */
function useStep(total: number): [number, (to: number) => void] {
  const [at, setAt] = useState(0)
  const go = (to: number) => {
    setAt(Math.max(0, Math.min(total, to)))
    window.scrollTo({ top: 0 })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') setAt((i) => Math.min(total, i + 1))
      if (e.key === 'ArrowLeft') setAt((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])
  return [at, go]
}

/** Back and Next, under the question: nothing to answer, just the way on. */
function Steps({ at, total, noun, onGo }: { at: number; total: number; noun: string; onGo: (to: number) => void }) {
  const last = at + 1 >= total
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" onClick={() => onGo(at - 1)} disabled={at === 0}>
        <ArrowLeft weight="bold" className="size-4" aria-hidden /> Back
      </Button>
      <Button variant="sun" size="lg" onClick={() => onGo(at + 1)}>
        {last ? 'Finish' : `Next ${noun}`}
        <ArrowRight weight="bold" className="size-5" aria-hidden />
      </Button>
    </div>
  )
}

function End({ count, kind, exitTo, onAgain, onPlay }: { count: number; kind: string; exitTo: string; onAgain: () => void; onPlay: () => void }) {
  return (
    <div className="rounded-[2rem] border-2 border-border bg-surface p-6 text-center shadow-sm md:p-8">
      <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.bouncy} className="mx-auto grid size-16 place-items-center rounded-3xl bg-correct-soft text-correct">
        <CheckCircle weight="fill" className="size-9" aria-hidden />
      </motion.span>
      <p className="mt-3 font-display text-2xl font-semibold">That's all {nounOf(kind, count)}</p>
      <p className="mt-1 text-muted-foreground">Look through them again, or answer them the way a student will.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onAgain}>
          <ArrowClockwise weight="bold" className="size-4" aria-hidden /> From the start
        </Button>
        <Button variant="sun" onClick={onPlay}>
          <GameController weight="bold" className="size-4" aria-hidden /> Answer it as a student
        </Button>
        <Link to={exitTo} className="inline-flex items-center gap-1.5 px-3 font-bold text-primary hover:underline">
          <ArrowLeft weight="bold" className="size-4" aria-hidden /> Back to editing
        </Link>
      </div>
    </div>
  )
}
