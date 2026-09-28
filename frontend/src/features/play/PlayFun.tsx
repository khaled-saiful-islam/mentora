/**
 * The extras the younger looks add to a game (`level.ts`): shapes drifting
 * behind it, a path of stars for progress, points that pop, a button that
 * reads the words aloud. Each one is only drawn by the look that wants it.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Circle, Diamond, RocketLaunch, Sparkle, SpeakerHigh, SpeakerSlash, Star, Triangle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import type { Line, PlayVoice } from './usePlayVoice'
import type { Segment } from './session'

/** Soft shapes floating slowly behind the game. Decoration only. */
const DRIFTERS = [
  { Icon: Circle, tone: 'text-sky-400/25', left: '6%', top: '18%', size: 'size-16', rise: 18, spin: 0, time: 9 },
  { Icon: Star, tone: 'text-sun-400/35', left: '88%', top: '14%', size: 'size-14', rise: 14, spin: 40, time: 7 },
  { Icon: Triangle, tone: 'text-coral-400/25', left: '12%', top: '72%', size: 'size-20', rise: 22, spin: -30, time: 11 },
  { Icon: Diamond, tone: 'text-mint-400/30', left: '84%', top: '64%', size: 'size-16', rise: 16, spin: 25, time: 8 },
  { Icon: Star, tone: 'text-grape-400/25', left: '48%', top: '88%', size: 'size-10', rise: 12, spin: 60, time: 6 },
  { Icon: Circle, tone: 'text-sun-400/25', left: '70%', top: '36%', size: 'size-8', rise: 10, spin: 0, time: 5 },
] as const

export function PlayBackdrop({ kind }: { kind: 'drift' | 'grid' | 'none' }) {
  if (kind === 'none') return null
  if (kind === 'grid') {
    // Year 4–6: a quiet dotted grid, still — a map to adventure across.
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-background [background-image:radial-gradient(hsl(var(--primary)/0.12)_1.5px,transparent_1.5px)] [background-size:26px_26px]"
      />
    )
  }
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-sky-100/60 via-background to-sun-100/50 dark:from-sky-700/10 dark:to-sun-600/10">
      {DRIFTERS.map((d, i) => (
        <motion.span
          key={i}
          className={cn('absolute', d.tone)}
          style={{ left: d.left, top: d.top }}
          animate={{ y: [0, -d.rise, 0], rotate: [0, d.spin, 0] }}
          transition={{ duration: d.time, repeat: Infinity, ease: 'easeInOut' }}
        >
          <d.Icon weight="fill" className={d.size} />
        </motion.span>
      ))}
    </div>
  )
}

/** Progress as a path of stars: gold for right, grey for wrong, the current
 *  one twinkling. Past this many, the bar is easier to read. */
export const STAR_PATH_MAX = 15

export function ProgressStars({ parts }: { parts: Segment[] }) {
  const done = parts.filter((p) => p !== 'current' && p !== 'todo').length
  return (
    <div className="flex w-full flex-wrap items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={parts.length} aria-valuenow={done}>
      {parts.map((part, i) => (
        <motion.span
          key={i}
          initial={false}
          animate={part === 'current' ? { scale: [1, 1.25, 1], rotate: [0, 12, 0] } : { scale: part === 'correct' ? [1.6, 1] : 1 }}
          transition={part === 'current' ? { duration: 1.4, repeat: Infinity } : spring.bouncy}
          className="grid place-items-center"
        >
          <Star
            weight={part === 'todo' || part === 'current' ? 'duotone' : 'fill'}
            className={cn(
              'size-6 drop-shadow-sm',
              part === 'correct' && 'text-star',
              part === 'wrong' && 'text-foreground/25',
              part === 'answered' && 'text-primary',
              part === 'current' && 'text-star',
              part === 'todo' && 'text-foreground/15',
            )}
          />
        </motion.span>
      ))}
    </div>
  )
}

/** The progress bar with a rocket riding it to the current question. */
export function ProgressJourney({ parts, children }: { parts: Segment[]; children: React.ReactNode }) {
  const at = Math.max(0, parts.findIndex((p) => p === 'current'))
  const done = parts.every((p) => p !== 'current' && p !== 'todo')
  const share = parts.length ? ((done ? parts.length : at) + 0.5) / parts.length : 0
  return (
    <div className="relative pt-1">
      {children}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -top-2.5 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
        initial={false}
        animate={{ left: `${Math.min(100, share * 100)}%`, rotate: [0, -8, 0] }}
        transition={{ left: spring.gentle, rotate: { duration: 1.6, repeat: Infinity } }}
      >
        <RocketLaunch weight="fill" className="size-3.5" />
      </motion.span>
    </div>
  )
}

/** Little stars flying out of a right answer. */
const RAYS = [0, 60, 120, 180, 240, 300]

export function SparkleBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
      {RAYS.map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        return (
          <motion.span
            key={deg}
            className="absolute text-star"
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{ x: Math.cos(rad) * 70, y: Math.sin(rad) * 40, scale: 1, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.8, delay: i * 0.02, ease: 'easeOut' }}
          >
            {i % 2 ? <Star weight="fill" className="size-4" /> : <Sparkle weight="fill" className="size-5" />}
          </motion.span>
        )
      })}
    </span>
  )
}

/** The running score, ticking up as it grows. */
export function PointsChip({ points }: { points: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sun-100 px-3 py-1 font-display text-lg font-semibold text-sun-600 dark:bg-sun-600/25 dark:text-sun-300" aria-label={`${points} points`}>
      <Star weight="fill" className="size-4" aria-hidden />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={points} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={spring.snappy}>
          {points}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** "+10", rising and fading from where it was earned. */
export function PointsBurst({ amount, show }: { amount: number; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -top-2 right-4 font-celebrate text-3xl text-sun-600 drop-shadow dark:text-sun-300"
          initial={{ y: 0, opacity: 0, scale: 0.6 }}
          animate={{ y: -36, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        >
          +{amount}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/** Read these words aloud, in the tutor's voice — for children still
 *  learning to read. */
export function ReadAloudButton({ voice, id, lines, className }: { voice: PlayVoice; id: string; lines: Line[]; className?: string }) {
  if (!voice.supported) return null
  const reading = voice.reading === id
  return (
    <motion.button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        if (reading) voice.stop()
        else voice.read(id, lines)
      }}
      whileTap={{ scale: 0.9 }}
      animate={reading ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={reading ? { duration: 0.9, repeat: Infinity } : spring.snappy}
      aria-pressed={reading}
      className={cn('inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground shadow-press', className)}
    >
      {reading ? <SpeakerSlash weight="fill" className="size-5" aria-hidden /> : <SpeakerHigh weight="fill" className="size-5" aria-hidden />}
      {reading ? 'Stop' : 'Read it to me'}
    </motion.button>
  )
}
