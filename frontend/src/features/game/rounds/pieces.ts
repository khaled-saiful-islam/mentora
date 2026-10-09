/**
 * An island's round piece by piece, numbered as the server numbers them for
 * "Read it to me" (`pieces_of` in `app/services/read_aloud.py`): a Sort It
 * Out's cards then its baskets, a Line Up's steps, a Match Up's left sides
 * then its right ones. The voice is asked for a piece by its number, never
 * by its words.
 */
import type { Spoken } from '@/features/play/backend'
import type { Contents, Play } from './types'

export interface Readable {
  id: string
  play: Play
  sort?: Contents['sort']
  order?: Contents['order']
  match?: Contents['match']
}

interface Piece {
  text: string
  why: string
}

export function piecesOf(island: Readable): Piece[] {
  if (island.play === 'sort' && island.sort) {
    return [...island.sort.cards, ...island.sort.baskets.map((basket) => ({ text: basket.label, why: '' }))]
  }
  if (island.play === 'order' && island.order) return island.order.steps
  if (island.play === 'match' && island.match) {
    const pairs = island.match.pairs
    return [...pairs.map((p) => ({ text: p.left, why: p.why })), ...pairs.map((p) => ({ text: p.right, why: p.why }))]
  }
  return []
}

/** What to ask the voice for to hear `text` — a piece of the round, or why
 *  one goes where it does — or null when it is neither. */
export function spokenFor(island: Readable, text: string): Spoken | null {
  const pieces = piecesOf(island)
  const piece = pieces.findIndex((p) => p.text === text)
  if (piece >= 0) return { item: island.id, part: 'piece', n: piece }
  const why = pieces.findIndex((p) => p.why === text)
  return why >= 0 ? { item: island.id, part: 'why', n: why } : null
}
