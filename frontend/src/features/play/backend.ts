/**
 * Where a player sends its answers. For a student, the server — which marks
 * them and keeps them. For a teacher or parent previewing a set, the page
 * itself, which marks them from the answer key it already has and keeps
 * nothing. The players never know which.
 */
import { createContext, useContext } from 'react'
import { playApi, type AnswerResult } from './api'

export interface AnswerBody {
  item_id: string
  choice?: number
  knew?: boolean
  time_ms: number
}

export interface PlayBackend {
  answer: (attemptId: string, body: AnswerBody) => Promise<AnswerResult>
}

const BackendContext = createContext<PlayBackend>({ answer: playApi.answer })

export const PlayBackendProvider = BackendContext.Provider

export function usePlayBackend(): PlayBackend {
  return useContext(BackendContext)
}
