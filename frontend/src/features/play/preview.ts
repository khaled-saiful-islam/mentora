/**
 * Playing a set before sharing it (`PreviewPage`): the same players a student
 * gets, marked here from the answer key the editor already has. Nothing
 * reaches the server, so nothing is saved, counted or seen by anyone.
 */
import { pointsFor, type Answered } from '@/features/game/points'
import type { FlashcardItem, GameItem, QuizItem as KeyedQuiz, SetDetail } from '@/features/learning/api'
import { spokenQuery, type AnswerBody, type PlayBackend, type Spoken } from './backend'
import type { Attempt, CardItem, Finish, GameIsland, Played, QuizItem, SkillScore } from './api'
import { starsFor } from './session'

const isQuiz = (item: unknown): item is KeyedQuiz => typeof item === 'object' && item !== null && 'options' in item
const isCard = (item: unknown): item is FlashcardItem => typeof item === 'object' && item !== null && 'front' in item
const isIsland = (item: unknown): item is GameItem => typeof item === 'object' && item !== null && 'play' in item

type Playable = KeyedQuiz | FlashcardItem | GameItem

/** What a student is shown — never the answer key; for a game's island its
 *  round (answered on the device), never the hint until it is asked for. */
function shown(item: Playable): QuizItem | CardItem | GameIsland {
  if (isIsland(item)) {
    const { id, learn, icon, play, task, skill, difficulty } = item
    return { id, learn, icon, play, task, ...roundOf(item), has_hint: Boolean(item.hint), skill, difficulty }
  }
  if (isQuiz(item)) return { id: item.id, prompt: item.prompt, options: item.options, skill: item.skill, difficulty: item.difficulty }
  return { id: item.id, front: item.front, back: item.back, hint: item.hint, skill: item.skill }
}

/** The round an island is played in — and its pairs, the revision games'
 *  questions — but not the other rounds written for it (as the server). */
function roundOf(item: GameItem): Partial<GameIsland> {
  return { ...(item.match ? { match: item.match } : {}), [item.play]: item[item.play] }
}

/** A fresh attempt at the set, as a student would start it. */
export function previewAttempt(set: SetDetail): Attempt {
  const items = set.items.filter((i): i is Playable => isQuiz(i) || isCard(i) || isIsland(i))
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
    // A game plays its story; other kinds start without their extras.
    extras: set.kind === 'game' ? set.extras : {},
    language: set.language,
    grade_level: set.grade_level,
    level: set.level ?? null,
    timer_seconds: null,
    points: null,
    best_points: null,
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
  // A game's points, worked out as the server would (`features/game/points`).
  private counted: Answered[] = []
  private hinted = new Set<string>()

  constructor(private readonly set: SetDetail) {}

  hint = async (_attemptId: string, itemId: string) => {
    const item = this.set.items.find((i) => i.id === itemId)
    const hint = item && 'hint' in item ? item.hint : ''
    if (hint && !this.played.has(itemId)) this.hinted.add(itemId)
    return hint
  }

  answer = async (_attemptId: string, body: AnswerBody) => {
    const item = this.set.items.find((i) => i.id === body.item_id)
    const already = this.played.get(body.item_id)
    const played = already ?? this.mark(item, body)
    if (!already) {
      this.played.set(body.item_id, played)
      this.streak = played.correct ? this.streak + 1 : 0
      const difficulty = item && 'difficulty' in item ? item.difficulty : 'medium'
      this.counted.push({ correct: played.correct === true, tries: body.tries ?? 1, shown: body.shown, hinted: this.hinted.has(body.item_id), difficulty })
    }
    return { played, streak: this.streak, answered: this.played.size, total: this.set.items.length }
  }

  /** What a student would hear, from the set as it is saved. */
  speech = (_attemptId: string, spoken: Spoken) => `/api/learning-sets/${this.set.id}/speech?${spokenQuery(spoken)}`

  finish(attempt: Attempt): Finish {
    const answered = [...this.played.values()]
    const score = answered.filter((p) => p.correct === true).length
    const percent = attempt.max_score ? Math.round((10000 * score) / attempt.max_score) / 100 : 0
    const points = this.set.kind === 'game' ? pointsFor(this.counted) : null
    return {
      attempt: { ...attempt, status: 'completed', answered, score, percent, points, best_points: points },
      stars: starsFor(percent),
      skills: this.skills(),
      badges: [],
      rank: null,
      ranked: 0,
    }
  }

  private mark(item: unknown, body: AnswerBody): Played {
    if (isIsland(item)) {
      const cleared = body.done === true
      return { item_id: item.id, choice: null, knew: null, correct: cleared, reveal: { explanation: item.explanation, task: item.task } }
    }
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
