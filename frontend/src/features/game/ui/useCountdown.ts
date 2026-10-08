/**
 * A challenge's timer: how much of it is left, 1 → 0, and a call when it
 * runs out. Paused while `running` is false (an answer is being sent, the
 * reveal is up). No timer at all for beginners: `seconds` is null.
 */
import { useEffect, useRef, useState } from 'react'

export function useCountdown(seconds: number | null, running: boolean, key: string, onDone: () => void, onTick?: (left: number) => void): number {
  const [left, setLeft] = useState(1)
  const done = useRef(onDone)
  const tick = useRef(onTick)
  done.current = onDone
  tick.current = onTick
  const spent = useRef(0)

  // A new challenge starts a full timer.
  useEffect(() => {
    spent.current = 0
    setLeft(1)
  }, [key])

  useEffect(() => {
    if (!seconds || !running) return
    let last = performance.now()
    let lastWhole = Math.ceil(seconds - spent.current / 1000)
    let frame = 0
    const step = (now: number) => {
      spent.current += now - last
      last = now
      const remaining = Math.max(0, 1 - spent.current / (seconds * 1000))
      setLeft(remaining)
      const whole = Math.ceil(remaining * seconds)
      if (whole !== lastWhole) {
        lastWhole = whole
        tick.current?.(whole)
      }
      if (remaining <= 0) done.current()
      else frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [seconds, running, key])

  return seconds ? left : 1
}
