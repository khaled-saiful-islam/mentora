/**
 * Explain why (§28.3.5, Form 1–5). After a right answer, sometimes: "Tell
 * me why." The student says it or types it; a model reads their reasoning
 * against the question's own explanation and answers in one line. Their
 * words pass the student safety screens first. A few a day.
 */
import { motion } from 'motion/react'
import { ArrowRight, ChatCircleDots, Check, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Alert, Button } from '@/components/ui'
import { trapTab } from '@/components/ui/Dialog'
import { errorMessage } from '@/features/auth/errors'
import { useCoversScreen } from '@/features/celebrate/Scene'
import { VoiceInput } from '@/features/voice/VoiceInput'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { useAuth } from '@/lib/auth'
import type { Attempt, Played, QuizItem } from './api'
import { usePlayBackend, type WhyJudged } from './backend'

const VERDICT: Record<NonNullable<WhyJudged['verdict']>, { label: string; tone: string }> = {
  spot_on: { label: 'Spot on!', tone: 'bg-correct-soft border-correct' },
  nearly: { label: 'Nearly there!', tone: 'bg-sun-100 border-sun-400 dark:bg-sun-600/20' },
  not_yet: { label: 'Not quite yet', tone: 'bg-muted border-border' },
}

/**
 * Whether to ask "Tell me why" now: for Form 1–5, in a quiz with a second
 * chance (not a teacher's test), on every third right answer from the
 * second, while some are left today.
 */
export function useWhy(attempt: Attempt, played: Record<string, Played>) {
  const backend = usePlayBackend()
  const { user } = useAuth()
  const form = (user?.grade_level ?? '').startsWith('form_')
  const [left, setLeft] = useState(0)
  const able = form && Boolean(attempt.second_chance) && Boolean(backend.whyLeft && backend.explainWhy)

  useEffect(() => {
    if (!able || !backend.whyLeft) return
    let live = true
    backend.whyLeft().then(
      (n) => live && setLeft(n),
      () => live && setLeft(0),
    )
    return () => {
      live = false
    }
  }, [able, backend])

  const rights = Object.values(played).filter((p) => p.correct === true).length
  const used = useCallback(() => setLeft((n) => Math.max(0, n - 1)), [])
  return {
    offer: (answer: Played) => able && left > 0 && answer.correct === true && rights % 3 === 2,
    used,
    judge: (itemId: string, words: string) => backend.explainWhy!(attempt.id, itemId, words),
  }
}

export function ExplainWhy({
  item,
  answerText,
  last,
  judge,
  onJudged,
  onClose,
  onNext,
}: {
  item: QuizItem
  answerText: string | null
  last: boolean
  judge: (words: string) => Promise<WhyJudged>
  /** A verdict came back: one fewer left today. */
  onJudged: () => void
  onClose: () => void
  onNext: () => void
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [words, setWords] = useState('')
  const [busy, setBusy] = useState(false)
  const [judged, setJudged] = useState<WhyJudged | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useCoversScreen()

  useEffect(() => {
    const returnTo = document.activeElement
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') trapTab(event, panel.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus()
    }
  }, [onClose])

  async function send() {
    if (words.trim().length < 2 || busy) return
    setBusy(true)
    setProblem(null)
    try {
      const found = await judge(words.trim())
      setJudged(found)
      if (found.verdict) onJudged()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div className="absolute inset-0 bg-grape-900/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} aria-hidden />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: spring.gentle }}
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-y-auto rounded-t-[2rem] border-t-4 border-primary bg-surface p-5 shadow-lg sm:rounded-[2rem] sm:border-4"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
            <ChatCircleDots weight="fill" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-2xl leading-tight font-semibold">
              Tell me why
            </h2>
            <p className="text-sm text-muted-foreground">You got it right. Why is it right? Say it or type it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Back to the quiz" className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground">
            <X weight="bold" className="size-5" />
          </button>
        </div>
        <div className="mt-4 rounded-2xl bg-muted/40 p-3">
          <p className="break-words font-bold">{item.prompt}</p>
          {answerText && (
            <p className="mt-1 flex items-start gap-1.5 break-words">
              <Check weight="bold" className="mt-1 size-4 shrink-0 text-correct" aria-hidden />
              {answerText}
            </p>
          )}
        </div>
        {judged ? (
          <Verdict judged={judged} />
        ) : (
          <div className="mt-4 space-y-3">
            <VoiceInput id="why-words" label="Why it is right" value={words} onChange={setWords} multiline maxLength={600} placeholder="Because…" autoFocus />
            {problem && <Alert>{problem}</Alert>}
            <Button onClick={() => void send()} loading={busy} disabled={words.trim().length < 2}>
              Check my thinking
            </Button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {judged ? 'Back' : 'Skip'}
          </Button>
          {judged && (
            <Button variant="sun" onClick={onNext}>
              {last ? 'See my score' : 'Next question'}
              <ArrowRight weight="bold" className="size-5" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function Verdict({ judged }: { judged: WhyJudged }) {
  const look = judged.verdict ? VERDICT[judged.verdict] : null
  return (
    <motion.div role="status" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className={cn('mt-4 rounded-2xl border-2 p-4', look?.tone ?? 'border-border bg-muted/40')}>
      {look && <p className="font-display text-xl font-semibold">{look.label}</p>}
      <p className="mt-1 break-words">{judged.feedback}</p>
    </motion.div>
  )
}
