/**
 * How each learning kind looks. A new kind is one entry here (plus its
 * editor and player) — every tile, card, panel and header reads this table.
 */
import { Cards, Exam, type Icon } from '@phosphor-icons/react'
import type { LearningKindName } from './api'

export interface KindLook {
  label: string
  Icon: Icon
  /** Bold gradient: tiles, heroes, the panel header. */
  hero: string
  /** Soft tint and its text. */
  soft: string
  /** Text-safe accent. */
  text: string
  /** Solid ring or border accent. */
  ring: string
  /** A CSS colour for glows and inline styles. */
  colour: string
  promise: string
}

export const LOOKS: Record<LearningKindName, KindLook> = {
  quiz: {
    label: 'Quiz',
    Icon: Exam,
    hero: 'bg-gradient-to-br from-kind-quiz-vivid to-kind-quiz text-white',
    soft: 'bg-kind-quiz-vivid/12 text-kind-quiz',
    text: 'text-kind-quiz',
    ring: 'border-kind-quiz-vivid',
    colour: 'hsl(var(--kind-quiz-vivid))',
    promise: 'Multiple-choice questions from trusted sources, one at a time.',
  },
  flashcard: {
    label: 'Flashcards',
    Icon: Cards,
    hero: 'bg-gradient-to-br from-kind-flashcard-vivid to-kind-flashcard text-white',
    soft: 'bg-kind-flashcard-vivid/12 text-kind-flashcard',
    text: 'text-kind-flashcard',
    ring: 'border-kind-flashcard-vivid',
    colour: 'hsl(var(--kind-flashcard-vivid))',
    promise: 'Cards that flip: a word on the front, what it means on the back.',
  },
}

export function lookOfKind(kind: string): KindLook {
  return LOOKS[(kind in LOOKS ? kind : 'quiz') as LearningKindName]
}
