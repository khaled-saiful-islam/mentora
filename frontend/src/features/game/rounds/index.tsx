/**
 * A round of a game (§26), in whichever template its island is played in.
 * Give it a `key` per island: a round keeps its own pieces and shuffle, so a
 * new island is a new round.
 */
import { LineUp } from './LineUp'
import { MatchUp } from './MatchUp'
import type { Shuffled } from './shuffle'
import { SortItOut } from './SortItOut'
import type { Contents, Play, RoundProps } from './types'

/** The names a maker and a child see for each template. */
export const PLAY_LABELS: Record<Play, string> = {
  sort: 'Sort It Out',
  order: 'Line Up',
  match: 'Match Up',
}

export type RoundOf<P extends Play> = RoundProps<Contents[P]> & Shuffled & { play: P }
export type AnyRound = RoundOf<'sort'> | RoundOf<'order'> | RoundOf<'match'>

export function Round(props: AnyRound) {
  switch (props.play) {
    case 'sort':
      return <SortItOut {...props} />
    case 'order':
      return <LineUp {...props} />
    case 'match':
      return <MatchUp {...props} />
  }
}

export { LineUp } from './LineUp'
export { MatchUp } from './MatchUp'
export { SortItOut } from './SortItOut'
export { SHOW_ME_MS } from './parts'
export { outOfOrder, shuffled, type Shuffled, type Shuffler } from './shuffle'
export * from './types'
