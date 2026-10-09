/**
 * An island's round piece by piece, numbered as the server numbers them for
 * "Read it to me" (`pieces_of` in `app/learning/game_rounds.py`):
 *
 * - a Sort It Out's cards, then its baskets;
 * - a Line Up's steps;
 * - a Match Up's left sides, then its right ones;
 * - a Lab's goals;
 * - a Mistake's lines;
 * - a Case's suspects, then its clues;
 * - an Escape Room's doors;
 * - a Boss Battle's questions.
 *
 * The voice is asked for a piece by its number, never by its words.
 */
import type { Spoken } from '@/features/play/backend'
import type { Contents, Play } from './types'

export interface Readable extends Partial<Contents> {
  id: string
  play: Play
}

interface Piece {
  text: string
  why: string
}

const said = <T extends { why: string }>(rows: T[], text: (row: T) => string): Piece[] => rows.map((row) => ({ text: text(row), why: row.why }))

export function piecesOf(island: Readable): Piece[] {
  switch (island.play) {
    case 'sort':
      return island.sort ? [...island.sort.cards, ...island.sort.baskets.map((b) => ({ text: b.label, why: '' }))] : []
    case 'order':
      return island.order?.steps ?? []
    case 'match': {
      const pairs = island.match?.pairs ?? []
      return [...said(pairs, (p) => p.left), ...said(pairs, (p) => p.right)]
    }
    case 'lab':
      return said(island.lab?.goals ?? [], (g) => g.text)
    case 'mistake':
      return said(island.mistake?.lines ?? [], (l) => l.text)
    case 'case':
      return island.case ? [...said(island.case.suspects, (s) => s.claim), ...said(island.case.clues, (c) => c.text)] : []
    case 'escape':
      return said(island.escape?.doors ?? [], (d) => d.puzzle)
    case 'boss':
      return said(island.boss?.questions ?? [], (q) => q.ask)
  }
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
