import { motion } from 'motion/react'
import { Sparkle } from '@phosphor-icons/react'
import { pop, stagger } from '@/motion'

/**
 * Follow-up ideas under the last answer, landing one after another.
 *
 * Shown only on the most recent message: ideas under an old answer are stale
 * by definition, and a column full of them is noise.
 */
export function Suggestions({
  items,
  onPick,
  disabled,
}: {
  items: string[]
  onPick: (text: string) => void
  disabled?: boolean
}) {
  if (items.length === 0) return null

  return (
    <motion.div className="mt-4 flex flex-wrap gap-2" variants={stagger(0.08, 0.15)} initial="hidden" animate="shown">
      {items.map((item) => (
        <motion.button
          key={item}
          type="button"
          variants={pop}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          disabled={disabled}
          onClick={() => onPick(item)}
          className="group/chip inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-surface px-3.5 py-1.5 text-sm font-bold text-foreground/80 transition-colors hover:border-hover-border hover:bg-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <Sparkle weight="fill" className="size-3.5 shrink-0 text-star transition-transform group-hover/chip:rotate-45" aria-hidden />
          {item}
        </motion.button>
      ))}
    </motion.div>
  )
}
