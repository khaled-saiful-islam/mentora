/** Buddy art reads its colours from the theme, like everything else. */
export function paint(token: string): string {
  return `hsl(var(--buddy-${token}))`
}

export const INK = paint('ink')
export const SHINE = paint('shine')
export const BLUSH = paint('blush')
export const TONGUE = paint('tongue')

/**
 * Turn a part about a point in the drawing's own coordinates.
 *
 * Motion defaults SVG parts to `fill-box`, which turns each about its own
 * middle — an arm would spin like a propeller rather than swing from the
 * shoulder. `view-box` puts the origin where the drawing says it is.
 */
export function pivot(x: number, y: number) {
  // `originX`/`originY`, not `transformOrigin`: Motion writes its own origin
  // onto SVG parts, built from these, and would overwrite a plain one.
  return { transformBox: 'view-box', originX: `${x}px`, originY: `${y}px` } as const
}
