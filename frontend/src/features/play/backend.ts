/**
 * Where a player sends its answers. For a student, the server — which marks
 * them and keeps them. For a teacher or parent previewing a set, the page
 * itself, which marks them from the answer key it already has and keeps
 * nothing. The players never know which.
 *
 * It also says where "Read it to me" gets each clip: the student's attempt,
 * or the set being previewed.
 */
import { createContext, useContext } from 'react'
import { playApi, type AnswerResult } from './api'

export interface AnswerBody {
  item_id: string
  choice?: number
  knew?: boolean
  /** A game's island, as its round reported it (§26): cleared or not, and
   *  in how many goes — one, and one more for each slip. */
  done?: boolean
  tries?: number
  /** Cleared after "Show me" (§25): the buddy played a move. */
  shown?: boolean
  /** The pieces put in the wrong place on the way, by id. */
  slips?: string[]
  time_ms: number
}

/** A piece of a game's story the voice can tell (§25): narration, or a line
 *  of the opening or ending panel by its number. */
export type StoryPiece = 'hook' | 'goal' | 'win' | 'opening' | 'ending'

/** One part of an item the tutor's voice can say. */
export type Spoken =
  | { item: string; part: 'question' | 'front' | 'back' | 'hint' | 'explanation' | 'learn' | 'task' }
  /** A line of the story panel before or after a game's island. */
  | { item: string; part: 'before' | 'after'; n: number }
  /** A game round's piece, or why it goes where it does, by its number
   *  (`piecesOf` in `features/game/rounds`). */
  | { item: string; part: 'option' | 'piece' | 'why'; n: number }
  | { item: StoryPiece; part: 'story'; n?: number }

const NUMBERED = new Set(['option', 'before', 'after', 'piece', 'why'])

export function spokenQuery(spoken: Spoken): string {
  const query = new URLSearchParams({ item: spoken.item, part: spoken.part })
  if (NUMBERED.has(spoken.part) && 'n' in spoken && spoken.n !== undefined) query.set('n', String(spoken.n))
  if (spoken.part === 'story' && spoken.n !== undefined) query.set('n', String(spoken.n))
  return query.toString()
}

export interface PlayBackend {
  answer: (attemptId: string, body: AnswerBody) => Promise<AnswerResult>
  /** The address of one clip in the tutor's voice. */
  speech: (attemptId: string, spoken: Spoken) => string
  /** A game's hint, which costs a few points once asked for. */
  hint: (attemptId: string, itemId: string) => Promise<string>
  /** The quiz a finished study guide unlocks (§28.3.8). None in a preview:
   *  there is no student to keep it for. */
  guideQuiz?: (attemptId: string) => Promise<{ set_id: string; title: string }>
}

const server: PlayBackend = {
  answer: playApi.answer,
  speech: (attemptId, spoken) => `/api/me/attempts/${attemptId}/speech?${spokenQuery(spoken)}`,
  hint: async (attemptId, itemId) => (await playApi.hint(attemptId, itemId)).hint,
  guideQuiz: playApi.guideQuiz,
}

const BackendContext = createContext<PlayBackend>(server)

export const PlayBackendProvider = BackendContext.Provider

export function usePlayBackend(): PlayBackend {
  return useContext(BackendContext)
}
