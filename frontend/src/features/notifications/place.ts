/** Room kept between the panel and the edge of the window. */
const MARGIN = 12
/** Between the bell and the panel under it. */
const GAP = 8

export interface Placement {
  top: number
  left: number
  maxHeight: number
}

/**
 * Where the panel goes: under the bell, lined up with its left or right edge,
 * and nudged back inside the window when that would run off it.
 *
 * Fixed to the window rather than placed inside whatever holds the bell,
 * because that holder can clip — the sidebar hides its overflow, and a panel
 * wider than the sidebar was cut off at its edge.
 */
export function place(
  anchor: { left: number; right: number; bottom: number },
  width: number,
  align: 'left' | 'right',
  viewport: { width: number; height: number },
): Placement {
  const top = anchor.bottom + GAP
  const wanted = align === 'left' ? anchor.left : anchor.right - width
  const furthest = Math.max(MARGIN, viewport.width - width - MARGIN)
  return {
    top,
    left: Math.min(Math.max(MARGIN, wanted), furthest),
    maxHeight: Math.max(0, viewport.height - top - MARGIN),
  }
}
