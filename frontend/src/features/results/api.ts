/** A teacher's view of how an assignment went. Mirrors `api/routes/results.py`. */
import { apiFetch } from '@/lib/api'
import type { PlayKind, SkillInfo } from '@/features/play/api'

export type StudentStatus = 'not_started' | 'in_progress' | 'completed'

export interface StudentResult {
  student_id: string
  name: string
  buddy: string | null
  status: StudentStatus
  /** The first finished try — the one that counts. */
  first: number | null
  best: number | null
  attempts: number
  late: boolean
  completed_at: string | null
}

export interface QuestionResult {
  item_id: string
  prompt: string
  skill: string
  answered: number
  correct: number
  /** How many chose each option, in the question's own order. */
  choices: number[]
  answer: number | null
}

export interface AssignmentResults {
  assignment: { id: string; class_id: string; title: string; kind: PlayKind; due_at: string | null; closed: boolean; leaderboard: boolean }
  summary: {
    assigned: number
    completed: number
    in_progress: number
    not_started: number
    average: number | null
    median: number | null
    distribution: number[]
  }
  students: StudentResult[]
  questions: QuestionResult[]
  skills: SkillInfo[]
  /** student id → skill slug → share right, 0 … 1 */
  heat: Record<string, Record<string, number>>
}

export interface StudentDrill {
  items: Record<string, unknown>[]
  attempts: {
    id: string
    number: number
    status: string
    percent: number
    completed_at: string | null
    answers: { item_id: string; response: { choice?: number; knew?: boolean }; correct: boolean; time_ms: number }[]
  }[]
}

export const resultsApi = {
  forAssignment: (id: string, groupId?: string | null) =>
    apiFetch<AssignmentResults>(`/assignments/${id}/results${groupId ? `?group_id=${groupId}` : ''}`),
  student: (id: string, studentId: string) => apiFetch<StudentDrill>(`/assignments/${id}/results/students/${studentId}`),
}

/** Mastery as a colour band: the same three levels the student sees. */
export function band(share: number): 'strong' | 'growing' | 'practise' {
  if (share >= 0.8) return 'strong'
  return share >= 0.5 ? 'growing' : 'practise'
}
