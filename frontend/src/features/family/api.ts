import { apiFetch } from '@/lib/api'
import type { StudentClass } from '@/features/classes/api'

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

const json = (body: unknown) => ({ body: JSON.stringify(body) })

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
}

/** What a child calls the parent. The last choice lets them type their own. */
export const LABELS = ['Mum', 'Dad', 'Guardian'] as const
