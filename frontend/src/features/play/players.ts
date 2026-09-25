/**
 * Which player plays which kind. A new learning kind brings its player and
 * one line here; the play page never names a kind.
 */
import type { ComponentType, RefObject } from 'react'
import type { BuddyHandle } from '@/features/buddies'
import type { Attempt, PlayKind } from './api'
import { FlashcardPlayer } from './FlashcardPlayer'
import { GuidePlayer } from './GuidePlayer'
import { QuizPlayer } from './QuizPlayer'

export interface PlayerProps {
  attempt: Attempt
  buddy: RefObject<BuddyHandle>
  /** Where the close button goes. Answers are saved as they are given. */
  exitTo: string
  /** Every item answered: time for the finish screen. */
  onFinished: () => void
}

export const PLAYERS: Record<PlayKind, ComponentType<PlayerProps>> = {
  quiz: QuizPlayer,
  flashcard: FlashcardPlayer,
  study_guide: GuidePlayer,
}
