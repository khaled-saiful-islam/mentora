/**
 * Where a player sends its answers. For a student, the server — which marks
 * them and keeps them. For a teacher or parent previewing a set, the page
 * itself, which marks them from the answer key it already has and keeps
 * nothing. The players never know which.
 *
 * It also says where "Read it to me" gets each clip, and where the pictures
 * beside the questions come from: the student's attempt, or the set being
 * previewed.
 */
import { createContext, useContext } from 'react'
import { apiFetch } from '@/lib/api'
import { playApi, type AnswerResult } from './api'
import type { ItemPictures } from './pictures'

export interface AnswerBody {
  item_id: string
  choice?: number
  knew?: boolean
  time_ms: number
}

/** One part of an item the tutor's voice can say. */
export type Spoken = { item: string; part: 'question' | 'front' | 'back' } | { item: string; part: 'option'; n: number }

export function spokenQuery(spoken: Spoken): string {
  const query = new URLSearchParams({ item: spoken.item, part: spoken.part })
  if (spoken.part === 'option') query.set('n', String(spoken.n))
  return query.toString()
}

export interface PlayBackend {
  answer: (attemptId: string, body: AnswerBody) => Promise<AnswerResult>
  /** The address of one clip in the tutor's voice. */
  speech: (attemptId: string, spoken: Spoken) => string
  /** The pictures beside the questions, found so far. */
  pictures: (attemptId: string) => Promise<ItemPictures>
}

const server: PlayBackend = {
  answer: playApi.answer,
  speech: (attemptId, spoken) => `/api/me/attempts/${attemptId}/speech?${spokenQuery(spoken)}`,
  pictures: (attemptId) => apiFetch<ItemPictures>(`/me/attempts/${attemptId}/pictures`),
}

const BackendContext = createContext<PlayBackend>(server)

export const PlayBackendProvider = BackendContext.Provider

export function usePlayBackend(): PlayBackend {
  return useContext(BackendContext)
}
