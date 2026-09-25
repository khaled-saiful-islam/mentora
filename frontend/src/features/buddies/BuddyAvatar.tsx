import { useMotionValue } from 'motion/react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { choreograph } from './choreography'
import { MOUTH_FOR } from './parts'
import { profileOf } from './profiles'
import type { Mood } from './types'

/** A buddy's face in a circle — for a leaderboard row or a name tag. Still,
 *  so a list of thirty costs nothing. */
export function BuddyAvatar({
  buddy,
  mood = 'idle',
  size = 40,
  className,
}: {
  buddy: string | null | undefined
  mood?: Mood
  size?: number
  className?: string
}) {
  const profile = profileOf(buddy)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const moves = useMemo(() => choreograph('idle', {}, true), [])
  const { Rig } = profile
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-raised ring-2 ring-surface', className)}
      style={{ width: size, height: size, backgroundColor: `hsl(var(--buddy-${profile.key}) / 0.18)` }}
      aria-hidden
    >
      <svg viewBox={profile.face} width={size} height={size}>
        <Rig mood={mood} mouth={MOUTH_FOR[mood]} moves={moves} gaze={{ x, y }} blinking={false} calm />
      </svg>
    </span>
  )
}
