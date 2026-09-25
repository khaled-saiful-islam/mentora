/**
 * How each badge looks: an icon on a medal in its own colour. A new badge on
 * the server shows with the default medal until it gets an entry here.
 */
import {
  Barbell,
  Bird,
  Cards,
  Crown,
  Fire,
  GraduationCap,
  Medal,
  RocketLaunch,
  Star,
  TrendUp,
  type Icon,
} from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface MedalLook {
  Icon: Icon
  /** Gradient classes for the disc. */
  disc: string
  ribbon: string
}

const LOOKS: Record<string, MedalLook> = {
  gold: { Icon: Medal, disc: 'from-sun-300 to-sun-600', ribbon: 'bg-coral-400' },
  silver: { Icon: Medal, disc: 'from-muted to-muted-foreground', ribbon: 'bg-sky-400' },
  bronze: { Icon: Medal, disc: 'from-kind-quiz-vivid to-kind-quiz', ribbon: 'bg-mint-400' },
  perfect_score: { Icon: Crown, disc: 'from-sun-300 to-kind-quiz-vivid', ribbon: 'bg-grape-500' },
  star_scorer: { Icon: Star, disc: 'from-sun-300 to-sun-600', ribbon: 'bg-sky-400' },
  hot_streak: { Icon: Fire, disc: 'from-coral-400 to-kind-quiz-vivid', ribbon: 'bg-sun-400' },
  comeback: { Icon: TrendUp, disc: 'from-mint-400 to-mint-700', ribbon: 'bg-coral-400' },
  early_bird: { Icon: Bird, disc: 'from-sky-400 to-sky-700', ribbon: 'bg-sun-400' },
  card_shark: { Icon: Cards, disc: 'from-kind-flashcard-vivid to-kind-flashcard', ribbon: 'bg-grape-500' },
  self_starter: { Icon: RocketLaunch, disc: 'from-grape-400 to-grape-700', ribbon: 'bg-mint-400' },
  practice_pro: { Icon: Barbell, disc: 'from-kind-games-vivid to-grape-700', ribbon: 'bg-sun-400' },
  skill_master: { Icon: GraduationCap, disc: 'from-grape-500 to-sky-700', ribbon: 'bg-sun-400' },
}

const DEFAULT: MedalLook = { Icon: Star, disc: 'from-grape-400 to-grape-700', ribbon: 'bg-sun-400' }

export function medalLook(badge: string): MedalLook {
  return LOOKS[badge] ?? DEFAULT
}

/** A medal with a ribbon and a shine that sweeps across it. `locked` shows
 *  the silhouette of one not earned yet. */
export function BadgeMedal({ badge, size = 72, locked = false, shine = true, className }: { badge: string; size?: number; locked?: boolean; shine?: boolean; className?: string }) {
  const look = medalLook(badge)
  return (
    <span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size * 1.15 }} aria-hidden>
      <span className={cn('absolute top-0 left-[22%] h-[40%] w-[22%] -skew-x-12 rounded-b-md', locked ? 'bg-muted' : look.ribbon)} />
      <span className={cn('absolute top-0 right-[22%] h-[40%] w-[22%] skew-x-12 rounded-b-md brightness-90', locked ? 'bg-muted' : look.ribbon)} />
      <span
        className={cn(
          'absolute bottom-0 left-0 grid aspect-square w-full place-items-center overflow-hidden rounded-full border-4 shadow-lg',
          locked ? 'border-border bg-muted text-muted-foreground/40' : cn('border-white/70 bg-gradient-to-br text-white', look.disc),
        )}
      >
        <look.Icon weight="fill" style={{ width: size * 0.46, height: size * 0.46 }} className={locked ? '' : 'drop-shadow'} />
        {!locked && shine && (
          <motion.span
            className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/40"
            initial={{ x: '-150%' }}
            animate={{ x: '350%' }}
            transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
          />
        )}
      </span>
    </span>
  )
}
