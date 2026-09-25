/**
 * How each learning kind looks. A new kind is one entry here (plus its
 * editor and player) — every tile, card, panel and header reads this table.
 */
import { BookOpenText, Cards, Exam, type Icon } from '@phosphor-icons/react'
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
  /** What one of its items is called, and more than one. */
  noun: readonly [one: string, many: string]
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
    noun: ['question', 'questions'],
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
    noun: ['card', 'cards'],
  },
  study_guide: {
    label: 'Study guide',
    Icon: BookOpenText,
    hero: 'bg-gradient-to-br from-kind-study-guide-vivid to-kind-study-guide text-white',
    soft: 'bg-kind-study-guide-vivid/12 text-kind-study-guide',
    text: 'text-kind-study-guide',
    ring: 'border-kind-study-guide-vivid',
    colour: 'hsl(var(--kind-study-guide-vivid))',
    promise: 'A topic taught step by step — pictures, words to know, and a check after each part.',
    noun: ['section', 'sections'],
  },
}

export function lookOfKind(kind: string): KindLook {
  return LOOKS[(kind in LOOKS ? kind : 'quiz') as LearningKindName]
}

/** "1 question", "6 cards", "5 sections" — or just the word, with no count. */
export function nounOf(kind: string, count?: number): string {
  const [one, many] = lookOfKind(kind).noun
  if (count === undefined) return one
  return `${count} ${count === 1 ? one : many}`
}
