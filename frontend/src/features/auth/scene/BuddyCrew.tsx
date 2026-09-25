import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Buddy, BUDDY_KEYS, pick, type BuddyKey, type Mood } from '@/features/buddies'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { useCrew, type Reaction } from './crew'

const MOOD: Record<Reaction, Mood> = {
  idle: 'idle',
  watch: 'listen',
  shy: 'shy',
  peek: 'peek',
}

/** Lifted off the ground by how high the hill is under each of them. */
const LIFT = [6, 22, 30, 20, 4]

/** Each takes the new mood a beat after the one before, so it ripples. */
const RIPPLE_MS = 70

/** What one of them says when the page asks them to look away, or they peek. */
const LINES: Partial<Record<Reaction, readonly string[]>> = {
  shy: ['No peeking — promise!', "Eyes closed! Type away.", "We're not looking!", 'La la la, not looking!'],
  peek: ['Oops… I can see it!', 'Just a tiny peek!', 'Hehe. I saw nothing. Maybe.'],
}
/** Not every time the field is tabbed through: once in a while is funny. */
const QUIET_MS = 6000

/**
 * All five buddies on the hill, eyes on the pointer, doing what the page
 * asks. Tapping one still makes them talk.
 */
export function BuddyCrew({ className, greeting }: { className?: string; greeting?: string }) {
  const { reaction, say } = useCrew()
  const wide = useMediaQuery('(min-width: 1024px)')
  const size = wide ? 118 : 66
  const lastLine = useRef(0)

  useEffect(() => {
    const lines = LINES[reaction]
    if (!lines || Date.now() - lastLine.current < QUIET_MS) return
    lastLine.current = Date.now()
    say(pick(lines), Math.floor(Math.random() * BUDDY_KEYS.length))
  }, [reaction, say])

  // One hello, after they have landed.
  useEffect(() => {
    if (!greeting) return
    const at = window.setTimeout(() => say(greeting), 1300)
    return () => window.clearTimeout(at)
  }, [greeting, say])

  return (
    <div className={cn('flex items-end justify-center gap-0.5 sm:gap-2 lg:gap-4', className)}>
      {BUDDY_KEYS.map((key, index) => (
        <Member key={key} buddy={key} index={index} size={size} mood={MOOD[reaction]} />
      ))}
    </div>
  )
}

function Member({ buddy, index, size, mood }: { buddy: BuddyKey; index: number; size: number; mood: Mood }) {
  const { register } = useCrew()
  const calm = useCalmMotion()
  const [shown, setShown] = useState(mood)

  useEffect(() => {
    if (calm) {
      setShown(mood)
      return
    }
    const at = window.setTimeout(() => setShown(mood), index * RIPPLE_MS)
    return () => window.clearTimeout(at)
  }, [mood, index, calm])

  return (
    <motion.div
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring.bouncy, delay: 0.25 + index * 0.1 }}
      style={{ marginBottom: (LIFT[index] ?? 0) * (size / 118) }}
    >
      <Buddy ref={(handle) => register(index, handle)} buddy={buddy} mood={shown} size={size} bubble="top" />
    </motion.div>
  )
}
