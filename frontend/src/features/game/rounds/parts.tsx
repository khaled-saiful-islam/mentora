/**
 * What every round (§26) shares: how big things are for each year band, the
 * "read it to me" button the youngest get, a gentle wobble for a wrong move,
 * Show me, and finishing exactly once.
 */
import { SpeakerHigh } from '@phosphor-icons/react'
import { useAnimate } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui'
import { wobble } from '@/motion'
import type { Band } from './types'

/** How long Show me points at the piece before it moves it: long enough to see. */
export const SHOW_ME_MS = 900

interface Sizes {
  /** A piece's words. */
  piece: string
  /** The one big card in Sort It Out. */
  big: string
  /** A piece's emoji. */
  icon: string
  /** The big card's emoji. */
  bigIcon: string
}

/** Year 1–3 read big; Form students get denser screens that fit more. */
export const SIZE: Record<Band, Sizes> = {
  early: { piece: 'text-2xl', big: 'text-3xl', icon: 'text-4xl', bigIcon: 'text-7xl' },
  middle: { piece: 'text-xl', big: 'text-2xl', icon: 'text-3xl', bigIcon: 'text-6xl' },
  secondary: { piece: 'text-lg', big: 'text-xl', icon: 'text-2xl', bigIcon: 'text-5xl' },
}

/** The youngest can have any piece read to them. */
export function ReadIt({ text, say }: { text: string; say: (text: string) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-12 shrink-0"
      aria-label={`Read it to me: ${text}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        say(text)
      }}
    >
      <SpeakerHigh weight="bold" className="size-6" />
    </Button>
  )
}

/** A wobble for a wrong piece — found by its `data-piece` inside `scope` —
 *  without remounting it, so a keyboard keeps its place. Still when calm. */
export function useWobble(calm: boolean) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const shake = useCallback(
    (piece: string) => {
      if (calm || !scope.current) return
      const target = Array.from(scope.current.querySelectorAll<HTMLElement>('[data-piece]')).find((el) => el.dataset.piece === piece)
      if (target) void animate(target, { x: wobble.x }, wobble.transition)
    },
    [animate, calm, scope],
  )
  return [scope, shake] as const
}

/** Calls `play` each time Show me is pressed — each time `showMe` goes up. */
export function useShowMe(showMe: number, play: () => void) {
  const latest = useRef(play)
  const seen = useRef(showMe)
  useEffect(() => {
    latest.current = play
  })
  useEffect(() => {
    if (showMe <= seen.current) return
    seen.current = showMe
    latest.current()
  }, [showMe])
}

/** A timer that is cleared if the round goes away first. */
export function useLater() {
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])
  return useCallback((run: () => void, ms: number) => {
    timers.current = [...timers.current, window.setTimeout(run, ms)]
  }, [])
}

/** `onDone` once the round is `complete`, and never twice. */
export function useFinish(complete: boolean, onDone: () => void) {
  const done = useRef(false)
  useEffect(() => {
    if (!complete || done.current) return
    done.current = true
    onDone()
  }, [complete, onDone])
}
