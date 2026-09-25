/** One editor per kind. A new kind registers its editor here. */
import type { Item, LearningKindName } from '../api'
import { flashcardEditor } from './flashcard'
import { quizEditor } from './quiz'
import { studyGuideEditor } from './studyGuide'
import type { KindEditor } from './types'

export const EDITORS: Record<LearningKindName, KindEditor<Item>> = {
  quiz: quizEditor as unknown as KindEditor<Item>,
  flashcard: flashcardEditor as unknown as KindEditor<Item>,
  study_guide: studyGuideEditor as unknown as KindEditor<Item>,
}
