/**
 * An icon for a conversation in the list, from what it is about: a quiz, a
 * deck, a study guide, a lesson plan, a note home, or just a chat. Worked out
 * from the title, which is what the list has; anything else is a speech
 * bubble. Colours come from the kinds, so a quiz chat looks like a quiz.
 */
import { BookOpenText, Cards, ChalkboardTeacher, ChatCircleText, Envelope, Exam, Lightbulb, type Icon } from '@phosphor-icons/react'

export interface ConversationIcon {
  Icon: Icon
  /** Theme classes for the icon's tile. */
  tone: string
}

const RULES: readonly [RegExp, ConversationIcon][] = [
  [/\bquiz(zes)?\b|\bquestions?\b|\btest\b/i, { Icon: Exam, tone: 'bg-kind-quiz-vivid/15 text-kind-quiz' }],
  [/\bflash ?cards?\b|\bdeck\b|\bcards?\b/i, { Icon: Cards, tone: 'bg-kind-flashcard-vivid/15 text-kind-flashcard' }],
  [/\bstudy guide\b|\bguide\b|\bnotes?\b/i, { Icon: BookOpenText, tone: 'bg-kind-study-guide-vivid/15 text-kind-study-guide' }],
  [/\blesson\b|\bplan\b|\bteach/i, { Icon: ChalkboardTeacher, tone: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-200' }],
  [/\bparents?\b|\bletter\b|\bemail\b|\bmessage\b/i, { Icon: Envelope, tone: 'bg-coral-100 text-coral-700 dark:bg-coral-700/25 dark:text-coral-200' }],
  [/\bideas?\b|\bways? to\b|\bhow (do|can|to)\b|\bexplain\b/i, { Icon: Lightbulb, tone: 'bg-sun-100 text-sun-700 dark:bg-sun-600/25 dark:text-sun-200' }],
]

const CHAT: ConversationIcon = { Icon: ChatCircleText, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-700/25 dark:text-sky-100' }

export function iconForConversation(title: string): ConversationIcon {
  return RULES.find(([pattern]) => pattern.test(title))?.[1] ?? CHAT
}
