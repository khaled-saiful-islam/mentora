/**
 * The worlds a game can be set in (§23) and the styles it can be played in —
 * the names the server uses (`WORLDS`, `STYLES` in `app/learning/game.py`),
 * with how each looks and what Match & Build builds there.
 */
import type { GameStyle, GameWorld } from '@/features/learning/api'

export interface WorldInfo {
  key: GameWorld
  label: string
  /** One line, for the maker choosing it. */
  blurb: string
  /** What Match & Build puts together, piece by piece. */
  builds: string
}

export const WORLDS: Record<GameWorld, WorldInfo> = {
  rainforest: { key: 'rainforest', label: 'Rainforest', blurb: 'Giant trees, a river and hornbills in Taman Negara', builds: 'a rope bridge' },
  reef: { key: 'reef', label: 'Coral reef', blurb: 'Turtles and bright fish around Sipadan', builds: 'a glass-bottom boat' },
  kampung: { key: 'kampung', label: 'Kampung festival', blurb: 'Lanterns, kites and a village fair at sunset', builds: 'a wau kite' },
  city: { key: 'city', label: 'Kuala Lumpur', blurb: 'The twin towers and a city full of lights', builds: 'a light-rail track' },
  space: { key: 'space', label: 'Space mission', blurb: 'A rocket, a moon base and the stars', builds: 'a rocket' },
}

export interface StyleInfo {
  key: GameStyle
  label: string
  blurb: string
}

export const STYLES: Record<GameStyle, StyleInfo> = {
  quest: { key: 'quest', label: 'Quest Map', blurb: 'Travel a map, one stop per challenge — best for the youngest' },
  runner: { key: 'runner', label: 'Lane Runner', blurb: 'Run and switch to the lane with the right answer' },
  catch: { key: 'catch', label: 'Bubble Catch', blurb: 'Catch the right answer as it floats down' },
  match: { key: 'match', label: 'Match & Build', blurb: 'Place the right piece to build something big' },
}

export const WORLD_KEYS = Object.keys(WORLDS) as GameWorld[]
export const STYLE_KEYS = Object.keys(STYLES) as GameStyle[]

/** A world colour, for art: `paint('rainforest', 'sky')`. */
export const paint = (world: GameWorld, part: WorldPart, alpha?: number) =>
  alpha === undefined ? `hsl(var(--world-${world}-${part}))` : `hsl(var(--world-${world}-${part}) / ${alpha})`

export type WorldPart = 'sky' | 'haze' | 'far' | 'mid' | 'near' | 'ground' | 'accent' | 'glow'

export const isWorld = (value: unknown): value is GameWorld => typeof value === 'string' && value in WORLDS
export const isStyle = (value: unknown): value is GameStyle => typeof value === 'string' && value in STYLES
