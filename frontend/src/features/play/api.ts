/**
 * The student's side of the API: what is waiting, taking it, and how it went.
 * Shapes mirror `app/api/schemas/play.py`.
 */
import { apiFetch } from '@/lib/api'
import type { Contents, Play } from '@/features/game/rounds/types'
import type { GameExtras, GuideExtras, GuideSection, Level, SetPurpose } from '@/features/learning/api'

export type PlayKind = 'quiz' | 'flashcard' | 'study_guide' | 'game'
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

/** A game's island as a student meets it (§26): the idea, what to do, and
 *  its round — with what each move needs, because a round is answered on the
 *  device. Not its hint (asking costs points) nor what it teaches. */
export interface GameIsland extends Partial<Contents> {
  id: string
  learn: string
  icon: string
  play: Play
  task: string
  has_hint: boolean
  skill: string
  difficulty: string
}

/** A guide section as a student sees it: everything but the check's answer. */
export type GuidePage = Omit<GuideSection, 'answer' | 'explanation' | 'alternatives' | 'image_query'>

export interface Reveal {
  answer?: number
  explanation?: string
  /** A game island's task, said again beside what it taught. */
  task?: string
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
  purpose: SetPurpose
  feedback_mode: FeedbackMode
  assignment_id: string | null
  set_id: string
  items: (QuizItem | CardItem | GuidePage | GameIsland)[]
  answered: Played[]
  skills: SkillInfo[]
  /** A study guide's opening and ending, or a game's story and world. */
  extras: Partial<GuideExtras> & Partial<GameExtras>
  /** What it is written in, e.g. `en` or `ms`. */
  language: string
  /** The year the set was written for, e.g. `year_2` — how it looks when the
   *  student's own year is not known. */
  grade_level?: string | null
  /** A game's level, the seconds each challenge's timer runs (none for
   *  beginners), its points once finished, and the best so far (§23). */
  level?: Level | null
  timer_seconds?: number | null
  points?: number | null
  best_points?: number | null
  score: number
  max_score: number
  percent: number
  best_streak: number
  can_retake: boolean
  attempts_used: number
  leaderboard: boolean
  due_at: string | null
  /** A second chance after a wrong answer (§28.3.7): off in a teacher's test,
   *  a quiz marked at the end, and a preview. */
  second_chance?: boolean
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
  /** A game's best points (§23); null on a quiz's board. */
  points?: number | null
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

/** Something a parent sent home (§20.4). */
export interface HomeWork {
  share_id: string
  set_id: string
  title: string
  kind: PlayKind
  item_count: number
  parent_id: string
  /** What the child calls whoever sent it: "Mum". */
  label: string
  parent_name: string
  status: Exclude<TodoStatus, 'closed'>
  best: number | null
  attempts: number
  due_at: string | null
  shared_at: string
  review_attempt_id: string | null
}

/** A set of the student's own to practise: made for them, or made by them
 *  before students stopped making sets. */
export interface MyPractice {
  id: string
  kind: PlayKind
  title: string
  item_count: number
  updated_at: string
  best: number | null
  tries: number
  made_for_you: boolean
}

export interface Home {
  from_home?: HomeWork[]
  todo: Todo[]
  done: Todo[]
  badges: number
  streak: number
  practise: SkillInsight[]
  strengths: SkillInsight[]
  made_for_you?: MadeForYou[]
  /** Unfinished class work by class, with the topic the class is on. */
  keep_up?: KeepUp[]
}

export interface KeepUp {
  class_id: string
  name: string
  items: { assignment_id: string; title: string; kind: string; topic: string | null; due_at: string | null }[]
}

export interface HistoryRow {
  attempt_id: string
  title: string
  kind: PlayKind
  purpose: SetPurpose
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
  /** How it ranks: a quiz's first tries, or a game's best points (§23). */
  ranking?: 'first_try' | 'best_points'
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
  practice: () => apiFetch<{ items: MyPractice[] }>('/me/practice'),
  fromHome: (shareId: string) => apiFetch<Attempt>(`/me/from-home/${shareId}/attempts`, { method: 'POST' }),
  attempt: (attemptId: string) => apiFetch<Attempt>(`/me/attempts/${attemptId}`),
  answer: (attemptId: string, body: { item_id: string; choice?: number; knew?: boolean; done?: boolean; tries?: number; shown?: boolean; slips?: string[]; time_ms: number }) =>
    apiFetch<AnswerResult>(`/me/attempts/${attemptId}/answers`, { method: 'POST', body: JSON.stringify(body) }),
  complete: (attemptId: string) => apiFetch<Finish>(`/me/attempts/${attemptId}/complete`, { method: 'POST' }),
  /** A game's hint from the buddy. Asking costs a few points. */
  hint: (attemptId: string, itemId: string) =>
    apiFetch<{ hint: string }>(`/me/attempts/${attemptId}/items/${encodeURIComponent(itemId)}/hint`, { method: 'POST' }),
  guideQuiz: (attemptId: string) => apiFetch<{ set_id: string; title: string }>(`/me/attempts/${attemptId}/guide-quiz`, { method: 'POST' }),
  whyLeft: () => apiFetch<{ left: number }>('/me/why'),
  explainWhy: (attemptId: string, itemId: string, words: string) =>
    apiFetch<{ verdict: 'spot_on' | 'nearly' | 'not_yet' | null; feedback: string }>(`/me/attempts/${attemptId}/items/${encodeURIComponent(itemId)}/why`, {
      method: 'POST',
      body: JSON.stringify({ words }),
    }),
  hear: (attemptId: string, itemId: string, line: number, wav: Blob) => {
    const form = new FormData()
    form.append('line', String(line))
    form.append('clip', wav, 'reading.wav')
    return apiFetch<{ text: string }>(`/me/attempts/${attemptId}/items/${encodeURIComponent(itemId)}/hear`, { method: 'POST', body: form })
  },
  results: () => apiFetch<Results>('/me/results'),
  badges: () => apiFetch<BadgeCatalog>('/me/badges'),
  leaderboard: (assignmentId: string) => apiFetch<Board>(`/assignments/${assignmentId}/leaderboard`),
}

export function isQuizItem(item: QuizItem | CardItem): item is QuizItem {
  return 'options' in item
}
