/**
 * An option as a big tile: its number for the keyboard, its words wrapped
 * however long they are, and what it turned out to be once answered.
 */
import { motion } from 'motion/react'
import { Check, X } from '@phosphor-icons/react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { press, wobble } from '@/motion'
import { OptionText } from '../ui/ChallengeCard'
import type { OptionState } from './types'

const STATES: Record<OptionState, string> = {
  idle: 'border-surface bg-surface hover:border-primary',
  right: 'border-correct bg-correct-soft',
  wrong: 'border-wrong bg-wrong-soft',
  faded: 'border-surface bg-surface opacity-60',
}

interface OptionTileProps {
  n: number
  text: string
  state: OptionState
  disabled: boolean
  calm: boolean
  onChoose: () => void
  className?: string
}

export const OptionTile = forwardRef<HTMLButtonElement, OptionTileProps>(function OptionTile({ n, text, state, disabled, calm, onChoose, className }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onChoose}
      disabled={disabled}
      aria-label={`Option ${n + 1}: ${text}`}
      {...(disabled || calm ? {} : press)}
      animate={state === 'wrong' && !calm ? wobble : undefined}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-2xl border-4 px-4 py-3 text-left font-display text-lg font-semibold shadow-press transition-colors disabled:cursor-default sm:text-xl',
        STATES[state],
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
        {state === 'right' ? <Check weight="bold" className="size-5" /> : state === 'wrong' ? <X weight="bold" className="size-5" /> : n + 1}
      </span>
      <OptionText text={text} />
    </motion.button>
  )
})
