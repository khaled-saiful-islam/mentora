/**
 * A parent and their child's teacher writing to each other
 * (`docs/features/048-parent-teacher-messages.md`). The server's gate decides
 * who may; a closed conversation simply is not there.
 */
import { apiFetch } from '@/lib/api'

export interface Contact {
  student_id: string
  student_name: string
  person_id: string
  person_name: string
  /** To a parent, "Teacher"; to a teacher, what the child calls this parent. */
  relation: string
  class_ids: string[]
  class_names: string[]
}

export interface Message {
  id: string
  thread_id: string
  body: string
  mine: boolean
  created_at: string
}

export interface Thread {
  id: string
  side: 'parent' | 'teacher'
  contact: Contact
  unread: number
  last: Message | null
  last_message_at: string | null
}

/** A teacher's student whose family has not connected yet. */
export interface Waiting {
  student_id: string
  student_name: string
  class_ids: string[]
  class_names: string[]
}

export interface Inbox {
  threads: Thread[]
  contacts: Contact[]
  /** For a teacher: who could be asked to connect a parent. */
  waiting?: Waiting[]
  unread: number
}

export interface MessagePage {
  items: Message[]
  has_more: boolean
}

/** The server's own limit, so the composer can say so before sending. */
export const MAX_BODY = 2000

export const messagesApi = {
  inbox: () => apiFetch<Inbox>('/messages'),
  unread: () => apiFetch<{ unread: number }>('/messages/unread'),
  open: (studentId: string, personId: string) =>
    apiFetch<Thread>('/messages/threads', { method: 'POST', body: JSON.stringify({ student_id: studentId, person_id: personId }) }),
  thread: (id: string) => apiFetch<Thread>(`/messages/threads/${id}`),
  messages: (id: string, before?: string) =>
    apiFetch<MessagePage>(`/messages/threads/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`),
  send: (id: string, body: string) =>
    apiFetch<Message>(`/messages/threads/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  read: (id: string) => apiFetch<{ unread: number }>(`/messages/threads/${id}/read`, { method: 'POST' }),
  /** A teacher asking a student to connect a parent; false if already asked today. */
  askFamily: (studentId: string) =>
    apiFetch<{ sent: boolean }>('/messages/ask-family', { method: 'POST', body: JSON.stringify({ student_id: studentId }) }),
}

/** "Cikgu Demo · 4 Cerdik" for a parent; "Nora (Mum) · about Aina" for a teacher. */
export function whoLine(thread: Pick<Thread, 'side' | 'contact'>): string {
  const c = thread.contact
  return thread.side === 'parent' ? [c.relation, ...c.class_names].join(' · ') : `${c.relation} · about ${c.student_name}`
}
