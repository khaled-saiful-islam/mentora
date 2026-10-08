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
  /** A game's mission, as the game reported it (§24): reached or not, and
   *  in how many goes. */
  done?: boolean
  tries?: number
  time_ms: number
}

/** A piece of a game's story the voice can tell (§24). */
export type StoryPiece = 'hook' | 'goal' | 'win'

/** One part of an item the tutor's voice can say. */
export type Spoken =
  | { item: string; part: 'question' | 'front' | 'back' | 'hint' | 'explanation' }
  | { item: string; part: 'option'; n: number }
  | { item: StoryPiece; part: 'story'; n?: number }

export function spokenQuery(spoken: Spoken): string {
  const query = new URLSearchParams({ item: spoken.item, part: spoken.part })
  if (spoken.part === 'option') query.set('n', String(spoken.n))
  if (spoken.part === 'story' && spoken.n !== undefined) query.set('n', String(spoken.n))
  return query.toString()
}

export interface PlayBackend {
  answer: (attemptId: string, body: AnswerBody) => Promise<AnswerResult>
  /** The address of one clip in the tutor's voice. */
  speech: (attemptId: string, spoken: Spoken) => string
  /** A game's hint, which costs a few points once asked for. */
  hint: (attemptId: string, itemId: string) => Promise<string>
  /** Where a game's code is played (§24): the student's own attempt, or the
   *  set its maker is previewing. `only` replays just those missions. */
  game: (attemptId: string, only?: string[]) => string
}

/** `?only=a,b` for a replay of some missions; nothing for the whole game. */
export function onlyQuery(only?: string[]): string {
  return only && only.length ? `?${new URLSearchParams({ only: only.join(',') })}` : ''
}

const server: PlayBackend = {
  answer: playApi.answer,
  speech: (attemptId, spoken) => `/api/me/attempts/${attemptId}/speech?${spokenQuery(spoken)}`,
  hint: async (attemptId, itemId) => (await playApi.hint(attemptId, itemId)).hint,
  game: (attemptId, only) => `/api/me/attempts/${attemptId}/game${onlyQuery(only)}`,
}

const BackendContext = createContext<PlayBackend>(server)

export const PlayBackendProvider = BackendContext.Provider

export function usePlayBackend(): PlayBackend {
  return useContext(BackendContext)
}
