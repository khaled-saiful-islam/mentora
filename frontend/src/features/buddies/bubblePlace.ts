/**
 * Where a speech bubble goes, so it is never cut off.
 *
 * The bubble is drawn over the whole page (not inside the buddy's card, which
 * may clip), next to its buddy, and always wholly on screen: slid sideways to
 * stay inside the edges, and moved below the buddy when there is no room
 * above. Its tail still points at the buddy. Pure, so it can be tested.
 */
import type { BubbleSide } from './SpeechBubble'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Placement {
  left: number
  top: number
  /** Which edge of the bubble the tail is on — the one facing the buddy. */
  tail: 'bottom' | 'top' | 'left' | 'right'
  /** Along that edge, from the bubble's left (or top), in px. */
  tailAt: number
}

/** Kept clear of the screen's edges. */
export const MARGIN = 12
/** How far a bubble tucks into the buddy's box, as before, so it reads as theirs. */
const TUCK = 8
const TAIL_INSET = 18

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

export function placeBubble(buddy: Box, bubble: Size, screen: Size, side: BubbleSide): Placement {
  if (side === 'left' || side === 'right') {
    const left = side === 'left' ? buddy.left - bubble.width + TUCK : buddy.left + buddy.width - TUCK
    // Beside the buddy only when it fits there; else above, like the rest.
    if (left >= MARGIN && left + bubble.width <= screen.width - MARGIN) {
      const top = clamp(buddy.top + buddy.height * 0.08, MARGIN, screen.height - bubble.height - MARGIN)
      const tailAt = clamp(buddy.top + buddy.height * 0.35 - top, TAIL_INSET, bubble.height - TAIL_INSET)
      return { left, top, tail: side === 'left' ? 'right' : 'left', tailAt }
    }
  }
  const centre = buddy.left + buddy.width / 2
  const wanted = side === 'above-left' ? buddy.left + buddy.width - bubble.width : centre - bubble.width / 2
  const left = clamp(wanted, MARGIN, Math.max(MARGIN, screen.width - bubble.width - MARGIN))
  const above = buddy.top - bubble.height + TUCK
  const below = buddy.top + buddy.height - TUCK
  const fitsAbove = above >= MARGIN
  const top = fitsAbove ? above : clamp(below, MARGIN, Math.max(MARGIN, screen.height - bubble.height - MARGIN))
  const tailAt = clamp(centre - left, TAIL_INSET, bubble.width - TAIL_INSET)
  return { left, top, tail: fitsAbove ? 'bottom' : 'top', tailAt }
}
