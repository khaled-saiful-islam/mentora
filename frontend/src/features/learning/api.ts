import { apiFetch } from '@/lib/api'

export type LearningKindName = 'quiz' | 'flashcard' | 'study_guide'
export type SetStatus = 'generating' | 'ready' | 'failed' | 'refused'

export interface QuizItem {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
  skill: string
  difficulty: 'easy' | 'medium' | 'hard'
  source_ids: string[]
}

export interface FlashcardItem {
  id: string
  front: string
  back: string
  hint: string
  skill: string
  source_ids: string[]
}

/** A picture found for a section, with the page it came from for credit. */
export interface GuidePicture {
  image: string
  thumbnail: string
  page: string
  source: string
  title: string
}

export interface GuideTerm {
  term: string
  meaning: string
  /** The word in Bahasa Melayu — or English when the guide is in Malay. */
  translation: string
}

export type ReadingLevel = 'simple' | 'core' | 'stretch'

/** One section of a study guide: the teaching at three levels, what helps it
 *  stick, a picture, and a check question graded like a quiz's. */
export interface GuideSection {
  id: string
  heading: string
  explain: Record<ReadingLevel, string>
  points: string[]
  terms: GuideTerm[]
  hook: string
  fact: string
  example: string
  image_query: string
  image: GuidePicture | null
  alternatives: GuidePicture[]
  prompt: string
  options: string[]
  answer: number
  explanation: string
  skill: string
  difficulty: 'easy' | 'medium' | 'hard'
  source_ids: string[]
}

/** What a study guide has besides its sections. */
export interface GuideExtras {
  big_question: string
  intro: string
  summary: string[]
  challenge: { title: string; steps: string[] } | null
}

export type Item = QuizItem | FlashcardItem | GuideSection

export interface Skill {
  slug: string
  label: string
}

export interface Source {
  id: string
  title: string
  url: string
  host: string
  excerpt?: string
  published?: string
}

export interface SetSummary {
  id: string
  kind: LearningKindName
  purpose: 'assign' | 'practice'
  title: string
  subject: string | null
  topic: string
  grade_level: string | null
  grade_label: string | null
  language: string
  status: SetStatus
  failure: string | null
  item_count: number
  requested_count: number
  version: number
  grounded: boolean
  shares: number
  archived: boolean
  updated_at: string
}

export interface SetDetail extends SetSummary {
  items: Item[]
  skills: Skill[]
  sources: Source[]
  /** Empty for kinds without extras. */
  extras: Partial<GuideExtras>
}

export interface GenerateDraft {
  kind: LearningKindName
  topic: string
  subject?: string | null
  grade_level?: string | null
  count?: number
  language?: string
}

export interface LearningKindInfo {
  name: LearningKindName
  label: string
  item_noun: string
  item_noun_plural: string
  default_count: number
  max_count: number
  purpose: 'assign' | 'practice'
}

export interface Assignment {
  id: string
  set_id: string
  version: number
  class_id: string
  class_name: string
  title: string
  kind: LearningKindName
  group_names: string[]
  audience: number
  feedback_mode: 'instant' | 'end'
  shuffle_questions: boolean
  shuffle_options: boolean
  allow_retakes: boolean
  max_attempts: number | null
  leaderboard_enabled: boolean
  due_at: string | null
  closed: boolean
  created_at: string
}

export interface ShareDraft {
  set_id: string
  class_id: string
  group_ids: string[]
  feedback_mode: 'instant' | 'end'
  due_at: string | null
  allow_retakes: boolean
  max_attempts: number | null
  shuffle_questions: boolean
  shuffle_options: boolean
  leaderboard_enabled: boolean
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })

export const learningApi = {
  generate: (draft: GenerateDraft) =>
    apiFetch<SetSummary>('/learning-sets/generate', { method: 'POST', ...json(draft) }),
  retry: (id: string) => apiFetch<SetSummary>(`/learning-sets/${id}/retry`, { method: 'POST' }),
  list: (params: { kind?: string; q?: string; archived?: boolean } = {}) => {
    const query = new URLSearchParams()
    if (params.kind) query.set('kind', params.kind)
    if (params.q) query.set('q', params.q)
    if (params.archived) query.set('archived', 'true')
    const suffix = query.toString() ? `?${query}` : ''
    return apiFetch<{ items: SetSummary[]; total: number }>(`/learning-sets${suffix}`)
  },
  get: (id: string) => apiFetch<SetDetail>(`/learning-sets/${id}`),
  edit: (id: string, patch: { title?: string; items?: Item[]; extras?: GuideExtras }) =>
    apiFetch<SetDetail>(`/learning-sets/${id}`, { method: 'PATCH', ...json(patch) }),
  /** One more item written by AI, returned for the editor to place and save. */
  add: (id: string, instruction: string) =>
    apiFetch<{ item: Item }>(`/learning-sets/${id}/items`, { method: 'POST', ...json({ instruction }) }),
  rewrite: (id: string, itemId: string, instruction: string) =>
    apiFetch<{ item: Item }>(`/learning-sets/${id}/items/${itemId}/rewrite`, {
      method: 'POST',
      ...json({ instruction }),
    }),
  archive: (id: string) => apiFetch<void>(`/learning-sets/${id}`, { method: 'DELETE' }),
  share: (draft: ShareDraft) => apiFetch<Assignment>('/assignments', { method: 'POST', ...json(draft) }),
  assignments: (classId: string) =>
    apiFetch<{ items: Assignment[] }>(`/assignments?class_id=${encodeURIComponent(classId)}`),
  updateAssignment: (id: string, patch: { due_at?: string | null; clear_due?: boolean; closed?: boolean }) =>
    apiFetch<Assignment>(`/assignments/${id}`, { method: 'PATCH', ...json(patch) }),
}

export const isGuide = (item: Item): item is GuideSection => 'heading' in item
// A guide section has options too — for its check — so it is ruled out first.
export const isQuiz = (item: Item): item is QuizItem => 'options' in item && !('heading' in item)
