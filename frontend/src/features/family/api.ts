import { apiFetch } from '@/lib/api'
import type { StudentClass } from '@/features/classes/api'
import type { PublicReport } from '@/features/coverage/api'
import type { SetSummary } from '@/features/learning/api'
import type { SessionSummary } from '@/features/live/sessions/api'
import type { Attempt, HistoryRow, HomeWork, MadeForYou, Results, SkillInsight, Todo } from '@/features/play/api'

/** A child's invitation: a link to send and a code to type. */
export interface FamilyInvite {
  code: string
  url: string
  enabled: boolean
  expires_at: string
}

export interface ConnectedParent {
  name: string
  label: string
  linked_at: string
}

export interface MyFamily {
  invite: FamilyInvite
  parents: ConnectedParent[]
}

/** A child, as their parent sees them. */
export interface Child {
  id: string
  name: string
  first_name: string
  buddy: string | null
  grade_label: string | null
  label: string
  linked_at: string
}

export interface InvitePreview {
  first_name: string
  buddy: string | null
}

/** A child's week at a glance, as their parent sees it. */
export interface ChildOverview {
  todo: Todo[]
  done: Todo[]
  badges: number
  streak: number
  practise: SkillInsight[]
  strengths: SkillInsight[]
  latest: HistoryRow[]
  upcoming: SessionSummary[]
  made_for_you: MadeForYou[]
  /** What any of the child's parents sent home. */
  from_home: HomeWork[]
}

/** A piece of work, with the finished try to open for its answers. */
export interface ChildWork extends Todo {
  review_attempt_id: string | null
}

export interface ChildPractice extends SetSummary {
  best: number | null
  tries: number
  made_for_you: boolean
}

export interface ChildSchedule {
  upcoming: SessionSummary[]
  past: (SessionSummary & { attended: boolean })[]
}

export interface LessonNotes {
  title: string
  parts: { title: string; subtopic: string; key_points: string[] }[]
}

/** Who a set has been sent home to. */
export interface SentHome {
  id: string
  student_id: string
  first_name: string
  version: number
  due_at: string | null
  shared_at: string
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })
const child = (id: string) => `/me/children/${id}`

export const sendHomeApi = {
  send: (setId: string, studentIds: string[], dueAt: string | null) =>
    apiFetch<{ items: SentHome[] }>('/family-shares', { method: 'POST', ...json({ set_id: setId, student_ids: studentIds, due_at: dueAt }) }),
  of: (setId: string) => apiFetch<{ items: SentHome[] }>(`/family-shares?set_id=${encodeURIComponent(setId)}`),
  takeBack: (shareId: string) => apiFetch<void>(`/family-shares/${shareId}`, { method: 'DELETE' }),
}

/** A piece of work sent home, in the shape the work rows read — its
 *  "class" is who sent it. */
export function homeAsWork(work: HomeWork, from = `From ${work.label}`): ChildWork {
  return {
    assignment_id: work.share_id,
    title: work.title,
    kind: work.kind,
    class_id: '',
    class_name: from,
    class_theme: 'grape',
    item_count: work.item_count,
    status: work.status,
    best: work.best,
    attempts: work.attempts,
    due_at: work.due_at,
    feedback_mode: 'instant',
    shared_at: work.shared_at,
    review_attempt_id: work.review_attempt_id,
  }
}

export const familyApi = {
  // The child's side.
  mine: () => apiFetch<MyFamily>('/me/family'),
  rotate: () => apiFetch<FamilyInvite>('/me/family/invite/rotate', { method: 'POST' }),
  toggle: (enabled: boolean) => apiFetch<FamilyInvite>('/me/family/invite', { method: 'PATCH', ...json({ enabled }) }),
  // A parent with an invitation.
  preview: (key: string) => apiFetch<InvitePreview>(`/family/invites/${encodeURIComponent(key)}`),
  connect: (key: string, label: string) => apiFetch<Child>('/family/connect', { method: 'POST', ...json({ key, label }) }),
  // The parent's side.
  children: () => apiFetch<{ items: Child[] }>('/me/children'),
  classes: (childId: string) => apiFetch<{ items: StudentClass[] }>(`/me/children/${childId}/classes`),
  disconnect: (childId: string) => apiFetch<void>(`/me/children/${childId}`, { method: 'DELETE' }),
  // One child, everything they do — read-only.
  overview: (childId: string) => apiFetch<ChildOverview>(`${child(childId)}/overview`),
  work: (childId: string) => apiFetch<{ items: ChildWork[]; from_home: HomeWork[] }>(`${child(childId)}/work`),
  results: (childId: string) => apiFetch<Results>(`${child(childId)}/results`),
  practice: (childId: string) => apiFetch<{ items: ChildPractice[] }>(`${child(childId)}/practice`),
  schedule: (childId: string) => apiFetch<ChildSchedule>(`${child(childId)}/schedule`),
  notes: (childId: string, sessionId: string) => apiFetch<LessonNotes>(`${child(childId)}/schedule/${sessionId}/notes`),
  attempt: (childId: string, attemptId: string) => apiFetch<Attempt>(`${child(childId)}/attempts/${attemptId}`),
  coverage: (childId: string, classId: string) => apiFetch<PublicReport>(`${child(childId)}/classes/${classId}/coverage`),
}

/** What a child calls the parent. The last choice lets them type their own. */
export const LABELS = ['Mum', 'Dad', 'Guardian'] as const
