/**
 * A world, drawn: sky, far, middle and near layers, with a little life — a
 * hornbill crossing the canopy, light rays swaying on the reef, lanterns
 * swinging at the kampung fair, the city's windows twinkling, a shooting
 * star. Pure SVG from the world's own tokens (`--world-…` in theme.css), so
 * there is nothing to load and it is sharp at any size.
 *
 * `motion` says how the scene moves under the game: `still`, a slow `drift`,
 * or `run` — the near layers sliding past for the Lane Runner. Calm motion
 * keeps every world still, and every bit of life with it.
 */
import { memo } from 'react'
import type { GameWorld } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { seeded, seedOf } from '../audio/music'
import { CityArt, KampungArt, RainforestArt, ReefArt, SpaceArt } from './art'
import { paint, type WorldPart } from './info'
import type { ArtProps } from './parts'

export type SceneMotion = 'still' | 'drift' | 'run'

const ART: Record<GameWorld, (props: ArtProps) => React.ReactElement> = {
  rainforest: RainforestArt,
  reef: ReefArt,
  kampung: KampungArt,
  city: CityArt,
  space: SpaceArt,
}

interface BackdropProps {
  world: GameWorld
  motion?: SceneMotion
  calm: boolean
  className?: string
}

export const Backdrop = memo(function Backdrop({ world, motion = 'drift', calm, className }: BackdropProps) {
  const Art = ART[world]
  const p = (part: WorldPart, alpha?: number) => paint(world, part, alpha)
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      aria-hidden
      data-world={world}
    >
      <defs>
        <linearGradient id={`sky-${world}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p('sky')} />
          <stop offset="1" stopColor={p('haze')} />
        </linearGradient>
        <radialGradient id={`glow-${world}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={p('glow', 0.9)} />
          <stop offset="1" stopColor={p('glow', 0)} />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#sky-${world})`} />
      <Art p={p} random={seeded(seedOf(world))} live={!calm && motion !== 'still'} run={!calm && motion === 'run'} />
    </svg>
  )
})
