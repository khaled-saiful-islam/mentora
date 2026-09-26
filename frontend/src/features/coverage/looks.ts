/**
 * How coverage looks: a colour and a word for each status, and a dot colour
 * for each kind of thing taught. Written out whole so the stylesheet has them.
 */
import type { AreaStatus, TaughtKind, TopicStatus } from './api'

export interface StatusLook {
  label: string
  /** A soft pill. */
  pill: string
  /** A solid dot or bar. */
  solid: string
}

export const TOPIC_LOOKS: Record<TopicStatus, StatusLook> = {
  secure: { label: 'Secure', pill: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100', solid: 'bg-mint-400' },
  taught: { label: 'Taught', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100', solid: 'bg-sky-400' },
  needs_work: { label: 'Needs work', pill: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100', solid: 'bg-coral-400' },
  planned: { label: 'Planned', pill: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300', solid: 'bg-sun-400' },
  untouched: { label: 'Not yet', pill: 'bg-muted text-muted-foreground', solid: 'bg-border' },
}

export const AREA_LOOKS: Record<AreaStatus, StatusLook> = {
  secure: TOPIC_LOOKS.secure,
  covered: { ...TOPIC_LOOKS.taught, label: 'Covered' },
  started: { ...TOPIC_LOOKS.planned, label: 'Under way' },
  untouched: TOPIC_LOOKS.untouched,
}

export const KIND_DOTS: Record<TaughtKind, { label: string; dot: string; hollow: string }> = {
  quiz: { label: 'Quiz', dot: 'bg-kind-quiz-vivid', hollow: 'border-kind-quiz-vivid' },
  flashcard: { label: 'Flashcards', dot: 'bg-kind-flashcard-vivid', hollow: 'border-kind-flashcard-vivid' },
  study_guide: { label: 'Study guide', dot: 'bg-kind-study-guide-vivid', hollow: 'border-kind-study-guide-vivid' },
  live: { label: 'Live lesson', dot: 'bg-kind-live-vivid', hollow: 'border-kind-live-vivid' },
}

/** A score's bar colour, by how secure it is. */
export function scoreTone(score: number): string {
  return score >= 75 ? 'bg-mint-400' : score >= 50 ? 'bg-sky-400' : 'bg-coral-400'
}
