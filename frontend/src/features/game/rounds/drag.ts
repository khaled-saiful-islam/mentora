/**
 * Dragging in a round (§28.3.5): what a piece is over, the target it is
 * drawn to while dragged (the "magnet"), and the knock and buzz when it lands.
 * Every round that drags uses these, so a drop feels the same everywhere;
 * tapping a piece and then its place stays, for anyone who can't drag.
 */
import { useCallback, useState } from 'react'
import { buzz, BUZZ } from '@/lib/haptics'
import { useSoundOn } from '@/lib/prefs'
import type { Sound } from '@/lib/sound'

export type DragEvent = MouseEvent | TouchEvent | PointerEvent

/** The target named `data-{attr}` under the pointer, if any. */
export function targetAt(event: DragEvent, attr: string): string | null {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event
  if (!point || typeof document.elementsFromPoint !== 'function') return null
  const key = attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  for (const element of document.elementsFromPoint(point.clientX, point.clientY)) {
    const found = element.closest<HTMLElement>(`[data-${attr}]`)
    const value = found?.dataset[key]
    if (value) return value
  }
  return null
}

/**
 * The target a dragged piece is over, to light it up as it is drawn in, and
 * the drop: where it landed, with a knock and a short buzz on a phone that
 * can. `null` when it landed on nothing.
 */
export function useMagnet(attr: string, sound: (name: Sound) => void) {
  const [near, setNear] = useState<string | null>(null)
  const soundOn = useSoundOn()

  const track = useCallback(
    (event: DragEvent) => {
      const over = targetAt(event, attr)
      setNear((was) => (was === over ? was : over))
    },
    [attr],
  )

  const drop = useCallback(
    (event: DragEvent): string | null => {
      setNear(null)
      const landed = targetAt(event, attr)
      if (landed) {
        sound('snap')
        buzz(BUZZ.tap, soundOn)
      }
      return landed
    },
    [attr, sound, soundOn],
  )

  return { near, track, drop }
}

/** How a target looks while a piece is drawn to it. */
export const MAGNET = 'scale-[1.03] border-primary bg-selected ring-4 ring-primary/40'
