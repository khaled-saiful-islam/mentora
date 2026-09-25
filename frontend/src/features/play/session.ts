/**
 * The bookkeeping of one sitting, kept pure so it can be tested: which item
 * is next, what each segment of the progress bar shows, how many stars a
 * score earns.
 */
import type { Attempt, CardItem, Played, QuizItem } from './api'

export type Segment = 'correct' | 'wrong' | 'answered' | 'current' | 'todo'

export function playedById(answered: Played[]): Record<string, Played> {
  return Object.fromEntries(answered.map((p) => [p.item_id, p]))
}

/** Where to pick up: the first item without an answer, or the end. */
export function resumeAt(items: { id: string }[], played: Record<string, Played>): number {
  const index = items.findIndex((item) => !played[item.id])
  return index === -1 ? items.length : index
}

export function segments(items: { id: string }[], played: Record<string, Played>, index: number): Segment[] {
  return items.map((item, i) => {
    const answer = played[item.id]
    if (answer) {
      if (answer.correct === true) return 'correct'
      if (answer.correct === false) return 'wrong'
      return 'answered'
    }
    return i === index ? 'current' : 'todo'
  })
}

/** The same thresholds the server uses (`play_service.stars_for`), for a
 *  finished attempt opened again later. */
export function starsFor(percent: number): number {
  if (percent >= 90) return 3
  if (percent >= 70) return 2
  return percent >= 40 ? 1 : 0
}

export type Verdict = 'great' | 'good' | 'keep'

export function verdictFor(stars: number): Verdict {
  if (stars >= 3) return 'great'
  return stars === 2 ? 'good' : 'keep'
}

export function quizItems(attempt: Attempt): QuizItem[] {
  return attempt.items.filter((item): item is QuizItem => 'options' in item)
}

export function cardItems(attempt: Attempt): CardItem[] {
  return attempt.items.filter((item): item is CardItem => 'front' in item)
}

export function skillLabel(attempt: Attempt, slug: string): string {
  return attempt.skills.find((s) => s.slug === slug)?.label ?? slug.replace(/-/g, ' ')
}
