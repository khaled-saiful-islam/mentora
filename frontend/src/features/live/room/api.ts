import { apiFetch } from '@/lib/api'
import { readSse } from '@/lib/sse'
import type { SessionSummary } from '../sessions/api'

export type RoomPhase = 'lobby' | 'teaching' | 'called' | 'answering' | 'checkin' | 'paused' | 'ended'

export interface RosterEntry {
  id: string
  name: string
  buddy: string | null
  here: boolean
}

export interface ClipEvent {
  type: 'clip'
  seq: number
  key: string
  text: string
  lane: 'lesson' | 'tutor'
  /** Server epoch seconds. */
  start: number
  duration: number
  segment?: number
  step?: number
  steps?: number
  show?: string | null
}

export type RoomEvent =
  | ClipEvent
  | { type: 'snapshot'; seq: number; server_time: number; state: RoomState; roster: RosterEntry[] }
  | { type: 'phase'; seq: number; phase: RoomPhase }
  | { type: 'prefetch'; seq: number; key: string }
  | { type: 'roster'; seq: number; roster: RosterEntry[] }
  | { type: 'hands'; seq: number; queue: { id: string; student_id: string; name: string }[] }
  | { type: 'called'; seq: number; student_id: string | null; name?: string }
  | { type: 'question'; seq: number; student_id: string; name: string; text: string }
  | { type: 'checkin'; seq: number; segment_id: string; question: string; options: string[]; closes_at: number }
  | { type: 'checkin_count'; seq: number; segment_id: string; answered: number }
  | { type: 'checkin_result'; seq: number; segment_id: string; counts: number[]; answer: number; explanation: string; total: number }
  | { type: 'ended'; seq: number }
  | { type: 'quiz'; seq: number; assignment_id: string; title: string }
  | { type: 'error'; seq: number; message: string }
  | { type: 'removed'; seq: number; student_id: string }

export interface RoomState {
  phase?: RoomPhase
  clip?: ClipEvent
  segment?: number
  segments?: number
  show?: string | null
  hands?: Extract<RoomEvent, { type: 'hands' }>
  called?: Extract<RoomEvent, { type: 'called' }>
  checkin?: Extract<RoomEvent, { type: 'checkin' }>
  checkin_result?: Extract<RoomEvent, { type: 'checkin_result' }>
  quiz?: Extract<RoomEvent, { type: 'quiz' }>
  ended?: { type: 'ended' }
}

export interface Joined {
  session: SessionSummary & { segments_total: number | null }
  role: 'student' | 'teacher'
  me: { id: string; name: string }
  questions: { mode: 'anytime' | 'pauses'; left: number }
  snapshot: Extract<RoomEvent, { type: 'snapshot' }>
  quiz: { assignment_id: string; title: string } | null
  transcript: { speaker: 'tutor' | 'student' | 'system'; text: string; name: string | null }[]
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })

export const roomApi = {
  join: (id: string) => apiFetch<Joined>(`/live-rooms/${id}/join`, { method: 'POST' }),
  time: () => apiFetch<{ now: number }>('/live-rooms/time'),
  hand: (id: string) => apiFetch<{ id: string; left: number }>(`/live-rooms/${id}/hand`, { method: 'POST' }),
  lower: (id: string) => apiFetch<void>(`/live-rooms/${id}/hand`, { method: 'DELETE' }),
  ask: (id: string, text: string) => apiFetch<{ ok: boolean }>(`/live-rooms/${id}/question`, { method: 'POST', ...json({ text }) }),
  checkin: (id: string, segment_id: string, choice: number) =>
    apiFetch<{ ok: boolean }>(`/live-rooms/${id}/checkin`, { method: 'POST', ...json({ segment_id, choice }) }),
  begin: (id: string) => apiFetch<{ status: string }>(`/live-sessions/${id}/begin`, { method: 'POST' }),
  control: (id: string, action: 'pause' | 'resume' | 'skip' | 'end') =>
    apiFetch<{ paused: boolean }>(`/live-sessions/${id}/control`, { method: 'POST', ...json({ action }) }),
  clipUrl: (id: string, key: string) => `/api/live-rooms/${id}/clips/${key}`,
  remove: (id: string, studentId: string) =>
    apiFetch<void>(`/live-sessions/${id}/participants/${studentId}/remove`, { method: 'POST' }),
  dismiss: (id: string, studentId: string) => apiFetch<void>(`/live-sessions/${id}/hands/${studentId}/dismiss`, { method: 'POST' }),
  summary: (id: string) => apiFetch<Summary>(`/live-sessions/${id}/summary`),
  notes: (id: string) => apiFetch<Notes>(`/live-rooms/${id}/notes`),
}

export interface Line {
  speaker: 'tutor' | 'student' | 'system'
  name: string | null
  text: string
  at: string
}

export interface Summary {
  attendance: { student_id: string; name: string; came: boolean; joined_at: string | null; minutes: number; removed: boolean }[]
  questions: { name: string; status: string; question: string | null; answer: string | null; raised_at: string }[]
  checkins: { question: string; options: string[]; answer: number; counts: number[]; answered: number; right: number }[]
  quiz: { assignment_id: string; completed: number; average: number | null } | null
  transcript: Line[]
}

export interface Notes {
  title: string
  parts: { title: string; subtopic: string; key_points: string[] }[]
  transcript: Line[]
  quiz_assignment_id: string | null
}

/** The room's events, from `since` (or a snapshot), until the signal aborts. */
export async function* roomEvents(id: string, since: number | null, signal: AbortSignal): AsyncGenerator<RoomEvent> {
  const query = since === null ? '' : `?since=${since}`
  const response = await fetch(`/api/live-rooms/${id}/stream${query}`, { signal })
  if (!response.ok || !response.body) throw new Error(`The room could not be reached (${response.status}).`)
  for await (const message of readSse(response.body, signal)) {
    try {
      yield JSON.parse(message.data) as RoomEvent
    } catch {
      // A keep-alive or a proxy's noise.
    }
  }
}
