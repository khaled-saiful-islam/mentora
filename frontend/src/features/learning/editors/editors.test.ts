import { describe, expect, it } from 'vitest'
import type { FlashcardItem, QuizItem } from '../api'
import { flashcardEditor } from './flashcard'
import { quizEditor } from './quiz'

const good: QuizItem = { id: 'q', prompt: 'Why?', options: ['A', 'B', 'C', 'D'], answer: 1, explanation: '', skill: 's', difficulty: 'easy', source_ids: [] }

describe('quiz editor rules', () => {
  it('accepts a complete question', () => expect(quizEditor.problem(good)).toBeNull())
  it('wants the question', () => expect(quizEditor.problem({ ...good, prompt: '  ' })).toMatch(/question/))
  it('wants all four options', () => expect(quizEditor.problem({ ...good, options: ['A', '', 'C', 'D'] })).toMatch(/four/))
  it('wants them different', () => expect(quizEditor.problem({ ...good, options: ['A', 'a', 'C', 'D'] })).toMatch(/different/))
  it('starts a blank question on the given skill, incomplete', () => {
    const blank = quizEditor.blank('light')
    expect(blank.skill).toBe('light')
    expect(quizEditor.problem(blank)).not.toBeNull()
  })
})

describe('flashcard editor rules', () => {
  const card: FlashcardItem = { id: 'f', front: 'Sun', back: 'A star', hint: '', skill: 's', source_ids: [] }
  it('accepts a complete card', () => expect(flashcardEditor.problem(card)).toBeNull())
  it('wants both sides', () => {
    expect(flashcardEditor.problem({ ...card, front: '' })).toMatch(/front/)
    expect(flashcardEditor.problem({ ...card, back: '' })).toMatch(/back/)
  })
})
