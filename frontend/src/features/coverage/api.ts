import { apiFetch } from '@/lib/api'

export type TopicStatus = 'untouched' | 'planned' | 'taught' | 'secure' | 'needs_work'
export type AreaStatus = 'untouched' | 'started' | 'covered' | 'secure'
export type TaughtKind = 'quiz' | 'flashcard' | 'study_guide' | 'live'

export interface SyllabusTopic {
  id: string
  title: string
}

export interface SyllabusArea {
  id: string
  title: string
  topics: SyllabusTopic[]
}

export interface TaughtItem {
  source: 'assignment' | 'live'
  id: string
  kind: TaughtKind
  title: string
  when: string
  month: string
  planned: boolean
}

export interface TopicRow {
  id: string
  title: string
  status: TopicStatus
  mastery: number | null
  items: TaughtItem[]
}

export interface AreaRow {
  id: string
  title: string
  status: AreaStatus
  mastery: number | null
  taught: number
  topics: TopicRow[]
}

export interface CoverageSummary {
  topics: number
  taught: number
  secure: number
  needs_work: number
  mastery: number | null
  items: number
  planned: number
}

export interface Coverage {
  months: string[]
  areas: AreaRow[]
  outside: TaughtItem[]
  unsorted: TaughtItem[]
  summary: CoverageSummary
  syllabus: { areas: SyllabusArea[]; made_by: 'ai' | 'teacher' | null }
  now: string
}

export interface PlanStep {
  topic_id: string
  topic: string
  area: string
  kind: TaughtKind
  title: string
  when: string
  why: string
}

export interface ReportLink {
  id: string
  student_id: string | null
  url: string
  created_at: string
}

/** What a parent sees from a report link. */
export interface PublicReport {
  class_name: string
  subject: string | null
  grade_label: string | null
  teacher_name: string
  student_name: string | null
  made_at: string
  months: string[]
  summary: CoverageSummary
  areas: {
    title: string
    status: AreaStatus
    mastery: number | null
    topics: { title: string; status: TopicStatus; mastery: number | null; items: Pick<TaughtItem, 'kind' | 'title' | 'month' | 'planned'>[] }[]
  }[]
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })
const base = (classId: string) => `/classes/${classId}/coverage`

export const coverageApi = {
  get: (classId: string) => apiFetch<Coverage>(base(classId)),
  draft: (classId: string) => apiFetch<{ areas: SyllabusArea[] }>(`${base(classId)}/syllabus/draft`, { method: 'POST' }),
  save: (classId: string, areas: SyllabusArea[]) =>
    apiFetch<{ areas: SyllabusArea[] }>(`${base(classId)}/syllabus`, { method: 'PUT', ...json({ areas }) }),
  plan: (classId: string) => apiFetch<{ steps: PlanStep[] }>(`${base(classId)}/plan`, { method: 'POST' }),
  reports: (classId: string) => apiFetch<{ items: ReportLink[] }>(`${base(classId)}/reports`),
  report: (classId: string, studentId: string | null) =>
    apiFetch<ReportLink>(`${base(classId)}/reports`, { method: 'POST', ...json({ student_id: studentId }) }),
  revoke: (classId: string, reportId: string) =>
    apiFetch<void>(`${base(classId)}/reports/${reportId}`, { method: 'DELETE' }),
  public: (token: string) => apiFetch<PublicReport>(`/reports/${encodeURIComponent(token)}`),
}

/** "Jan", "Feb" — the short name of a "2026-01" month. */
export function monthName(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, (m || 1) - 1, 1)).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
}
