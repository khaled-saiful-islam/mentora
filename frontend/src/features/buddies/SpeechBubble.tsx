import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export type BubbleSide = 'top' | 'right' | 'left' | 'above-left'

const PLACE: Record<BubbleSide, string> = {
  top: 'bottom-[calc(100%-0.5rem)] left-1/2 -translate-x-1/2 origin-bottom',
  right: 'left-[calc(100%-0.75rem)] top-[8%] origin-bottom-left',
  left: 'right-[calc(100%-0.75rem)] top-[8%] origin-bottom-right',
  // Above, reaching left — for a buddy tucked into a bottom-right corner.
  'above-left': 'bottom-[calc(100%-0.25rem)] right-0 origin-bottom-right',
}

const TAIL: Record<BubbleSide, string> = {
  top: 'left-1/2 -bottom-[7px] -translate-x-1/2 rotate-45 border-b-2 border-r-2',
  right: '-left-[7px] bottom-4 rotate-45 border-b-2 border-l-2',
  left: '-right-[7px] bottom-4 rotate-45 border-t-2 border-r-2',
  'above-left': 'right-10 -bottom-[7px] rotate-45 border-b-2 border-r-2',
}

/** What a buddy says: a bubble that pops out of them, words landing one
 *  at a time as if spoken. */
export function SpeechBubble({ text, side = 'top', className }: { text: string; side?: BubbleSide; className?: string }) {
  const words = text.split(/\s+/)
  return (
    <motion.div
      key={text}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.6, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 4, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 22 }}
      className={cn(
        'pointer-events-none absolute z-20 w-max max-w-[15rem] rounded-2xl border-2 border-border bg-surface px-4 py-2.5',
        'font-display text-base leading-snug font-medium text-surface-foreground shadow-lg',
        PLACE[side],
        className,
      )}
    >
      <motion.span
        className="relative z-10 block"
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } } }}
      >
        {words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className="inline-block"
            variants={{ hidden: { opacity: 0, y: 6, scale: 0.8 }, shown: { opacity: 1, y: 0, scale: 1 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
          >
            {word}
            {i < words.length - 1 && ' '}
          </motion.span>
        ))}
      </motion.span>
      <span aria-hidden className={cn('absolute size-3 border-border bg-surface', TAIL[side])} />
    </motion.div>
  )
}
