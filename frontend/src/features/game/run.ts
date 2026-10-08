/**
 * Where a game is up to — a small state machine, kept pure so every turn of
 * the story can be tested without a browser:
 *
 *   title → chapter → challenge → reveal → … → chapterEnd → … → finale
 *
 * A game picked up again after a reload resumes at its first unanswered
 * challenge (with that chapter's intro if it is the chapter's first). The
 * title is always shown first: it is the tap that lets the music play.
 */
import type { Played } from '@/features/play/api'
import type { Chapter } from './chapters'

export type Phase =
  | { name: 'title' }
  | { name: 'chapter'; chapter: number }
  | { name: 'challenge'; index: number }
  | { name: 'reveal'; index: number }
  | { name: 'chapterEnd'; chapter: number }
  | { name: 'finale' }

export interface RunState {
  phase: Phase
  played: Record<string, Played>
  /** Challenges the buddy gave a hint for. */
  hinted: string[]
  streak: number
  /** The points so far, as the game counts them; the server's are final. */
  points: number
}

export type RunEvent =
  | { type: 'begin' }
  | { type: 'go' }
  | { type: 'answered'; played: Played; earned: number; streak: number }
  | { type: 'hinted'; itemId: string }
  | { type: 'next' }
  | { type: 'onward' }

/** The order of play: each chapter's challenges, by id. */
export interface Layout {
  ids: string[]
  chapters: Pick<Chapter<unknown>, 'index' | 'start' | 'items'>[]
}

export function startRun(_layout: Layout, answered: Played[], points = 0): RunState {
  const played = Object.fromEntries(answered.map((p) => [p.item_id, p]))
  return { phase: { name: 'title' }, played, hinted: [], streak: 0, points }
}

/** Which chapter a challenge is in (an index into `layout.chapters`). */
export function chapterAt(layout: Layout, index: number): number {
  const found = layout.chapters.findIndex((c) => index >= c.start && index < c.start + c.items.length)
  return Math.max(found, 0)
}

const firstOpen = (layout: Layout, played: Record<string, Played>) => {
  const index = layout.ids.findIndex((id) => !played[id])
  return index < 0 ? layout.ids.length : index
}

/** Where play picks up: a chapter's intro at its start, else the challenge. */
function resume(layout: Layout, played: Record<string, Played>): Phase {
  const index = firstOpen(layout, played)
  if (index >= layout.ids.length) return { name: 'finale' }
  const chapter = chapterAt(layout, index)
  return layout.chapters[chapter]?.start === index ? { name: 'chapter', chapter } : { name: 'challenge', index }
}

function afterReveal(layout: Layout, state: RunState, index: number): Phase {
  const chapter = chapterAt(layout, index)
  const { start, items } = layout.chapters[chapter]
  const following = firstOpen(layout, state.played)
  if (following < start + items.length && following > index) return { name: 'challenge', index: following }
  return { name: 'chapterEnd', chapter }
}

function afterChapter(layout: Layout, state: RunState, chapter: number): Phase {
  if (chapter + 1 < layout.chapters.length && firstOpen(layout, state.played) < layout.ids.length) {
    return { name: 'chapter', chapter: chapter + 1 }
  }
  return { name: 'finale' }
}

export function advance(layout: Layout, state: RunState, event: RunEvent): RunState {
  const { phase } = state
  switch (event.type) {
    case 'begin':
      return phase.name === 'title' ? { ...state, phase: resume(layout, state.played) } : state
    case 'go': {
      if (phase.name !== 'chapter') return state
      const { start, items } = layout.chapters[phase.chapter]
      const index = layout.ids.slice(start, start + items.length).findIndex((id) => !state.played[id])
      return { ...state, phase: index < 0 ? { name: 'chapterEnd', chapter: phase.chapter } : { name: 'challenge', index: start + index } }
    }
    case 'answered': {
      if (phase.name !== 'challenge' || state.played[event.played.item_id]) return state
      return {
        ...state,
        played: { ...state.played, [event.played.item_id]: event.played },
        streak: event.streak,
        points: state.points + event.earned,
        phase: { name: 'reveal', index: phase.index },
      }
    }
    case 'hinted':
      return state.hinted.includes(event.itemId) ? state : { ...state, hinted: [...state.hinted, event.itemId] }
    case 'next':
      return phase.name === 'reveal' ? { ...state, phase: afterReveal(layout, state, phase.index) } : state
    case 'onward':
      return phase.name === 'chapterEnd' ? { ...state, phase: afterChapter(layout, state, phase.chapter) } : state
  }
}

/** How many of a chapter's challenges were right, of how many. */
export function chapterScore(layout: Layout, state: RunState, chapter: number): { correct: number; total: number } {
  const { start, items } = layout.chapters[chapter] ?? { start: 0, items: [] }
  const ids = layout.ids.slice(start, start + items.length)
  return { correct: ids.filter((id) => state.played[id]?.correct === true).length, total: ids.length }
}
