/**
 * Where a game can be set (§24) — the names the server uses (`WORLDS` in
 * `app/learning/game.py`). The game's own code draws the place; these are
 * for the maker choosing it, with a swatch of its colours.
 */
import type { GameWorld } from '@/features/learning/api'

export interface WorldInfo {
  key: GameWorld
  label: string
  /** One line, for the maker choosing it. */
  blurb: string
}

export const WORLDS: Record<GameWorld, WorldInfo> = {
  rainforest: { key: 'rainforest', label: 'Rainforest', blurb: 'Giant trees, a river and hornbills in Taman Negara' },
  reef: { key: 'reef', label: 'Coral reef', blurb: 'Turtles and bright fish around Sipadan' },
  kampung: { key: 'kampung', label: 'Kampung festival', blurb: 'Lanterns, kites and a village fair at sunset' },
  city: { key: 'city', label: 'Kuala Lumpur', blurb: 'The twin towers and a city full of lights' },
  space: { key: 'space', label: 'Space mission', blurb: 'A rocket, a moon base and the stars' },
}

export const WORLD_KEYS = Object.keys(WORLDS) as GameWorld[]

/** A world colour, for a swatch: `paint('rainforest', 'sky')`. */
export const paint = (world: GameWorld, part: WorldPart) => `hsl(var(--world-${world}-${part}))`

export type WorldPart = 'sky' | 'haze' | 'far' | 'mid' | 'near' | 'ground' | 'accent' | 'glow'

export const isWorld = (value: unknown): value is GameWorld => typeof value === 'string' && value in WORLDS
