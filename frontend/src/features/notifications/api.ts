import { apiFetch } from '@/lib/api'

export interface Notification {
  id: string
  type: string
  payload: Record<string, unknown>
  count: number
  read: boolean
  created_at: string
  updated_at: string
}

export interface NotificationPage {
  items: Notification[]
  next_cursor: string | null
  unread: number
}

export const notificationsApi = {
  page: (cursor?: string) =>
    apiFetch<NotificationPage>(`/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  unread: () => apiFetch<{ unread: number }>('/notifications/unread-count'),
  read: (id: string) => apiFetch<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => apiFetch<{ unread: number }>('/notifications/read-all', { method: 'POST' }),
}
