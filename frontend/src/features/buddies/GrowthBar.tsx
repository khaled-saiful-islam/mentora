/**
 * How far a buddy is from its next stage (§28.3.1): a bar that fills in its
 * buddy's colour, and the words for it — "34 of 60 to Young".
 */
import { motion } from 'motion/react'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import { GROWN, STAGE_AT, STAGE_NAMES, stageFor, type Stage } from './growth'
import type { BuddyKey } from './types'

export function GrowthBar({
  buddy,
  points,
  within,
  className,
}: {
  buddy: BuddyKey
  points: number
  /** Measure against this stage even past it: a bar filling to the brim as
   *  the buddy grows up, rather than starting the next one empty. */
  within?: Stage
  className?: string
}) {
  const stage = within ?? stageFor(points)
  const grown = stage === GROWN
  const from = STAGE_AT[stage]
  const to = grown ? from : STAGE_AT[(stage + 1) as 1 | 2 | 3]
  const share = grown ? 1 : Math.max(0, Math.min(1, (points - from) / (to - from)))
  const ready = !grown && points >= to
  return (
    <div className={cn('w-full', className)}>
      <div
        className="h-3.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={Math.min(points, to)}
        aria-label={grown ? 'Fully grown' : `Growth to ${STAGE_NAMES[(stage + 1) as 1 | 2 | 3]}`}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: `hsl(var(--buddy-${buddy}))` }}
          initial={false}
          animate={{ width: `${Math.max(4, share * 100)}%` }}
          transition={spring.gentle}
        />
      </div>
      <p className="mt-1.5 text-sm font-bold text-muted-foreground">
        {grown ? 'Fully grown!' : ready ? 'Ready to grow up!' : `${points} of ${to} growth to ${STAGE_NAMES[(stage + 1) as 1 | 2 | 3]}`}
      </p>
    </div>
  )
}
