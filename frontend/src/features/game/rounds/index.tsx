/**
 * A round of a game (§26), in whichever template its island is played in.
 * Give it a `key` per island: a round keeps its own pieces and shuffle, so a
 * new island is a new round.
 */
import { BossBattle } from './BossBattle'
import { DetectiveCase } from './DetectiveCase'
import { EscapeRoom } from './EscapeRoom'
import { LineUp } from './LineUp'
import { MatchUp } from './MatchUp'
import type { Shuffled } from './shuffle'
import { SortItOut } from './SortItOut'
import { SpotTheMistake } from './SpotTheMistake'
import { TheLab } from './TheLab'
import type { Contents, Play, RoundProps } from './types'

/** The names a maker and a child see for each template. */
export const PLAY_LABELS: Record<Play, string> = {
  sort: 'Sort It Out',
  order: 'Line Up',
  match: 'Match Up',
  lab: 'The Lab',
  mistake: 'Spot the Mistake',
  case: 'Detective Case',
  escape: 'Escape Room',
  boss: 'Boss Battle',
}

export type RoundOf<P extends Play> = RoundProps<Contents[P]> & Shuffled & { play: P }
export type AnyRound = { [P in Play]: RoundOf<P> }[Play]

export function Round(props: AnyRound) {
  switch (props.play) {
    case 'sort':
      return <SortItOut {...props} />
    case 'order':
      return <LineUp {...props} />
    case 'match':
      return <MatchUp {...props} />
    case 'lab':
      return <TheLab {...props} />
    case 'mistake':
      return <SpotTheMistake {...props} />
    case 'case':
      return <DetectiveCase {...props} />
    case 'escape':
      return <EscapeRoom {...props} />
    case 'boss':
      return <BossBattle {...props} />
  }
}

/** An island's play and its content, as `Round` takes them — or null when
 *  the island has no content for its play. */
export type RoundContent = { [P in Play]: { play: P; content: Contents[P] } }[Play]

export function roundContent(island: Partial<Contents> & { play: Play }): RoundContent | null {
  const content = island[island.play]
  // The play names the content's key: the pair belongs together.
  return content ? ({ play: island.play, content } as RoundContent) : null
}

export { LineUp } from './LineUp'
export { MatchUp } from './MatchUp'
export { SortItOut } from './SortItOut'
export { SHOW_ME_MS } from './parts'
export { outOfOrder, shuffled, type Shuffled, type Shuffler } from './shuffle'
export * from './types'
