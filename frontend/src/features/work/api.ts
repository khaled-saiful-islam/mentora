import { apiFetch } from '@/lib/api'

export type WorkState = 'running' | 'done' | 'failed'

/** Something being made in the background — see `backend/app/services/work.py`. */
export interface WorkItem {
  id: string
  /** A learning kind ("quiz", "flashcard", "study_guide"), or "live_plan" / "live_recording". */
  kind: string
  title: string
  link: string
  state: WorkState
  /** 0 to 1. */
  progress: number
  label: string
  message: string | null
  started_at: string
  finished_at: string | null
}

export const workApi = {
  mine: () => apiFetch<{ items: WorkItem[] }>('/me/work'),
}

/** The list after one pushed change: replaced in place, or added at the top. */
export function merge(items: readonly WorkItem[], changed: WorkItem): WorkItem[] {
  return items.some((item) => item.id === changed.id)
    ? items.map((item) => (item.id === changed.id ? changed : item))
    : [changed, ...items]
}

/** A pushed message's work item, or null for anything else. */
export function workOf(message: { topic: string; work?: unknown }): WorkItem | null {
  if (message.topic !== 'work' || !message.work || typeof message.work !== 'object') return null
  const work = message.work as Partial<WorkItem>
  return typeof work.id === 'string' && typeof work.state === 'string' ? (work as WorkItem) : null
}
