/**
 * The student's side of the API: what is waiting, taking it, and how it went.
 * Shapes mirror `app/api/schemas/play.py`.
 */
import { apiFetch } from '@/lib/api'
import type { GuideExtras, GuideSection } from '@/features/learning/api'

export type PlayKind = 'quiz' | 'flashcard' | 'study_guide'
export type FeedbackMode = 'instant' | 'end'

export interface QuizItem {
  id: string
  prompt: string
  options: string[]
  skill: string
  difficulty: string
}

export interface CardItem {
  id: string
  front: string
  back: string
  hint: string
  skill: string
}

/** A guide section as a student sees it: everything but the check's answer. */
export type GuidePage = Omit<GuideSection, 'answer' | 'explanation' | 'alternatives' | 'image_query'>

export interface Reveal {
  answer?: number
  explanation?: string
}

export interface Played {
  item_id: string
  choice: number | null
  knew: boolean | null
  /** Null while the answer is being kept secret until the end. */
  correct: boolean | null
  reveal: Reveal | null
}

export interface SkillInfo {
  slug: string
  label: string
}

export interface Attempt {
  id: string
  status: 'in_progress' | 'completed'
  number: number
  title: string
  kind: PlayKind
  purpose: 'assign' | 'practice'
  feedback_mode: FeedbackMode
  assignment_id: string | null
  set_id: string
  items: (QuizItem | CardItem | GuidePage)[]
  answered: Played[]
  skills: SkillInfo[]
  /** A study guide's opening and ending; empty for other kinds. */
  extras: Partial<GuideExtras>
  /** What it is written in, e.g. `en` or `ms`. */
  language: string
  score: number
  max_score: number
  percent: number
  best_streak: number
  can_retake: boolean
  attempts_used: number
  leaderboard: boolean
  due_at: string | null
}

export interface AnswerResult {
  played: Played
  streak: number
  answered: number
  total: number
}

export interface EarnedNow {
  badge: string
  name: string
  description: string
  reason: string
}

export interface BoardEntry {
  rank: number
  student_id: string
  name: string
  buddy: string | null
  percent: number
  you: boolean
}

export interface SkillScore extends SkillInfo {
  correct: number
  total: number
}

export interface Finish {
  attempt: Attempt
  stars: number
  skills: SkillScore[]
  badges: EarnedNow[]
  rank: BoardEntry | null
  ranked: number
}

export type TodoStatus = 'todo' | 'in_progress' | 'done' | 'closed'

export interface Todo {
  assignment_id: string
  title: string
  kind: PlayKind
  class_id: string
  class_name: string
  class_theme: string
  item_count: number
  status: TodoStatus
  best: number | null
  attempts: number
  due_at: string | null
  feedback_mode: FeedbackMode
  shared_at: string
}

export interface SkillInsight {
  subject: string
  slug: string
  label: string
  correct: number
  total: number
  mastery: number
  level: 'strong' | 'growing' | 'practise'
}

/** Practice Mentora made from what the student found hard. */
export interface MadeForYou {
  set_id: string
  kind: PlayKind
  title: string
  skills: string[]
  from_title: string
  done: boolean
  created_at: string
}

export interface Home {
  todo: Todo[]
  done: Todo[]
  badges: number
  streak: number
  practise: SkillInsight[]
  strengths: SkillInsight[]
  made_for_you?: MadeForYou[]
}

export interface HistoryRow {
  attempt_id: string
  title: string
  kind: PlayKind
  purpose: 'assign' | 'practice'
  subject: string | null
  percent: number
  score: number
  max_score: number
  completed_at: string
  assignment_id: string | null
}

export interface Results {
  attempts: HistoryRow[]
  insights: { skills: SkillInsight[]; strengths: SkillInsight[]; practise: SkillInsight[] }
}

export interface Board {
  enabled: boolean
  final: boolean
  entries: BoardEntry[]
  you: BoardEntry | null
  total: number
}

export interface BadgeCatalog {
  earned: (EarnedNow & { awarded_at: string })[]
  catalog: { badge: string; name: string; description: string; hint: string }[]
}

export const playApi = {
  home: () => apiFetch<Home>('/me/home'),
  assignments: () => apiFetch<Todo[]>('/me/assignments'),
  start: (assignmentId: string) => apiFetch<Attempt>(`/me/assignments/${assignmentId}/attempts`, { method: 'POST' }),
  practise: (setId: string) => apiFetch<Attempt>(`/me/practice/${setId}/attempts`, { method: 'POST' }),
  attempt: (attemptId: string) => apiFetch<Attempt>(`/me/attempts/${attemptId}`),
  answer: (attemptId: string, body: { item_id: string; choice?: number; knew?: boolean; time_ms: number }) =>
    apiFetch<AnswerResult>(`/me/attempts/${attemptId}/answers`, { method: 'POST', body: JSON.stringify(body) }),
  complete: (attemptId: string) => apiFetch<Finish>(`/me/attempts/${attemptId}/complete`, { method: 'POST' }),
  results: () => apiFetch<Results>('/me/results'),
  badges: () => apiFetch<BadgeCatalog>('/me/badges'),
  leaderboard: (assignmentId: string) => apiFetch<Board>(`/assignments/${assignmentId}/leaderboard`),
}

export function isQuizItem(item: QuizItem | CardItem): item is QuizItem {
  return 'options' in item
}
