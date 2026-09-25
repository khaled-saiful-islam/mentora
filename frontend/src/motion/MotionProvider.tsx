import { MotionConfig } from 'motion/react'
import { usePreferences } from '@/lib/prefs'
import type { MotionChoice } from '@/lib/user'

const MODE: Record<MotionChoice, 'user' | 'always' | 'never'> = {
  system: 'user',
  reduced: 'always',
  full: 'never',
}

/** Every motion component in the app follows the person's motion setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { prefs } = usePreferences()
  return <MotionConfig reducedMotion={MODE[prefs.motion]}>{children}</MotionConfig>
}
