import { describe, expect, it } from 'vitest'
import type { FlashcardItem, GuideSection, QuizItem } from '../api'
import { flashcardEditor } from './flashcard'
import { quizEditor } from './quiz'
import { studyGuideEditor } from './studyGuide'

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

describe('study guide editor rules', () => {
  const section: GuideSection = {
    id: 'g', heading: 'Clouds', explain: { simple: '', core: 'Clouds are water.', stretch: '' }, points: [], terms: [],
    hook: '', fact: '', example: '', image_query: '', image: null, alternatives: [],
    prompt: 'What are clouds made of?', options: ['Water', 'Cotton', 'Smoke', 'Sugar'], answer: 0, explanation: '', skill: 's', difficulty: 'easy', source_ids: [],
  }
  it('accepts a complete section', () => expect(studyGuideEditor.problem(section)).toBeNull())
  it('wants a heading and the just-right teaching', () => {
    expect(studyGuideEditor.problem({ ...section, heading: ' ' })).toMatch(/heading/)
    expect(studyGuideEditor.problem({ ...section, explain: { ...section.explain, core: '' } })).toMatch(/Just right/)
  })
  it('wants every word to know explained', () => {
    expect(studyGuideEditor.problem({ ...section, terms: [{ term: 'vapour', meaning: '', translation: '' }] })).toMatch(/meaning/)
  })
  it('checks the check like a quiz question', () => {
    expect(studyGuideEditor.problem({ ...section, options: ['A', 'A', 'C', 'D'] })).toMatch(/different/)
  })
  it('fills in extras the server sent only partly', () => {
    expect(studyGuideEditor.extras?.from({ big_question: 'Why?' })).toEqual({ big_question: 'Why?', intro: '', summary: [], challenge: null })
  })
})
