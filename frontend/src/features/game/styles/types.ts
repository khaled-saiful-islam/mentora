/**
 * What every game style is given (§23). A style is how a challenge is played
 * — a stop on a map, lanes to run down, bubbles to catch, pieces to place —
 * never what it asks: the challenge, its marking and the story are the same
 * whichever style plays them, which is why a maker can switch style without
 * rebuilding the game.
 */
import type { GameWorld } from '@/features/learning/api'
import type { GameChallenge, Played } from '@/features/play/api'
import type { Effect } from '../audio/sfx'

export interface StyleProps {
  world: GameWorld
  item: GameChallenge
  /** Where it sits in the whole game, and the whole game. */
  index: number
  items: GameChallenge[]
  /** Its chapter's first challenge, and the chapter's challenges. */
  chapterStart: number
  chapterItems: GameChallenge[]
  played: Record<string, Played>
  boss: boolean
  /** Once answered: what was played, with the right answer revealed. */
  outcome: Played | null
  /** No more choosing: an answer is on its way, or already in. */
  locked: boolean
  /** How much of the timer is left, 1 → 0; 1 when untimed. */
  left: number
  timed: boolean
  calm: boolean
  buddy: string | null | undefined
  /** The question card, for the style to place. */
  card: React.ReactNode
  onChoose: (choice: number) => void
  /** What running out of time means here — a runner takes the lane it is
   *  in. Unset, the time is simply up. */
  onExpire: (expire: (() => void) | null) => void
  effect: (effect: Effect, level?: number) => void
}

export type OptionState = 'idle' | 'right' | 'wrong' | 'faded'

/** How an option looks once the challenge is answered. */
export function optionState(outcome: Played | null, n: number): OptionState {
  if (!outcome) return 'idle'
  const right = outcome.reveal?.answer
  if (n === right) return 'right'
  if (n === outcome.choice) return 'wrong'
  return 'faded'
}

/** On a wide screen, every option in one row. */
export const COLUMNS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }

/** A size at which the longest word fits its gate or bubble whole — a word is never
 *  split for want of room. `cqw` is a hundredth of its container's width. */
export function fitWord(text: string): string {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length), 1)
  return `min(1em, ${Math.floor(150 / longest)}cqw)`
}
