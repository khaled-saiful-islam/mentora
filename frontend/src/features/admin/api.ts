/** The admin console's API. Shapes mirror `api/schemas/admin.py`. */
import { apiFetch } from '@/lib/api'
import type { Role } from '@/lib/user'
import type { LearningKindName } from '@/features/learning/api'

export interface ManagedUser {
  id: string
  username: string | null
  email: string | null
  display_name: string | null
  role: Role
  grade_level: string | null
  is_admin: boolean
  is_active: boolean
  daily_token_limit: number | null
  tokens_used_24h: number
  created_at: string
}

export interface UserPage {
  items: ManagedUser[]
  total: number
}

export interface Footprint {
  classes: number
  learning_sets: number
  conversations: number
  attempts: number
  students: number
}

export interface TemporaryPassword {
  sign_in_name: string
  password: string
}

export interface Overview {
  users: Record<'total' | 'admins' | 'teachers' | 'students' | 'suspended' | 'new_7d' | 'active_7d', number>
  learning: {
    classes: number
    memberships: number
    sets: number
    practice_sets: number
    assignments: number
    attempts_7d: number
    average_7d: number | null
  }
  tokens_24h: number
  safety: Record<'low' | 'medium' | 'high' | 'open', number>
  trend: { day: string; attempts: number; messages: number; signups: number }[]
}

export interface PersonRef {
  id: string
  name: string
  role: Role
  grade_label: string | null
}

export type ModerationStatus = 'open' | 'reviewed' | 'dismissed'
export type Severity = 'low' | 'medium' | 'high'

export interface ModerationItem {
  id: string
  kind: string
  source: string
  category: string
  severity: Severity
  rule: string
  screen: string
  excerpt: string
  status: ModerationStatus
  note: string
  created_at: string
  reviewed_at: string | null
  conversation_id: string | null
  set_id: string | null
  user: PersonRef | null
}

export interface ContentArtifact {
  id: string
  kind: string
  title: string
  owner: PersonRef
  version: number
  created_at: string
  updated_at: string
}

export interface ContentSet {
  id: string
  kind: LearningKindName
  purpose: 'assign' | 'practice'
  title: string
  topic: string
  subject: string | null
  grade_label: string | null
  status: string
  owner: PersonRef
  item_count: number
  shares: number
  created_at: string
}

export interface ContentSetDetail extends ContentSet {
  items: Record<string, unknown>[]
}

export interface NewUser {
  role: Role
  display_name: string
  email?: string
  username?: string
  grade_level?: string
  password: string
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })
const query = (params: Record<string, string | number | null | undefined>) => {
  const pairs = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
  return pairs.length ? `?${new URLSearchParams(pairs.map(([k, v]) => [k, String(v)]))}` : ''
}

export const adminApi = {
  overview: () => apiFetch<Overview>('/admin/overview'),
  users: (params: { q?: string; role?: string; status?: string; offset?: number }) =>
    apiFetch<UserPage>(`/admin/users${query(params)}`),
  create: (draft: NewUser) => apiFetch<ManagedUser>('/admin/users', { method: 'POST', ...json(draft) }),
  update: (id: string, patch: Record<string, unknown>) =>
    apiFetch<ManagedUser>(`/admin/users/${id}`, { method: 'PATCH', ...json(patch) }),
  footprint: (id: string) => apiFetch<Footprint>(`/admin/users/${id}/footprint`),
  remove: (id: string, confirm: string) =>
    apiFetch<void>(`/admin/users/${id}${query({ confirm })}`, { method: 'DELETE' }),
  resetPassword: (id: string) => apiFetch<TemporaryPassword>(`/admin/users/${id}/password`, { method: 'POST' }),
  moderation: (params: { status?: string; severity?: string; kind?: string; before?: string }) =>
    apiFetch<{ items: ModerationItem[]; counts: Record<Severity, number> }>(`/admin/moderation${query(params)}`),
  review: (id: string, status: ModerationStatus, note = '') =>
    apiFetch<ModerationItem>(`/admin/moderation/${id}`, { method: 'PATCH', ...json({ status, note }) }),
  artifacts: (params: { q?: string; kind?: string; before?: string }) =>
    apiFetch<ContentArtifact[]>(`/admin/content/artifacts${query(params)}`),
  sets: (params: { q?: string; kind?: string; purpose?: string; before?: string }) =>
    apiFetch<ContentSet[]>(`/admin/content/sets${query(params)}`),
  set: (id: string) => apiFetch<ContentSetDetail>(`/admin/content/sets/${id}`),
  artifactUrl: (id: string) => `/api/admin/content/artifacts/${id}/raw`,
}

/** What to call an account in a list. */
export const nameOfUser = (u: Pick<ManagedUser, 'display_name' | 'username' | 'email'>): string =>
  u.display_name || u.username || u.email || 'Someone'

/** What they type to sign in: a student's username, anyone else's email. */
export const signInOf = (u: Pick<ManagedUser, 'username' | 'email'>): string => u.username || u.email || ''
