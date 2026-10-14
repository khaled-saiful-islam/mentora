/**
 * Words that light up as they are spoken (§28.3.2): while the narrator says a
 * line, each word brightens as it is heard and the word being said now is
 * marked, so listening teaches reading too. The voice gives no timings, so
 * they are estimated as live lessons estimate their captions (`wordTimings`).
 *
 * A line is matched by its words: the narrator is given exactly the text the
 * card shows, so nothing has to carry an id from one to the other.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Now } from '@/features/play/usePlayVoice'
import { wordTimings } from '@/features/live/audio/timing'
import { cn } from '@/lib/utils'

export const NarrationContext = createContext<Now | null>(null)

export function Said({ text }: { text: string }) {
  const now = useContext(NarrationContext)
  const live = now !== null && now.text.trim() === text.trim()
  const timings = useMemo(() => (live && now ? wordTimings(text, now.duration / 1000) : []), [live, now, text])
  const [at, setAt] = useState(-1)
  const here = useRef<HTMLSpanElement>(null)

  // A long card can have the line being said scrolled out of sight: bring it
  // into view as it starts.
  useEffect(() => {
    if (live) here.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [live])

  useEffect(() => {
    if (!live || !now) {
      setAt(-1)
      return
    }
    let frame = 0
    const tick = () => {
      const heard = (performance.now() - now.start) / 1000
      let index = -1
      for (let i = 0; i < timings.length; i++) if (timings[i].start <= heard) index = i
      setAt(index)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [live, now, timings])

  if (!live) return <>{text}</>
  let word = -1
  return (
    <span ref={here}>
      {text.split(/(\s+)/).map((part, n) => {
        if (!part.trim()) return part
        word += 1
        return (
          <span
            key={n}
            className={cn('rounded-md transition-colors duration-150', word === at ? 'bg-star-soft' : word > at && 'opacity-60')}
          >
            {part}
          </span>
        )
      })}
    </span>
  )
}
