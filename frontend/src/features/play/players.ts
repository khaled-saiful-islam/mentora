/**
 * Which player plays which kind. A new learning kind brings its player and
 * one line here; the play page never names a kind.
 */
import type { ComponentType, RefObject } from 'react'
import type { BuddyHandle } from '@/features/buddies'
import { GameHost } from '@/features/game/GameHost'
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
  game: GameHost,
}

/** Players that bring the buddy into their own screen — a game's sidekick
 *  (§24) — so the play page does not put a second one in the corner. They
 *  tell their own story, too, so the page's opening tip is not needed. */
export const HOSTS_BUDDY: ReadonlySet<PlayKind> = new Set<PlayKind>(['game'])
