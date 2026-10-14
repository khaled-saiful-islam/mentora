/**
 * A short buzz in the hand, on phones that can (Android; iOS has no web API
 * for it). Only with sound on: the two are one "feedback" setting to a child,
 * and a buzz that cannot be switched off is a nuisance in a quiet classroom.
 */
export const BUZZ = {
  tap: 12,
  right: [18, 40, 18],
  unlock: [20, 60, 30, 60, 50],
  grow: [30, 80, 30, 80, 120],
} as const

export function buzz(pattern: number | readonly number[], on: boolean): void {
  // Browsers refuse a buzz before the first tap on the page, and say so in
  // the console: asked only once the child has touched it.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  if (!on || activation?.hasBeenActive === false) return
  try {
    navigator.vibrate?.(typeof pattern === 'number' ? pattern : [...pattern])
  } catch {
    // No vibration here: nothing is lost.
  }
}
