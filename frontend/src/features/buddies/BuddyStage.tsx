import { motion } from 'motion/react'
import { useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'
import { profileOf } from './profiles'

// Soft shapes drifting behind a buddy: [left %, top %, size rem, seconds].
const FLOATERS = [
  [8, 18, 3.5, 9],
  [78, 12, 2.2, 7],
  [88, 58, 3, 11],
  [16, 70, 1.6, 8],
  [52, 8, 1.2, 6],
] as const

/** Where a buddy stands: a glow in their colour, a few drifting shapes, and
 *  a floor. Everything the buddy's colour touches comes from the theme. */
export function BuddyStage({
  buddy,
  className,
  children,
}: {
  buddy: string | null | undefined
  className?: string
  children: React.ReactNode
}) {
  const key = profileOf(buddy).key
  const calm = useCalmMotion()
  const tone = (alpha: number) => `hsl(var(--buddy-${key}) / ${alpha})`
  return (
    <div
      className={cn('relative isolate overflow-hidden rounded-[2rem]', className)}
      style={{
        background: `radial-gradient(90% 70% at 50% 105%, ${tone(0.34)}, transparent 70%), linear-gradient(180deg, ${tone(0.1)}, ${tone(0.03)})`,
      }}
    >
      {FLOATERS.map(([left, top, size, seconds], i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute -z-10 rounded-full"
          style={{ left: `${left}%`, top: `${top}%`, width: `${size}rem`, height: `${size}rem`, background: tone(0.14) }}
          animate={calm ? undefined : { y: [0, -14, 0], x: [0, i % 2 ? 8 : -8, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: seconds, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {children}
    </div>
  )
}
