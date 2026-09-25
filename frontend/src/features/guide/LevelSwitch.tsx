import { motion } from 'motion/react'
import { Plant, RocketLaunch, Target, type Icon } from '@phosphor-icons/react'
import type { ReadingLevel } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'

export const LEVEL_LOOKS: Record<ReadingLevel, { label: string; Icon: Icon; hint: string }> = {
  simple: { label: 'Simpler', Icon: Plant, hint: 'Shorter sentences, everyday words' },
  core: { label: 'Just right', Icon: Target, hint: 'Written for your year' },
  stretch: { label: 'Challenge', Icon: RocketLaunch, hint: 'Goes a little deeper' },
}

const ORDER: ReadingLevel[] = ['simple', 'core', 'stretch']

/**
 * How to read: Simpler, Just right or Challenge. The same ideas each time —
 * only the words change, so nobody is reading a different lesson.
 */
export function LevelSwitch({
  value,
  onChange,
  size = 'md',
  block = false,
  className,
}: {
  value: ReadingLevel
  onChange: (level: ReadingLevel) => void
  size?: 'md' | 'lg'
  /** Three equal tiles, icon over word, filling the width. */
  block?: boolean
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Reading level"
      className={cn(block ? 'grid w-full grid-cols-3 gap-1 rounded-[1.25rem]' : 'inline-flex rounded-full', 'border-2 border-border bg-surface p-1', className)}
    >
      {ORDER.map((level) => {
        const { label, Icon, hint } = LEVEL_LOOKS[level]
        const on = level === value
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={on}
            title={hint}
            onClick={() => onChange(level)}
            className={cn(
              'relative flex items-center gap-1.5 font-bold transition-colors',
              block ? 'justify-center rounded-2xl px-2 py-2.5 text-sm' : 'rounded-full',
              !block && (size === 'lg' ? 'px-4 py-2.5 text-base' : 'px-3 py-1.5 text-sm'),
              on ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId={`level-${block ? 'block' : size}`}
                transition={spring.snappy}
                className={cn('absolute inset-0 bg-gradient-to-br from-kind-study-guide-vivid to-kind-study-guide', block ? 'rounded-2xl' : 'rounded-full')}
                aria-hidden
              />
            )}
            <span className={cn('relative flex items-center gap-1.5', block && 'flex-col gap-1')}>
              <Icon weight={on ? 'fill' : 'bold'} className={size === 'lg' ? 'size-5' : 'size-4'} aria-hidden />
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
