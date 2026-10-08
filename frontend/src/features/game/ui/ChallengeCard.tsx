/**
 * A challenge, as it is asked: the question on a card over the world, a
 * button that reads it aloud, and the buddy's hint — asked for, at a small
 * cost, never shown ahead. The style (`../styles`) brings the options.
 */
import { motion } from 'motion/react'
import { Crown, Lightbulb, SpeakerHigh, Stop } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { usePlayLook } from '@/features/play/level'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { POINTS } from '../points'

export interface ChallengeCardProps {
  prompt: string
  /** "Challenge 2 of 3", or the boss's own line. */
  label: string
  boss: boolean
  hint: string | null
  canHint: boolean
  buddyName: string
  onHint: () => void
  reading: boolean
  readable: boolean
  onRead: () => void
  /** The timer, when the game is timed. */
  timer?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function ChallengeCard(props: ChallengeCardProps) {
  const { prompt, label, boss, hint, canHint, buddyName, onHint, reading, readable, onRead, timer, className, children } = props
  const look = usePlayLook()
  return (
    <motion.section
      key={prompt}
      initial={{ opacity: 0, y: -18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.bouncy}
      className={cn(
        'relative w-full rounded-3xl border-4 bg-surface/95 p-4 shadow-lg backdrop-blur-sm sm:p-6',
        boss ? 'border-star' : 'border-surface',
        className,
      )}
      aria-labelledby="challenge-prompt"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('inline-flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide', boss ? 'text-warning' : 'text-primary')}>
          {boss && <Crown weight="fill" className="size-5" />}
          {label}
        </p>
        <div className="flex items-center gap-2">
          {readable && (
            <Button variant="ghost" size="sm" onClick={onRead} aria-pressed={reading}>
              {reading ? <Stop weight="fill" className="size-4" /> : <SpeakerHigh weight="bold" className="size-4" />}
              {/* On a phone the speaker alone, so the card keeps to one header row. */}
              <span className="max-sm:sr-only">{reading ? 'Stop' : 'Read it to me'}</span>
            </Button>
          )}
          {timer}
        </div>
      </div>
      <h2 id="challenge-prompt" className={cn('mt-2 break-words font-display font-semibold [overflow-wrap:anywhere]', look.question)}>
        {prompt}
      </h2>
      {hint ? (
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-start gap-2 rounded-2xl bg-star-soft px-3 py-2 text-base font-semibold text-foreground">
          <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" />
          <span className="min-w-0 break-words">
            {buddyName} says: {hint}
          </span>
        </motion.p>
      ) : (
        canHint && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onHint}>
            <Lightbulb weight="bold" className="size-4 text-warning" />
            Ask {buddyName} for a hint
            <span className="text-xs font-bold text-muted-foreground">−{POINTS.hint}</span>
          </Button>
        )
      )}
      {children}
    </motion.section>
  )
}

/** One option's words, wrapped rather than cut however long they run. */
export function OptionText({ text, className }: { text: string; className?: string }) {
  return <span className={cn('min-w-0 hyphens-auto break-words text-balance', className)}>{text}</span>
}

/** A line of help over the world: always on its own pill, never bare on the scene. */
export function Aside({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('mx-auto w-fit max-w-full break-words rounded-full bg-surface/95 px-4 py-1.5 text-center font-semibold text-foreground shadow', className)}>{children}</p>
}
