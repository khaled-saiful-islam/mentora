/**
 * Second chance, at your level (§28.3.7): after a wrong answer, the question
 * explained at a reading level with a worked example, then one like it to try.
 */
import { apiFetch } from '@/lib/api'
import type { ReadingLevel } from '@/features/learning/api'

export interface Explanation {
  level: ReadingLevel
  why: string
  example: { problem: string; steps: string[]; answer: string } | null
  remember: string | null
  /** False when it could not be written just now: the question's own note. */
  written: boolean
}

export interface Twin {
  prompt: string
  options: string[]
  /** Set once tried. */
  choice: number | null
  correct: boolean | null
  answer: number | null
  explanation: string | null
  /** The buddy grew from getting it right. */
  grew: boolean
}

const base = (attemptId: string, itemId: string) => `/me/attempts/${attemptId}/items/${encodeURIComponent(itemId)}`

export const secondChanceApi = {
  explain: (attemptId: string, itemId: string, level: ReadingLevel) =>
    apiFetch<Explanation>(`${base(attemptId, itemId)}/explain?level=${level}`),
  twin: (attemptId: string, itemId: string) => apiFetch<{ twin: Twin | null }>(`${base(attemptId, itemId)}/twin`, { method: 'POST' }),
  tryTwin: (attemptId: string, itemId: string, choice: number) =>
    apiFetch<{ twin: Twin }>(`${base(attemptId, itemId)}/twin/answer`, { method: 'POST', body: JSON.stringify({ choice }) }),
}
