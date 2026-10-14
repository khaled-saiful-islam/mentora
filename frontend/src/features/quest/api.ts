/** A student's day (§28.3.4): today's quest, streak, garden and class quests. */
import { apiFetch } from '@/lib/api'

export interface DayQuest {
  set_id: string
  day: string
  questions: number
  review: number
  fresh: number
  done: boolean
}

export interface Plant {
  skill: string
  label: string
  /** Review box, 0 (found hard) … 5 (known well): how grown the plant is. */
  box: number
  mastery: number
  /** Due for review: the plant droops until a quest waters it. */
  thirsty: boolean
  due_on: string
}

export interface ClassQuest {
  class_id: string
  name: string
  theme: string
  done: number
  goal: number
  /** The Monday of this week. */
  week: string
  buddies: string[]
}

export interface MyDay {
  day: string
  quest: DayQuest | null
  streak: { days: number; freezes: number; today_done: boolean }
  garden: Plant[]
  classes: ClassQuest[]
}

export const dayApi = {
  get: () => apiFetch<MyDay>('/me/day'),
}
