/**
 * The comic opening (§25): the story's lines as speech bubbles beside who
 * says them — the opening every game had before there were others.
 */
import { StoryCard } from '../cards'
import type { OpeningProps } from './parts'

export function ComicOpening({ title, hook, goal, lines, cast, count, telling, onStart }: OpeningProps) {
  return <StoryCard title={title} hook={hook} goal={goal} lines={lines} cast={cast} count={count} telling={telling} onStart={onStart} />
}
