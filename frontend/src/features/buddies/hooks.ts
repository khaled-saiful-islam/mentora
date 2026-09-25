/**
 * What keeps a buddy alive between reactions: it blinks, its eyes follow
 * the pointer (or wander when there is none), it fidgets when nothing is
 * happening, and it nods off if left alone long enough.
 */
import { useMotionValue, useSpring } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { HOLD_MS } from './choreography'
import type { Gaze, Mood } from './types'

const between = (low: number, high: number) => low + Math.random() * (high - low)
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

// --- blinking --------------------------------------------------------------

/** A blink every few seconds, sometimes a double one, never in step with
 *  another buddy on the same screen. */
export function useBlink(active: boolean): boolean {
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    if (!active) return
    let timer: number
    const schedule = (wait: number) => {
      timer = window.setTimeout(() => {
        setClosed(true)
        timer = window.setTimeout(() => {
          setClosed(false)
          schedule(Math.random() < 0.2 ? 180 : between(2200, 5600))
        }, 110)
      }, wait)
    }
    schedule(between(600, 3000))
    return () => window.clearTimeout(timer)
  }, [active])
  return active && closed
}

// --- the pointer, shared by every buddy -----------------------------------

type Listener = () => void
const listeners = new Set<Listener>()
const pointer = { x: 0, y: 0, at: 0 }
let frame = 0

function onPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  pointer.x = event.clientX
  pointer.y = event.clientY
  pointer.at = performance.now()
  if (!frame) {
    frame = requestAnimationFrame(() => {
      frame = 0
      listeners.forEach((listener) => listener())
    })
  }
}

/** One window listener however many buddies are watching, and none once
 *  the last one leaves. */
function watchPointer(listener: Listener): () => void {
  if (listeners.size === 0) window.addEventListener('pointermove', onPointerMove, { passive: true })
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('pointermove', onPointerMove)
  }
}

const IDLE_POINTER_MS = 2500

/**
 * Where the eyes point. They follow the pointer across the page; with no
 * pointer about (a phone, or a still mouse) they glance around by
 * themselves. A mood can fix the gaze — up and away while thinking.
 */
export function useGaze(
  target: React.RefObject<Element | null>,
  { track, fixed }: { track: boolean; fixed?: { x: number; y: number } | null },
): Gaze {
  const tx = useMotionValue(0)
  const ty = useMotionValue(0)
  const x = useSpring(tx, { stiffness: 170, damping: 17 })
  const y = useSpring(ty, { stiffness: 170, damping: 17 })
  const fixedX = fixed?.x
  const fixedY = fixed?.y

  useEffect(() => {
    if (fixedX !== undefined && fixedY !== undefined) {
      tx.set(fixedX)
      ty.set(fixedY)
      return
    }
    if (!track) {
      tx.set(0)
      ty.set(0)
      return
    }
    const follow = () => {
      const el = target.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const reach = Math.max(160, box.width * 1.6)
      tx.set(clamp((pointer.x - (box.left + box.width / 2)) / reach))
      ty.set(clamp((pointer.y - (box.top + box.height * 0.42)) / reach))
    }
    const stop = watchPointer(follow)
    let timer: number
    const wander = () => {
      if (performance.now() - pointer.at > IDLE_POINTER_MS) {
        const centre = Math.random() < 0.35
        tx.set(centre ? 0 : between(-0.7, 0.7))
        ty.set(centre ? 0 : between(-0.45, 0.35))
      }
      timer = window.setTimeout(wander, between(1200, 3400))
    }
    timer = window.setTimeout(wander, between(800, 2000))
    return () => {
      stop()
      window.clearTimeout(timer)
    }
  }, [target, track, fixedX, fixedY, tx, ty])

  return { x, y }
}

// --- moods -----------------------------------------------------------------

const ANTICS: readonly Mood[] = ['listen', 'happy', 'listen', 'wave', 'yawn', 'trick']
const ACTIVITY = ['pointerdown', 'keydown', 'pointermove', 'scroll'] as const

export interface BuddyMood {
  mood: Mood
  /** Play a mood for a moment, then settle back. */
  play: (mood: Mood, ms?: number) => void
}

/**
 * The mood on show: a reaction if one is playing, else asleep if left
 * alone, else the screen's own mood. Fidgets play only while idle.
 */
export function useBuddyMood(
  base: Mood,
  { lively, calm, sleepAfterMs = 45_000 }: { lively: boolean; calm: boolean; sleepAfterMs?: number },
): BuddyMood {
  const [moment, setMoment] = useState<Mood | null>(null)
  const [dozing, setDozing] = useState(false)
  const dozingRef = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const play = useCallback((mood: Mood, ms?: number) => {
    window.clearTimeout(timer.current)
    dozingRef.current = false
    setDozing(false)
    setMoment(mood)
    timer.current = window.setTimeout(() => setMoment(null), ms ?? (HOLD_MS[mood] || 1600))
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Fidgets, now and then, while nothing else is happening.
  useEffect(() => {
    if (!lively || calm || moment || dozing || base !== 'idle') return
    const wait = window.setTimeout(
      () => play(ANTICS[Math.floor(Math.random() * ANTICS.length)]),
      between(7000, 14000),
    )
    return () => window.clearTimeout(wait)
  }, [lively, calm, moment, dozing, base, play])

  // Nodding off when nobody is about, and waking with a start.
  useEffect(() => {
    if (!lively || base !== 'idle') return
    let sleep = window.setTimeout(() => {
      dozingRef.current = true
      setDozing(true)
    }, sleepAfterMs)
    let last = 0
    const wake = () => {
      const now = performance.now()
      if (now - last < 400) return
      last = now
      window.clearTimeout(sleep)
      if (dozingRef.current) play('oops', 900)
      sleep = window.setTimeout(() => {
        dozingRef.current = true
        setDozing(true)
      }, sleepAfterMs)
    }
    ACTIVITY.forEach((name) => window.addEventListener(name, wake, { passive: true }))
    return () => {
      window.clearTimeout(sleep)
      ACTIVITY.forEach((name) => window.removeEventListener(name, wake))
    }
  }, [lively, base, sleepAfterMs, play])

  return { mood: moment ?? (dozing ? 'sleepy' : base), play }
}

// --- speech ----------------------------------------------------------------

export interface Speech {
  line: string | null
  say: (line: string, ms?: number) => void
  hush: () => void
}

/** Long enough to read, however long the line. */
export function readingTime(line: string): number {
  return Math.max(2600, Math.min(7500, 1600 + line.length * 55))
}

export function useSpeech(): Speech {
  const [line, setLine] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const hush = useCallback(() => {
    window.clearTimeout(timer.current)
    setLine(null)
  }, [])
  const say = useCallback((next: string, ms?: number) => {
    window.clearTimeout(timer.current)
    setLine(next)
    timer.current = window.setTimeout(() => setLine(null), ms ?? readingTime(next))
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { line, say, hush }
}
