/**
 * How big the artifact is drawn, on top of fitting it to the panel.
 *
 * Fitting shrinks a poster until all of it shows, which on a narrow panel is
 * text too small to read. Zoom is the way back: a fixed canvas grows and the
 * panel scrolls, and a site or app is laid out narrower and drawn bigger —
 * what a browser's own zoom does — so its text reflows rather than overflows.
 *
 * Steps rather than a slider, so two presses always land somewhere readable.
 */
export const ZOOM_STEPS = [1, 1.25, 1.5, 1.75, 2] as const

export type Zoom = (typeof ZOOM_STEPS)[number]

/** One step bigger or smaller, stopping at either end. An unknown value
 *  snaps to the nearest step first, so a stale one cannot strand the control. */
export function stepZoom(current: number, direction: 1 | -1): Zoom {
  const at = nearest(current)
  const index = Math.min(ZOOM_STEPS.length - 1, Math.max(0, at + direction))
  return ZOOM_STEPS[index]
}

export function zoomLabel(zoom: number): string {
  return zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`
}

function nearest(value: number): number {
  let best = 0
  ZOOM_STEPS.forEach((step, index) => {
    if (Math.abs(step - value) < Math.abs(ZOOM_STEPS[best] - value)) best = index
  })
  return best
}
