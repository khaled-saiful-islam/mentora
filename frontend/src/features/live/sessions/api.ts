import { apiFetch } from '@/lib/api'
import { readSse } from '@/lib/sse'
import type { GuidePicture } from '@/features/learning/api'
import type { Beat } from '../api'

export type SessionStatus =
  | 'draft'
  | 'planning'
  | 'planned'
  | 'failed'
  | 'recording'
  | 'approved'
  | 'scheduled'
  | 'lobby'
  | 'live'
  | 'ended'
  | 'cancelled'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type Approach = 'storytelling' | 'step_by_step' | 'socratic' | 'example_heavy' | 'exam_focused'

export interface SessionSettings {
  subject: string
  topic: string
  grade_level: string
  breakdown: string[]
  difficulty: Difficulty
  approach: Approach
  custom_instruction: string
  language: 'en'
  duration_minutes: number
  questions: { mode: 'anytime' | 'pauses'; max_per_student: number }
  quiz: { enabled: boolean; count: number; difficulty: Difficulty; due_at: string | null }
  voice: { voice: string | null; speed: number | null }
}

export interface Checkin {
  question: string
  options: string[]
  answer: number
  explanation: string
}

export interface Segment {
  id: string
  position: number
  subtopic: string
  skill: string
  title: string
  beats: Beat[]
  key_points: string[]
  checkin: Checkin | null
  image: GuidePicture | null
  target_seconds: number
  status: string
}

export interface SessionDocument {
  id: string
  filename: string
  size_bytes: number
  words: number
  created_at: string
}

export interface SessionSummary {
  id: string
  title: string
  status: SessionStatus
  failure: string | null
  class_id: string
  class_name: string
  group_id: string
  group_name: string
  students: number
  /** How many parts (segments) the lesson has. */
  parts: number
  subject: string | null
  grade_level: string | null
  duration_minutes: number | null
  scheduled_at: string | null
  flagged: boolean
  started_at: string | null
  ended_at: string | null
  teacher_name: string | null
  created_at: string
}

export interface SessionDetail extends SessionSummary {
  settings: SessionSettings
  segments: Segment[]
  documents: SessionDocument[]
  voice: { voice: string; speed: number }
}

export interface Template {
  id: string
  name: string
  settings: SessionSettings
  updated_at: string
}

export type WorkEvent =
  | { type: 'stage'; label: string }
  | { type: 'part'; part: number; segments: Segment[] }
  | { type: 'recording'; done: number; total: number }
  | { type: 'done' }
  | { type: 'failed'; message: string }
  | { type: 'settled'; status: SessionStatus | 'missing'; failure: string | null }

const json = (body: unknown) => ({ body: JSON.stringify(body) })

export const sessionsApi = {
  list: () => apiFetch<{ items: SessionSummary[] }>('/live-sessions'),
  get: (id: string) => apiFetch<SessionDetail>(`/live-sessions/${id}`),
  create: (body: { class_id: string; group_id: string; settings: SessionSettings; template_id?: string | null }) =>
    apiFetch<SessionDetail>('/live-sessions', { method: 'POST', ...json(body) }),
  update: (id: string, settings: SessionSettings) =>
    apiFetch<SessionDetail>(`/live-sessions/${id}`, { method: 'PATCH', ...json({ settings }) }),
  remove: (id: string) => apiFetch<void>(`/live-sessions/${id}`, { method: 'DELETE' }),
  breakdown: (body: { subject: string; topic: string; grade_level: string; difficulty: Difficulty; session_id?: string }) =>
    apiFetch<{ parts: string[] }>('/live-sessions/breakdown', { method: 'POST', ...json(body) }),
  upload: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<SessionDocument>(`/live-sessions/${id}/documents`, { method: 'POST', body: form })
  },
  removeDocument: (id: string, documentId: string) =>
    apiFetch<void>(`/live-sessions/${id}/documents/${documentId}`, { method: 'DELETE' }),
  plan: (id: string) => apiFetch<{ status: SessionStatus }>(`/live-sessions/${id}/plan`, { method: 'POST' }),
  approve: (id: string) => apiFetch<{ status: SessionStatus }>(`/live-sessions/${id}/approve`, { method: 'POST' }),
  editSegment: (
    id: string,
    segmentId: string,
    patch: {
      title?: string
      beats?: { say: string; show: string | null; pause: Beat['pause'] }[]
      key_points?: string[]
      checkin?: Checkin
      remove_checkin?: boolean
      remove_image?: boolean
    },
  ) => apiFetch<Segment>(`/live-sessions/${id}/segments/${segmentId}`, { method: 'PATCH', ...json(patch) }),
  rewriteSegment: (id: string, segmentId: string, instruction: string) =>
    apiFetch<Segment>(`/live-sessions/${id}/segments/${segmentId}/rewrite`, { method: 'POST', ...json({ instruction }) }),
  schedule: (id: string, at: string | null) =>
    apiFetch<SessionDetail>(`/live-sessions/${id}/schedule`, { method: 'POST', ...json({ at }) }),
  cancel: (id: string) => apiFetch<SessionDetail>(`/live-sessions/${id}/cancel`, { method: 'POST' }),

  templates: () => apiFetch<{ items: Template[] }>('/live-templates'),
  saveTemplate: (name: string, settings: SessionSettings) =>
    apiFetch<Template>('/live-templates', { method: 'POST', ...json({ name, settings }) }),
  removeTemplate: (id: string) => apiFetch<void>(`/live-templates/${id}`, { method: 'DELETE' }),

  mine: () => apiFetch<{ upcoming: SessionSummary[]; past: SessionSummary[] }>('/me/live-sessions'),
}

/** The lesson being written or recorded, from its first event. */
export async function* followWork(id: string, signal: AbortSignal): AsyncGenerator<WorkEvent> {
  const response = await fetch(`/api/live-sessions/${id}/work/stream`, { signal })
  if (!response.ok || !response.body) return
  for await (const message of readSse(response.body, signal)) {
    try {
      yield JSON.parse(message.data) as WorkEvent
    } catch {
      // A keep-alive or a proxy's noise.
    }
  }
}

export const DEFAULT_SETTINGS: SessionSettings = {
  subject: '',
  topic: '',
  grade_level: 'year_5',
  breakdown: [],
  difficulty: 'intermediate',
  approach: 'storytelling',
  custom_instruction: '',
  language: 'en',
  duration_minutes: 15,
  questions: { mode: 'anytime', max_per_student: 3 },
  quiz: { enabled: true, count: 10, difficulty: 'intermediate', due_at: null },
  voice: { voice: null, speed: null },
}

export const APPROACHES: { value: Approach; label: string; blurb: string }[] = [
  { value: 'storytelling', label: 'Storytelling', blurb: 'A story carries the lesson' },
  { value: 'step_by_step', label: 'Step by step', blurb: 'One clear step at a time' },
  { value: 'socratic', label: 'Question-led', blurb: 'Wonder first, then reveal' },
  { value: 'example_heavy', label: 'Lots of examples', blurb: 'Every idea shown in real life' },
  { value: 'exam_focused', label: 'Exam-focused', blurb: 'Key words and common mistakes' },
]

export const DURATIONS = [10, 15, 20, 30, 45] as const

/** A friendly word for where a session is. */
export const STATUS_WORDS: Record<SessionStatus, string> = {
  draft: 'Draft',
  planning: 'Writing the lesson',
  planned: 'Ready to review',
  failed: 'Needs another try',
  recording: 'Recording the voice',
  approved: 'Ready to schedule',
  scheduled: 'On the schedule',
  lobby: 'Room open',
  live: 'Live now',
  ended: 'Finished',
  cancelled: 'Cancelled',
}
