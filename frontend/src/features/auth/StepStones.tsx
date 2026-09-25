import { motion } from 'motion/react'
import { Check, type Icon } from '@phosphor-icons/react'
import { Buddy } from '@/features/buddies'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'

export interface Stone {
  label: string
  Icon: Icon
}

/**
 * Sign-up progress as stepping stones across a stream, with Kiko hopping
 * from one to the next. Done stones turn green and show a tick.
 */
export function StepStones({ stones, index }: { stones: readonly Stone[]; index: number }) {
  const calm = useCalmMotion()
  const across = `${((index + 0.5) / stones.length) * 100}%`

  return (
    <div
      className="relative pt-16"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stones.length}
      aria-valuenow={index + 1}
      aria-valuetext={`Step ${index + 1} of ${stones.length}: ${stones[index]?.label ?? ''}`}
      aria-label="Sign-up progress"
    >
      <motion.div
        aria-hidden
        className="absolute top-0 -translate-x-1/2"
        initial={false}
        animate={{ left: across }}
        transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 16 }}
      >
        <motion.div
          key={index}
          initial={false}
          animate={calm ? { y: 0 } : { y: [0, -26, 0], scaleY: [1, 1.08, 0.9, 1] }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <Buddy buddy="kiko" size={62} interactive={false} mood={index === stones.length - 1 ? 'happy' : 'idle'} />
        </motion.div>
      </motion.div>

      {/* The stream the stones cross. */}
      <span aria-hidden className="absolute inset-x-[12%] top-[5.25rem] h-1.5 rounded-full bg-sky-100 dark:bg-sky-700/40" />
      <motion.span
        aria-hidden
        className="absolute left-[12%] top-[5.25rem] h-1.5 rounded-full bg-gradient-to-r from-mint-400 to-sky-400"
        initial={false}
        animate={{ width: `${(index / Math.max(1, stones.length - 1)) * 76}%` }}
        transition={spring.gentle}
      />

      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${stones.length}, minmax(0, 1fr))` }}>
        {stones.map(({ label, Icon }, i) => {
          const done = i < index
          const here = i === index
          return (
            <li key={label} className="flex flex-col items-center gap-1.5">
              <motion.span
                className={cn(
                  'grid size-11 place-items-center rounded-full border-2 transition-colors',
                  done && 'border-mint-400 bg-mint-400 text-white',
                  here && 'border-primary bg-primary text-primary-foreground shadow-press',
                  !done && !here && 'border-border bg-surface text-muted-foreground',
                )}
                animate={here && !calm ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={spring.bouncy}
              >
                {done ? <Check weight="bold" className="size-5" /> : <Icon weight="bold" className="size-5" />}
              </motion.span>
              <span className={cn('text-xs font-bold', here ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
