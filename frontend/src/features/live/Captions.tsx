/**
 * What the tutor is saying, word by word, in time with the voice.
 *
 * The clock is the audio clock, read every frame; React only re-renders when
 * the word changes. Words already said stay bright, the word being said is
 * lifted in the session's colour, and what is still to come waits, dimmer —
 * so a student who reads faster than the voice can still read ahead.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { wordAt, wordTimings } from './audio/timing'

export interface Spoken {
  key: string
  text: string
  /** On the audio clock. */
  start: number
  duration: number
  /** Who is speaking: the tutor, or a student's question read back. */
  speaker: 'tutor' | 'student'
  name?: string
}

export function Captions({ line, now, className }: { line: Spoken | null; now: () => number; className?: string }) {
  const calm = useCalmMotion()
  const timings = useMemo(() => (line ? wordTimings(line.text, line.duration) : []), [line])
  const [current, setCurrent] = useState(-1)

  useEffect(() => {
    if (!line) return
    let frame = 0
    const tick = () => {
      setCurrent(wordAt(timings, now() - line.start))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [line, timings, now])

  return (
    <div aria-live="polite" aria-atomic="false" className={cn('min-h-[5.5rem]', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {line && (
          <motion.p
            key={line.key}
            initial={calm ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={calm ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={spring.gentle}
            className="break-words text-center font-display text-xl font-bold leading-relaxed text-white sm:text-2xl"
          >
            {line.speaker === 'student' && (
              <span className="mr-2 rounded-full bg-sun-400 px-2.5 py-0.5 align-middle text-sm font-bold text-grape-900">
                {line.name ?? 'Student'} asks
              </span>
            )}
            {line.text.split(/\s+/).filter(Boolean).map((word, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-md px-0.5 transition-colors duration-150',
                  line.speaker === 'student' || i < current ? 'text-white' : 'text-white/45',
                  i === current && line.speaker === 'tutor' && 'bg-kind-live-vivid text-white shadow-[0_0_18px_hsl(var(--kind-live-vivid)/0.7)]',
                )}
              >
                {word}{' '}
              </span>
            ))}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
