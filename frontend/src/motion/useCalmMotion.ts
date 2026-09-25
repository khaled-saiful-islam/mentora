import { useReducedMotion } from 'motion/react'
import { usePreferences } from '@/lib/prefs'

/**
 * Whether to hold still: the person's own setting first, then the system's.
 *
 * `MotionConfig` already tames motion components; this is for everything
 * else — a confetti burst, a timer that rotates tips, a scene that loops.
 */
export function useCalmMotion(): boolean {
  const system = useReducedMotion()
  const { prefs } = usePreferences()
  if (prefs.motion === 'reduced') return true
  if (prefs.motion === 'full') return false
  return Boolean(system)
}
