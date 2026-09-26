/**
 * Where a live lesson happens: a night sky in the session's Galaxy colours,
 * Astra teaching in it, what matters written up beside it as it is said, and
 * the words underneath in time with the voice. A row of stars along the top
 * lights up part by part.
 */
import { HandWaving, Sparkle } from '@phosphor-icons/react'
import { AnimatePresence, motion, type MotionValue } from 'motion/react'
import { useMemo } from 'react'
import { starField } from '@/features/auth/scene/sky'
import type { Mood } from '@/features/buddies/types'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { Captions, type Spoken } from './Captions'
import { TUTOR_NAME, TutorAvatar } from './TutorAvatar'

const STARS = starField(46, 19, 96)

export interface StageProps {
  beats: number
  beat: number
  show: string | null
  line: Spoken | null
  now: () => number
  speaking: boolean
  level: MotionValue<number>
  mood: Mood
  /** A note over the stage: who has their hand up, what is happening. */
  status?: React.ReactNode
  hand?: string | null
  /** Leave out the caption strip, when nothing more will be said. */
  quiet?: boolean
  className?: string
  children?: React.ReactNode
}

export function LiveStage({ beats, beat, show, line, now, speaking, level, mood, status, hand, quiet, className, children }: StageProps) {
  const calm = useCalmMotion()
  const stars = useMemo(() => STARS, [])
  return (
    <section
      aria-label={`${TUTOR_NAME}'s lesson`}
      className={cn(
        'relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-b from-grape-900 via-grape-800 to-[hsl(var(--kind-live))] p-4 text-white shadow-xl sm:p-6',
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {stars.map((star, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size }}
            animate={calm ? { opacity: 0.6 } : { opacity: [0.2, 0.9, 0.2] }}
            transition={calm ? { duration: 0 } : { duration: star.period, delay: star.delay, repeat: Infinity }}
          />
        ))}
        <span className="blob -right-24 -top-24 size-[22rem] bg-kind-live-vivid opacity-40" />
        <span className="blob -bottom-28 -left-20 size-[20rem] bg-sky-400 opacity-25 [animation-delay:-8s]" />
      </div>

      <Progress beats={beats} beat={beat} />

      <div className="mt-4 grid items-center gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="relative mx-auto">
          <TutorAvatar mood={mood} speaking={speaking} level={level} size={190} />
          <AnimatePresence>
            {hand && (
              <motion.span
                key={hand}
                initial={{ opacity: 0, scale: 0.4, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={spring.bouncy}
                className="absolute -right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-sun-400 px-3 py-1 text-sm font-bold text-grape-900 shadow-lg"
              >
                <motion.span
                  className="inline-flex"
                  animate={calm ? undefined : { rotate: [0, 18, -10, 18, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
                  style={{ originX: 0.7, originY: 0.9 }}
                >
                  <HandWaving weight="fill" className="size-4" aria-hidden />
                </motion.span>
                {hand}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="min-h-[9rem] min-w-0">
          <AnimatePresence mode="wait">
            {show ? (
              <motion.div
                key={show}
                initial={calm ? { opacity: 0 } : { opacity: 0, y: 16, rotate: -1.5, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                exit={calm ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.97 }}
                transition={spring.gentle}
                className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-lg backdrop-blur-md"
              >
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sun-300">
                  <Sparkle weight="fill" className="size-3.5" aria-hidden />
                  Key idea
                </p>
                <p className="break-words font-display text-2xl font-bold leading-snug sm:text-3xl">{show}</p>
              </motion.div>
            ) : (
              status && (
                <motion.div
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="break-words rounded-3xl border border-white/15 bg-white/5 p-5 text-lg font-semibold text-white/85"
                >
                  {status}
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {!quiet && (
        <div className="mt-4 rounded-3xl bg-black/25 px-4 py-4 backdrop-blur-sm sm:px-6">
          <Captions line={line} now={now} />
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </section>
  )
}

function Progress({ beats, beat }: { beats: number; beat: number }) {
  if (beats === 0) return null
  return (
    <ol aria-label={`Part ${Math.max(1, beat + 1)} of ${beats}`} className="flex flex-wrap items-center justify-center gap-1.5">
      {Array.from({ length: beats }, (_, i) => (
        <li key={i} aria-hidden>
          <motion.span
            className={cn(
              'block size-2.5 rounded-full',
              i < beat ? 'bg-sun-400' : i === beat ? 'bg-white shadow-[0_0_12px_white]' : 'bg-white/25',
            )}
            animate={{ scale: i === beat ? 1.5 : 1 }}
            transition={spring.bouncy}
          />
        </li>
      ))}
    </ol>
  )
}
