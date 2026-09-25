/**
 * The frame around a game: the way out, how far along you are, your streak
 * and the text size. The same for every kind, so each player draws only its
 * own middle.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Fire, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { TextSizeControl } from '@/components/ui/TextSizeControl'
import { lookOfKind } from '@/features/learning/kinds'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import type { PlayKind } from './api'
import type { Segment } from './session'

const SEGMENT: Record<Segment, string> = {
  correct: 'bg-correct',
  wrong: 'bg-wrong',
  answered: 'bg-primary',
  current: 'bg-foreground/25',
  todo: 'bg-foreground/10',
}

export function ProgressSegments({ parts }: { parts: Segment[] }) {
  return (
    <div className="flex w-full items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={parts.length} aria-valuenow={parts.filter((p) => p !== 'current' && p !== 'todo').length}>
      {parts.map((part, i) => (
        <span key={i} className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <motion.span
            className={cn('absolute inset-0 rounded-full', SEGMENT[part])}
            initial={false}
            animate={{ scaleX: part === 'todo' ? 0 : 1, opacity: part === 'current' ? [0.5, 1, 0.5] : 1 }}
            transition={part === 'current' ? { opacity: { duration: 1.4, repeat: Infinity }, scaleX: spring.gentle } : spring.bouncy}
            style={{ originX: 0 }}
          />
        </span>
      ))}
    </div>
  )
}

/** The streak flame: grows with each right answer in a row, and flares on
 *  every third. */
export function StreakFlame({ streak }: { streak: number }) {
  const hot = streak >= 3
  return (
    <AnimatePresence>
      {streak >= 2 && (
        <motion.span
          key="flame"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0 }}
          transition={spring.bouncy}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1 font-display text-lg font-semibold',
            hot ? 'bg-kind-quiz-vivid text-white shadow-lg' : 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300',
          )}
          aria-label={`${streak} in a row`}
        >
          <motion.span
            key={streak}
            initial={{ scale: 1.8, y: -4 }}
            animate={{ scale: [1, 1.15, 1], y: 0 }}
            transition={{ scale: { duration: 0.6, repeat: hot ? Infinity : 0, repeatDelay: 0.3 } }}
          >
            <Fire weight="fill" className="size-5" />
          </motion.span>
          <motion.span key={`n-${streak}`} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {streak}
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export function PlayHeader({
  title,
  kind,
  parts,
  streak = 0,
  exitTo,
}: {
  title: string
  kind: PlayKind
  parts: Segment[]
  streak?: number
  exitTo: string
}) {
  const look = lookOfKind(kind)
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
        <Link
          to={exitTo}
          aria-label="Leave — your answers are saved"
          title="Leave — your answers are saved"
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <X weight="bold" className="size-5" />
        </Link>
        <span className={cn('hidden size-9 shrink-0 place-items-center rounded-xl sm:grid', look.hero)} aria-hidden>
          <look.Icon weight="fill" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold leading-tight">{title}</p>
          <div className="mt-1.5">
            <ProgressSegments parts={parts} />
          </div>
        </div>
        <StreakFlame streak={streak} />
        <TextSizeControl compact className="shrink-0" />
      </div>
    </header>
  )
}
