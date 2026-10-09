/**
 * A round of a game (§26): one island's play, in one of Mentora's own
 * templates. The server writes and checks the content (`app/learning/game.py`);
 * a round only shows it and answers every move at once — right, or wrong and
 * why — until every piece is in its place.
 */
import type { Sound } from '@/lib/sound'

/** The templates a round can be played in. */
export type Play = 'sort' | 'order' | 'match'

/** Who it is for (§26.3): Year 1–3, Year 4–6, or Form 1 and up. */
export type Band = 'early' | 'middle' | 'secondary'

export interface Basket {
  id: string
  label: string
  /** An emoji, or empty. */
  icon: string
}

export interface SortCard {
  id: string
  text: string
  icon: string
  /** The basket it belongs in. */
  basket: string
  /** Why it belongs there — said when it is put in the wrong one. */
  why: string
}

export interface SortContent {
  baskets: Basket[]
  cards: SortCard[]
}

export interface Step {
  id: string
  text: string
  icon: string
  /** Why it comes here — said when it is put too early. */
  why: string
}

export interface OrderContent {
  /** In the right order; a round shuffles them itself. */
  steps: Step[]
}

export interface Pair {
  id: string
  left: string
  right: string
  /** Why they go together — said when one is joined to the wrong partner. */
  why: string
}

export interface MatchContent {
  pairs: Pair[]
}

export interface Contents {
  sort: SortContent
  order: OrderContent
  match: MatchContent
}

/** One move the child made: which piece, and whether it was right. */
export interface Move {
  piece: string
  right: boolean
}

export interface RoundProps<C> {
  content: C
  band: Band
  /** No shaking, flying or fast motion. */
  calm: boolean
  /** The buddy says it (and it is read aloud): the why of a wrong move. */
  say: (text: string) => void
  sound: (name: Sound) => void
  /** Goes up by one each time the child presses Show me: the round then
   *  plays one right move itself, slowly enough to watch. */
  showMe: number
  /** Every move, right or wrong; a wrong one is a slip. */
  onMove: (move: Move) => void
  /** Every piece is in its place. Called once. */
  onDone: () => void
}

/** The band for a set's year, e.g. `year_2` → early. */
export function bandOf(gradeLevel: string | null | undefined): Band {
  const year = /^year_(\d)$/.exec(gradeLevel ?? '')
  if (year) return Number(year[1]) <= 3 ? 'early' : 'middle'
  return gradeLevel ? 'secondary' : 'middle'
}
