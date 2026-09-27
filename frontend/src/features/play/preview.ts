/**
 * Playing a set before sharing it (`PreviewPage`): the same players a student
 * gets, marked here from the answer key the editor already has. Nothing
 * reaches the server, so nothing is saved, counted or seen by anyone.
 */
import type { FlashcardItem, QuizItem as KeyedQuiz, SetDetail } from '@/features/learning/api'
import { apiFetch } from '@/lib/api'
import { spokenQuery, type AnswerBody, type PlayBackend, type Spoken } from './backend'
import type { ItemPictures } from './pictures'
import type { Attempt, CardItem, Finish, Played, QuizItem, SkillScore } from './api'
import { starsFor } from './session'

const isQuiz = (item: unknown): item is KeyedQuiz => typeof item === 'object' && item !== null && 'options' in item
const isCard = (item: unknown): item is FlashcardItem => typeof item === 'object' && item !== null && 'front' in item

/** What a student is shown — never the answer key. */
function shown(item: KeyedQuiz | FlashcardItem): QuizItem | CardItem {
  if (isQuiz(item)) return { id: item.id, prompt: item.prompt, options: item.options, skill: item.skill, difficulty: item.difficulty }
  return { id: item.id, front: item.front, back: item.back, hint: item.hint, skill: item.skill }
}

/** A fresh attempt at the set, as a student would start it. */
export function previewAttempt(set: SetDetail): Attempt {
  const items = set.items.filter((i): i is KeyedQuiz | FlashcardItem => isQuiz(i) || isCard(i))
  return {
    id: `preview-${set.id}`,
    status: 'in_progress',
    number: 1,
    title: set.title,
    kind: set.kind,
    purpose: set.purpose,
    feedback_mode: 'instant',
    assignment_id: null,
    set_id: set.id,
    items: items.map(shown),
    answered: [],
    skills: set.skills,
    extras: {},
    language: set.language,
    grade_level: set.grade_level,
    score: 0,
    max_score: items.length,
    percent: 0,
    best_streak: 0,
    can_retake: true,
    attempts_used: 0,
    leaderboard: false,
    due_at: null,
  }
}

/** Marks answers the way the server does, and adds them up at the end. */
export class PreviewGrader implements PlayBackend {
  private played = new Map<string, Played>()
  private streak = 0

  constructor(private readonly set: SetDetail) {}

  answer = async (_attemptId: string, body: AnswerBody) => {
    const item = this.set.items.find((i) => i.id === body.item_id)
    const already = this.played.get(body.item_id)
    const played = already ?? this.mark(item, body)
    if (!already) {
      this.played.set(body.item_id, played)
      this.streak = played.correct ? this.streak + 1 : 0
    }
    return { played, streak: this.streak, answered: this.played.size, total: this.set.items.length }
  }

  /** What a Year 1–3 child would see beside each question. */
  pictures = () => apiFetch<ItemPictures>(`/learning-sets/${this.set.id}/pictures`)

  /** What a student would hear, from the set as it is saved. */
  speech = (_attemptId: string, spoken: Spoken) => `/api/learning-sets/${this.set.id}/speech?${spokenQuery(spoken)}`

  finish(attempt: Attempt): Finish {
    const answered = [...this.played.values()]
    const score = answered.filter((p) => p.correct === true).length
    const percent = attempt.max_score ? Math.round((10000 * score) / attempt.max_score) / 100 : 0
    return {
      attempt: { ...attempt, status: 'completed', answered, score, percent },
      stars: starsFor(percent),
      skills: this.skills(),
      badges: [],
      rank: null,
      ranked: 0,
    }
  }

  private mark(item: unknown, body: AnswerBody): Played {
    if (isQuiz(item)) {
      const correct = body.choice === item.answer
      return { item_id: item.id, choice: body.choice ?? null, knew: null, correct, reveal: { answer: item.answer, explanation: item.explanation } }
    }
    const knew = body.knew === true
    return { item_id: body.item_id, choice: null, knew, correct: knew, reveal: null }
  }

  private skills(): SkillScore[] {
    const tally = new Map<string, { correct: number; total: number }>()
    for (const item of this.set.items) {
      const played = this.played.get(item.id)
      if (!played || !('skill' in item)) continue
      const counts = tally.get(item.skill) ?? { correct: 0, total: 0 }
      tally.set(item.skill, { correct: counts.correct + (played.correct ? 1 : 0), total: counts.total + 1 })
    }
    return [...tally.entries()].map(([slug, c]) => ({
      slug,
      label: this.set.skills.find((s) => s.slug === slug)?.label ?? slug,
      ...c,
    }))
  }
}
