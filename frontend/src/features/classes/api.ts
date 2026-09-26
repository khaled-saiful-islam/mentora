/**
 * The classes API, typed. One function per endpoint so a component never
 * builds a URL itself.
 */
import { apiFetch } from '@/lib/api'
import type { ThemeKey } from '@/lib/palette'

export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'left'

export interface ClassRoom {
  id: string
  name: string
  subject: string | null
  grade_level: string | null
  grade_label: string | null
  description: string | null
  theme: ThemeKey
  archived: boolean
  students: number
  pending: number
  groups: number
  created_at: string
  /** Only on the class list. */
  pulse?: TeacherPulse | null
}

export interface ClassDraft {
  name: string
  subject?: string | null
  grade_level?: string | null
  description?: string | null
  theme?: ThemeKey
}

export interface Invite {
  token: string
  code: string
  enabled: boolean
  expires_at: string | null
  path: string
}

export interface Member {
  membership_id: string
  student_id: string
  name: string
  username: string | null
  grade_label: string | null
  buddy: string | null
  status: MembershipStatus
  requested_at: string
}

export interface MemberPage {
  items: Member[]
  total: number
  limit: number
  offset: number
}

export interface Group {
  id: string
  name: string
  colour: ThemeKey
  member_ids: string[]
}

export interface InvitePreview {
  class_id: string
  class_name: string
  subject: string | null
  grade_label: string | null
  theme: ThemeKey
  teacher_name: string
}

export interface JoinResult {
  status: 'requested' | 'pending' | 'member'
  invite: InvitePreview
}

/** The next live lesson in a class: coming up, or on now. */
export interface NextLive {
  id: string
  title: string
  scheduled_at: string | null
  status: 'scheduled' | 'lobby' | 'live'
}

/** A class card at a glance, for its teacher. */
export interface TeacherPulse {
  shared: number
  average: number | null
  finished_week: number
  next_live: NextLive | null
  faces: string[]
}

/** A class card at a glance, for a student in it. */
export interface StudentPulse {
  to_do: number
  done: number
  next_live: NextLive | null
}

export interface StudentClass {
  class_id: string
  class_name: string
  subject: string | null
  theme: ThemeKey
  teacher_name: string
  status: MembershipStatus
  groups: string[]
  pulse?: StudentPulse | null
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })

export const classesApi = {
  list: (archived = false) =>
    apiFetch<{ items: ClassRoom[] }>(`/classes${archived ? '?archived=true' : ''}`),
  create: (draft: ClassDraft) => apiFetch<ClassRoom>('/classes', { method: 'POST', ...json(draft) }),
  get: (id: string) => apiFetch<ClassRoom>(`/classes/${id}`),
  update: (id: string, patch: Partial<ClassDraft>) =>
    apiFetch<ClassRoom>(`/classes/${id}`, { method: 'PATCH', ...json(patch) }),
  archive: (id: string) => apiFetch<void>(`/classes/${id}`, { method: 'DELETE' }),
  restore: (id: string) => apiFetch<ClassRoom>(`/classes/${id}/restore`, { method: 'POST' }),

  invite: (id: string) => apiFetch<Invite>(`/classes/${id}/invite`),
  rotateInvite: (id: string) => apiFetch<Invite>(`/classes/${id}/invite/rotate`, { method: 'POST' }),
  configureInvite: (
    id: string,
    patch: { enabled?: boolean; expires_at?: string | null; clear_expiry?: boolean },
  ) => apiFetch<Invite>(`/classes/${id}/invite`, { method: 'PATCH', ...json(patch) }),

  members: (id: string, params: { status?: MembershipStatus; q?: string; offset?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.q) query.set('q', params.q)
    if (params.offset) query.set('offset', String(params.offset))
    const suffix = query.toString() ? `?${query}` : ''
    return apiFetch<MemberPage>(`/classes/${id}/members${suffix}`)
  },
  approve: (id: string, membershipId: string) =>
    apiFetch<void>(`/classes/${id}/members/${membershipId}/approve`, { method: 'POST' }),
  reject: (id: string, membershipId: string) =>
    apiFetch<void>(`/classes/${id}/members/${membershipId}/reject`, { method: 'POST' }),
  approveAll: (id: string) =>
    apiFetch<{ approved: number }>(`/classes/${id}/members/approve-all`, { method: 'POST' }),
  revoke: (id: string, membershipId: string) =>
    apiFetch<void>(`/classes/${id}/members/${membershipId}`, { method: 'DELETE' }),
  /** A new temporary password for a student in this class, shown once. */
  resetPassword: (id: string, membershipId: string) =>
    apiFetch<{ sign_in_name: string; password: string }>(`/classes/${id}/members/${membershipId}/password`, {
      method: 'POST',
    }),

  groups: (id: string) => apiFetch<{ items: Group[] }>(`/classes/${id}/groups`),
  createGroup: (id: string, name: string, colour: ThemeKey) =>
    apiFetch<Group>(`/classes/${id}/groups`, { method: 'POST', ...json({ name, colour }) }),
  updateGroup: (id: string, groupId: string, patch: { name?: string; colour?: ThemeKey }) =>
    apiFetch<Group>(`/classes/${id}/groups/${groupId}`, { method: 'PATCH', ...json(patch) }),
  deleteGroup: (id: string, groupId: string) =>
    apiFetch<void>(`/classes/${id}/groups/${groupId}`, { method: 'DELETE' }),
  setGroupMembers: (id: string, groupId: string, studentIds: string[]) =>
    apiFetch<Group>(`/classes/${id}/groups/${groupId}/members`, {
      method: 'PUT',
      ...json({ student_ids: studentIds }),
    }),

  previewInvite: (key: string) => apiFetch<InvitePreview>(`/invites/${encodeURIComponent(key)}`),
  join: (key: string) =>
    apiFetch<JoinResult>(`/invites/${encodeURIComponent(key)}/join`, { method: 'POST' }),
  mine: () => apiFetch<{ items: StudentClass[] }>('/me/classes'),
  leave: (classId: string) => apiFetch<void>(`/me/classes/${classId}/leave`, { method: 'POST' }),
}
