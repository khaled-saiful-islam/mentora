/**
 * What every opening (§26.8) shares: the dialog it is told in, who says each
 * line — the player's own buddy, or the story's character by their initials —
 * the goal, "Read it to me", and the button that starts the game. Each
 * opening is its own scene; these keep the words and the controls the same.
 */
import { motion } from 'motion/react'
import { Play, SpeakerHigh, Star, Stop } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { BuddyAvatar } from '@/features/buddies'
import type { GameWorld, StoryLine } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { told, type Cast, type Telling } from '../cards'

/** What a game's opening is given: the story, who is in it, and how to start. */
export interface OpeningProps {
  title: string
  hook: string
  goal: string
  lines: StoryLine[]
  cast: Cast
  count: number
  telling: Telling
  onStart: () => void
  world: GameWorld
  calm: boolean
}

/** The opening's dialog — always named "The story", whatever the scene. */
export function Scene({ children, className, calm }: { children: React.ReactNode; className?: string; calm: boolean }) {
  return (
    <motion.section
      role="dialog"
      aria-label="The story"
      initial={calm ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.gentle}
      className={cn('w-full max-w-xl overflow-hidden rounded-3xl border-4 border-surface bg-surface shadow-lg', className)}
    >
      {children}
    </motion.section>
  )
}

/** Who says a line, as the reader sees it: the buddy by name, or the character. */
export function speakerOf(line: StoryLine, cast: Cast): { buddy: boolean; name: string } {
  const buddy = line.who === '{buddy}' || line.who === cast.buddyName
  return { buddy, name: buddy ? cast.buddyName : told(line.who, cast.buddyName) || cast.character }
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]?.toUpperCase()).join('') || '★'
}

/** A face for whoever is speaking: the buddy's own picture, or the character's initials. */
export function Face({ buddy, name, cast, size = 48 }: { buddy: boolean; name: string; cast: Cast; size?: number }) {
  if (buddy) return <BuddyAvatar buddy={cast.buddyKey} size={size} className="shrink-0" />
  return (
    <span
      aria-hidden
      // The letters grow with the face, so they fit a small one and fill a big one.
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="grid shrink-0 place-items-center rounded-full border-2 border-sun-400 bg-sun-100 font-display font-bold leading-none text-grape-900 dark:bg-sun-600/40 dark:text-sun-100"
    >
      {initials(name)}
    </span>
  )
}

/** The goal, set apart: what the player sets out to do. */
export function Goal({ goal, label }: { goal: string; label?: string }) {
  if (!goal) return null
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-star-soft px-3 py-2 font-semibold">
      <Star weight="fill" className="mt-1 size-4 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 break-words">
        {label && <span className="font-bold">{label} </span>}
        {goal}
      </span>
    </p>
  )
}

/** "Read it to me", and the button that starts the game. */
export function Footer({ telling, onStart }: { telling: Telling; onStart: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {telling.readable ? (
        <Button variant="ghost" size="sm" onClick={telling.toggle} aria-pressed={telling.reading}>
          {telling.reading ? <Stop weight="fill" className="size-4" /> : <SpeakerHigh weight="bold" className="size-4" />}
          {telling.reading ? 'Stop' : 'Read it to me'}
        </Button>
      ) : (
        <span />
      )}
      <Button variant="sun" size="lg" onClick={onStart} autoFocus>
        <Play weight="fill" className="size-5" />
        Let's play
      </Button>
    </div>
  )
}

/** How many islands there are to explore, said simply. */
export const islandsToExplore = (count: number) => `${count} ${count === 1 ? 'island' : 'islands'} to explore`
